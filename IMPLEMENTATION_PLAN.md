# IMPLEMENTATION_PLAN.md — BarberDZ

> **Prepared by:** Staff Engineer / Architect Review  
> **Codebase:** BarberDZ — Algerian barbershop marketplace (React Native + NestJS + Supabase)  
> **Date:** June 2026  
> **Status:** Engineer-ready execution plan

---

## Table of Contents

1. [Critical Security Fixes](#1-critical-security-fixes)
2. [Architecture Refactor — Dual Data Access](#2-architecture-refactor)
3. [Database Refactor](#3-database-refactor)
4. [Subscription System](#4-subscription-system)
5. [Chargily Payment Integration](#5-chargily-payment-integration)
6. [Admin Portal Completion](#6-admin-portal-completion)
7. [Testing Strategy](#7-testing-strategy)
8. [DevOps & Infrastructure](#8-devops--infrastructure)
9. [UX/UI Fix Plan](#9-uxui-fix-plan)
10. [Performance Optimization](#10-performance-optimization)
11. [Feature Implementation Plan](#11-feature-implementation-plan)
12. [Execution Roadmap](#12-execution-roadmap)

---

# 1. Critical Security Fixes

---

## 1.1 — Supabase Anon Key Committed to Git

### Problem

`apps/mobile/.env`, `apps/admin/.env.local`, and `apps/.env_backup` all contain live Supabase project URL and anon key:

```
EXPO_PUBLIC_SUPABASE_URL=https://phfwutugsyiutqgippqg.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

These files are tracked in git (no `.gitignore` entry covering them). The backup file `apps/.env_backup` is especially dangerous — it has no `.env` prefix pattern that typical `.gitignore` entries cover.

### Impact

- **Security:** Anyone with repo access has the anon key. Combined with weak RLS policies, this allows unauthorized data reads/writes.
- **Business:** Live production credentials in version control is a critical compliance violation.
- **Technical:** Rotating the key requires all existing mobile builds to be updated.

### Solution

**Step 1 — Rotate the key immediately.**

Go to Supabase Dashboard → Project Settings → API → Regenerate anon key. This invalidates the exposed key.

**Step 2 — Remove from git history.**

```bash
# Install git-filter-repo (preferred over BFG)
pip install git-filter-repo

# Remove .env files from all history
git filter-repo --path apps/mobile/.env --invert-paths
git filter-repo --path apps/admin/.env.local --invert-paths
git filter-repo --path apps/.env_backup --invert-paths

# Force push all branches
git push origin --force --all
git push origin --force --tags
```

**Step 3 — Update `.gitignore` at root level.**

```gitignore
# Root .gitignore additions
**/.env
**/.env.local
**/.env.production
**/.env.backup
**/.env_backup
**/secrets.json
```

**Step 4 — Add `.env.example` files with placeholder values for each app.**

```bash
# apps/mobile/.env.example
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_API_URL=https://your-api.railway.app
EXPO_PUBLIC_PROJECT_ID=your-expo-project-id
```

**Step 5 — Notify all team members** to delete their local copies and re-clone.

### Files To Modify

- `apps/mobile/.env` → delete from repo, add to `.gitignore`
- `apps/admin/.env.local` → delete from repo, add to `.gitignore`
- `apps/.env_backup` → delete from repo
- `.gitignore` (root) → add env file patterns
- `apps/mobile/.env.example` → create
- `apps/admin/.env.example` → create
- `services/api/.env.example` → already exists, verify it has no real keys

### Testing Strategy

```bash
# Verify no secrets in git history after rewrite
git log --all --full-history -- "**/.env" | head -20
# Should return empty

# Verify .gitignore works
touch apps/mobile/.env
git status
# Should show .env as untracked (not staged)
```

### Rollback Plan

If key rotation breaks the app, the Supabase dashboard allows re-viewing the old key for a short window. Keep note of the new key before rotating.

---

## 1.2 — Admin Authentication Missing

### Problem

`apps/admin/app/salons/page.tsx` calls Supabase directly as an anonymous client with no authentication gate. Any user with the anon key can access admin pages. The admin layout (`apps/admin/app/layout.tsx`) has no session check.

### Impact

- **Security:** Any person who knows the admin URL can approve/reject salons and delete records.
- **Business:** Malicious actors can approve fake salons or delete legitimate ones.
- **Technical:** No audit trail of who made admin changes.

### Solution

**Step 1 — Create admin-only RLS policy on Supabase.**

```sql
-- Migration: 20240001_admin_rls.sql

-- Create a dedicated admin check function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'Admin'
  );
END;
$$;

-- Salons table: only admins can update is_approved
CREATE POLICY "admin_can_approve_salons"
ON salons
FOR UPDATE
USING (is_admin())
WITH CHECK (is_admin());

-- Restrict admin-visible columns to admins only
CREATE POLICY "admin_can_view_all_salons"
ON salons
FOR SELECT
USING (
  is_approved = true  -- public can see approved
  OR is_admin()       -- admins see all
  OR owner_id = auth.uid()  -- owners see their own
);
```

**Step 2 — Add authentication middleware to Next.js admin app.**

Create `apps/admin/middleware.ts`:

```typescript
// apps/admin/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { /* cookie helpers */ } }
  );

  const { data: { session } } = await supabase.auth.getSession();

  // Not authenticated → redirect to login
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (profile?.role !== 'Admin') {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!login|unauthorized|_next/static|_next/image|favicon.ico).*)'],
};
```

**Step 3 — Create login page for admin portal.**

Create `apps/admin/app/login/page.tsx` with Supabase email+password login (admin users are not phone-OTP users).

**Step 4 — Create admin users in Supabase Auth** with role='Admin' in their profiles row.

```sql
-- Manually after creating the user in Supabase Auth dashboard:
UPDATE profiles SET role = 'Admin' WHERE id = 'the-admin-user-uuid';
```

### Files To Modify

- `apps/admin/middleware.ts` → create
- `apps/admin/app/login/page.tsx` → create
- `apps/admin/app/unauthorized/page.tsx` → create
- `apps/admin/app/layout.tsx` → add session provider
- `apps/admin/lib/supabase.ts` → upgrade to `@supabase/ssr` client
- `apps/admin/package.json` → add `@supabase/ssr`

### Database Changes

```sql
-- Migration: 20240001_admin_rls.sql (shown above)
```

### Testing Strategy

1. Try accessing `/salons` without being logged in → should redirect to `/login`.
2. Log in as a non-admin user → should redirect to `/unauthorized`.
3. Log in as admin user → should load the page normally.
4. Verify Supabase RLS blocks direct anon writes to `is_approved` column.

---

## 1.3 — Salon Auto-Approval Bypass in Mobile App

### Problem

In `SalonSetupScreen.tsx`, the mobile app inserts salons directly to Supabase with `is_approved: true`:

```typescript
// Line in SalonSetupScreen.tsx — CRITICAL BUG
const { error } = await supabase.from('salons').insert({
  ...
  is_approved: true, // Auto-approve for now ← BYPASSES ADMIN REVIEW
  subscription_status: 'Trial',
});
```

This means any Coiffeur user can create a salon that is immediately live, bypassing the entire admin approval workflow.

### Impact

- **Business:** Fake/spam salons appear in the marketplace immediately.
- **Security:** RLS does not prevent this because the anon key + authenticated Supabase session has INSERT permission.
- **Trust:** Clients see unreviewed salons, damaging platform credibility.

### Root Cause

The mobile app calls Supabase directly (bypassing NestJS), and the `is_approved` field has no RLS restriction on INSERT — any authenticated barber user can set it to `true`.

### Solution

**Step 1 — Add RLS policy preventing barber users from setting `is_approved`.**

```sql
-- Migration: 20240002_salon_insert_rls.sql

-- Drop any existing insert policy
DROP POLICY IF EXISTS "coiffeur_can_insert_salon" ON salons;

-- Barbers can insert salons, but is_approved is always forced to false
-- The trick: use a WITH CHECK that prevents is_approved = true
CREATE POLICY "coiffeur_can_insert_salon"
ON salons
FOR INSERT
WITH CHECK (
  auth.uid() = owner_id
  AND is_approved = false  -- Force: can never insert as approved
);
```

**Step 2 — Fix the mobile app to remove `is_approved: true`.**

```typescript
// apps/mobile/src/screens/barber/SalonSetupScreen.tsx
const { error } = await supabase.from('salons').insert({
  owner_id: user?.id,
  name: form.name,
  wilaya: form.wilaya,
  address: form.address,
  open_time: form.open_time,
  close_time: form.close_time,
  latitude: form.latitude,
  longitude: form.longitude,
  working_days: [1, 2, 3, 4, 5, 6],
  // is_approved: REMOVED — default false in DB, only admin can set
  subscription_status: 'Trial',
  trial_ends_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
});
```

**Step 3 — Update success message to inform the barber of pending review.**

```typescript
Alert.alert(
  'Salon créé avec succès !',
  'Votre salon est en attente de validation par notre équipe. Vous recevrez une notification une fois approuvé.',
  [{ text: 'Compris', onPress: onComplete }]
);
```

**Step 4 — Add DB-level default.**

```sql
ALTER TABLE salons ALTER COLUMN is_approved SET DEFAULT false;
```

### Files To Modify

- `apps/mobile/src/screens/barber/SalonSetupScreen.tsx`
- Migration: `20240002_salon_insert_rls.sql`

### Testing Strategy

1. As a barber user, create a salon via the app.
2. Check Supabase: `is_approved` should be `false`.
3. Attempt a direct Supabase insert with `is_approved: true` using the anon key — should be rejected by RLS.
4. Verify the salon does NOT appear in the client app explore screen.

---

## 1.4 — `getClientForUser` Bug — Service Role Key Sent with User Token

### Problem

In `supabase.service.ts`, the `getClientForUser()` method creates a Supabase client using the **service role key** AND the user's JWT:

```typescript
getClientForUser(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {  // ← SERVICE ROLE KEY!
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}
```

This is incorrect and dangerous. The Supabase JS client uses the key passed as the second argument to `createClient()` as the API key. Passing the service role key here means ALL requests from this "user-scoped" client actually bypass RLS entirely (service role ignores RLS). The user JWT in the Authorization header has no effect when the service role key is used as the API key.

### Impact

- **Security:** RLS is completely bypassed. Any code calling `getClientForUser()` thinking it respects RLS is actually doing admin-level queries.
- **Data Integrity:** Users can theoretically access other users' data if the calling code doesn't add manual `.eq('user_id', userId)` filters.

### Solution

Replace the service role key with the **anon key** when creating the user-scoped client, and pass the JWT as the Authorization header. This is the correct pattern for server-side RLS enforcement.

```typescript
// services/api/src/supabase/supabase.service.ts

@Injectable()
export class SupabaseService implements OnModuleInit {
  private _adminClient!: SupabaseClient;
  private _supabaseUrl!: string;
  private _anonKey!: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this._supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    this._anonKey = this.configService.getOrThrow<string>('SUPABASE_ANON_KEY');

    // Admin client — bypasses RLS. Use only for trusted server-side operations.
    this._adminClient = createClient(this._supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  get adminClient(): SupabaseClient {
    return this._adminClient;
  }

  /**
   * Creates a user-scoped client that RESPECTS RLS.
   * Uses the anon key + user JWT — Supabase applies RLS policies using auth.uid().
   */
  getClientForUser(accessToken: string): SupabaseClient {
    return createClient(this._supabaseUrl, this._anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    });
  }
}
```

Add `SUPABASE_ANON_KEY` to the API's `.env.example`:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_ANON_KEY=your-anon-key-here
PORT=3000
```

### Files To Modify

- `services/api/src/supabase/supabase.service.ts`
- `services/api/.env.example`
- `services/api/.env`

### Testing Strategy

1. Trigger a code path that calls `getClientForUser()`.
2. In that Supabase query, do NOT add a manual `.eq('user_id', userId)` filter.
3. Verify that only the authenticated user's rows are returned (RLS kicks in).
4. Verify that rows belonging to other users are not returned.

---

## 1.5 — Rate Limiting

### Problem

The NestJS API has no rate limiting. The `app.module.ts` and `main.ts` contain no throttling configuration. An attacker can flood the OTP endpoint, the booking endpoint, or any API endpoint without restriction.

### Impact

- **Security:** OTP flooding allows brute-force of phone number verification.
- **Business:** Resource exhaustion / DoS can take down the service.
- **Cost:** Supabase Auth has OTP send limits; flooding wastes them.

### Solution

**Step 1 — Install `@nestjs/throttler`.**

```bash
cd services/api
npm install @nestjs/throttler
```

**Step 2 — Add global throttler with endpoint-specific overrides.**

```typescript
// services/api/src/app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,     // 1 second
        limit: 10,     // 10 requests per second (global)
      },
      {
        name: 'medium',
        ttl: 60000,    // 1 minute
        limit: 100,    // 100 requests per minute (global)
      },
    ]),
    // ...other modules
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

**Step 3 — Apply stricter limits to sensitive endpoints.**

```typescript
// In ReservationsController
import { Throttle } from '@nestjs/throttler';

@Controller('reservations')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class ReservationsController {
  @Post()
  @Throttle({ short: { ttl: 60000, limit: 5 } })  // 5 bookings per minute
  create(@Body() dto: CreateReservationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reservationsService.create(dto, user.id);
  }
}
```

**Step 4 — Use Redis as throttler storage in production (prevents bypass on multi-instance deployments).**

```bash
npm install @nestjs/throttler ioredis
```

```typescript
ThrottlerModule.forRoot({
  throttlers: [...],
  storage: new ThrottlerStorageRedisService(redisClient),
})
```

### Files To Modify

- `services/api/src/app.module.ts`
- `services/api/src/reservations/reservations.controller.ts`
- `services/api/package.json`

### Testing Strategy

```bash
# Using Apache Bench to test rate limiting
ab -n 200 -c 20 -H "Authorization: Bearer $TOKEN" \
  https://api.example.com/api/v1/salons

# Should see 429 Too Many Requests after the limit
```

---

## 1.6 — CORS Hardening

### Problem

`main.ts` has `origin: true` (allow all origins) with a comment saying "restrict in production" — but this is never done:

```typescript
app.enableCors({
  origin: true, // Allow all origins in dev; restrict in production ← NEVER FIXED
```

### Solution

```typescript
// services/api/src/main.ts
const allowedOrigins = configService.get<string>('ALLOWED_ORIGINS', '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.enableCors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS policy violation: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});
```

Add to `.env`:

```env
ALLOWED_ORIGINS=https://admin.barberdz.com,https://barberdz.com
```

### Files To Modify

- `services/api/src/main.ts`
- `services/api/.env.example`

---

## 1.7 — Helmet.js Security Headers

### Problem

NestJS server has no security headers. Missing: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`.

### Solution

```bash
cd services/api
npm install helmet
```

```typescript
// services/api/src/main.ts
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://*.supabase.co'],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  }));

  // ... rest of bootstrap
}
```

### Files To Modify

- `services/api/src/main.ts`
- `services/api/package.json`

---

## 1.8 — Audit Logging

### Problem

No audit log exists. Admin actions (salon approval, rejection, deletion) have no record. If a salon is wrongly rejected, there's no trace of who did it or when.

### Solution

**Step 1 — Create audit_log table.**

```sql
-- Migration: 20240003_audit_log.sql

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,           -- 'salon.approved', 'salon.rejected', etc.
  resource_type TEXT NOT NULL,    -- 'salon', 'subscription', 'user'
  resource_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- Only admins can read audit log; nobody can delete it
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_audit_log"
ON audit_log FOR SELECT
USING (is_admin());

-- No UPDATE, DELETE policies — audit log is append-only
```

**Step 2 — Create AuditService in NestJS.**

```typescript
// services/api/src/audit/audit.service.ts
import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type AuditAction =
  | 'salon.approved'
  | 'salon.rejected'
  | 'salon.deleted'
  | 'subscription.activated'
  | 'subscription.suspended'
  | 'user.banned';

@Injectable()
export class AuditService {
  constructor(private readonly supabase: SupabaseService) {}

  async log(params: {
    actorId: string;
    actorRole: string;
    action: AuditAction;
    resourceType: string;
    resourceId: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  }) {
    await this.supabase.adminClient.from('audit_log').insert({
      actor_id: params.actorId,
      actor_role: params.actorRole,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId,
      metadata: params.metadata ?? {},
      ip_address: params.ipAddress ?? null,
    });
  }
}
```

**Step 3 — Use AuditService in AdminService.**

```typescript
// services/api/src/admin/admin.service.ts
async approveSalon(salonId: string, approved: boolean, actorId: string, ip?: string) {
  // ... existing logic ...

  await this.auditService.log({
    actorId,
    actorRole: 'Admin',
    action: approved ? 'salon.approved' : 'salon.rejected',
    resourceType: 'salon',
    resourceId: salonId,
    metadata: { approved },
    ipAddress: ip,
  });

  return data;
}
```

### Files To Modify

- `services/api/src/audit/audit.service.ts` → create
- `services/api/src/audit/audit.module.ts` → create
- `services/api/src/admin/admin.service.ts`
- `services/api/src/admin/admin.module.ts`
- Migration: `20240003_audit_log.sql`

---

## 1.9 — Phone Number Validation

### Problem

Phone numbers are stored without validation. No format check, no Algerian number validation (`+213` prefix). The `SalonSetupScreen` and `SignUpScreen` accept any string.

### Solution

**Step 1 — Add phone validation to the shared package.**

```typescript
// packages/shared/utils/validators.ts

/**
 * Validates Algerian phone numbers.
 * Accepts: +213XXXXXXXXX, 0XXXXXXXXX (10 digits), 07/06/05/09XXXXXXXX
 */
export function validateAlgerianPhone(phone: string): boolean {
  // Normalize: remove spaces, dashes
  const cleaned = phone.replace(/[\s\-().]/g, '');

  // International format: +213 followed by 9 digits
  if (/^\+213[567][0-9]{8}$/.test(cleaned)) return true;

  // Local format: 0 followed by 9 digits starting with 5, 6, or 7
  if (/^0[567][0-9]{8}$/.test(cleaned)) return true;

  return false;
}

export function normalizeAlgerianPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('0')) {
    return '+213' + cleaned.slice(1);
  }
  return cleaned;
}
```

**Step 2 — Add NestJS DTO validation.**

```typescript
// In any DTO that accepts phone numbers
import { IsPhoneNumber, Matches } from 'class-validator';

export class CreateProfileDto {
  @IsString()
  @Matches(/^(\+213|0)[567][0-9]{8}$/, {
    message: 'Phone number must be a valid Algerian number (e.g. +213551234567)',
  })
  phone_number: string;
}
```

**Step 3 — Add PostgreSQL CHECK constraint.**

```sql
-- Migration: 20240004_phone_validation.sql
ALTER TABLE profiles ADD CONSTRAINT valid_phone_format
  CHECK (
    phone_number IS NULL
    OR phone_number ~ '^\+213[567][0-9]{8}$'
  );
```

### Files To Modify

- `packages/shared/utils/validators.ts` → create
- `services/api/src/reservations/dto/create-reservation.dto.ts`
- Migration: `20240004_phone_validation.sql`

---

## 1.10 — Secret Management

### Problem

`services/api/.env` references `SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here` as a placeholder — meaning the service role key is likely being set manually on the Railway deployment and never documented securely. There's no secret rotation process.

### Solution

**Step 1 — Use Railway Secret Management (already partially done via Railway env vars).**

Verify in Railway dashboard: Settings → Variables. All the following must be set as Railway secret variables, NOT in the `.env` file:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `CHARGILY_API_KEY` (future)
- `JWT_SECRET` (if ever used)

**Step 2 — For local development, use a `.env` file that is gitignored, never committed.**

**Step 3 — Document secret rotation process in `SECURITY.md`.**

```markdown
## Secret Rotation Process

1. Generate new key in Supabase Dashboard
2. Add new key to Railway Variables (keep old key active)
3. Deploy new version
4. Wait for old instances to drain (5 minutes)
5. Remove old key from Railway
6. Verify nothing is broken
```

**Step 4 — Add startup validation to crash-fast if secrets are missing.**

```typescript
// services/api/src/supabase/supabase.service.ts
onModuleInit() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'];
  for (const key of required) {
    const value = this.configService.get(key);
    if (!value || value.includes('your-')) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  // ... create clients
}
```

### Files To Modify

- `services/api/src/supabase/supabase.service.ts`
- `SECURITY.md` → create at repo root

---

# 2. Architecture Refactor

## The Dual Data Access Problem

Currently the mobile app accesses Supabase in two ways:

```
Mobile App
   ↙            ↘
NestJS API    Supabase Direct
(reservations, (salon create,
 slots)         booking create,
                salon setup)
```

`useCreateReservation.ts` calls Supabase directly. `SalonSetupScreen.tsx` calls Supabase directly. But `useAvailableSlots.ts` calls NestJS. This creates inconsistent validation, security gaps, and maintenance overhead.

## Option A: API-First (Recommended)

All mobile → NestJS → Supabase. Zero direct Supabase calls from mobile except Auth.

**Pros:**
- Single point of validation and security
- Easy to add rate limiting, logging, feature flags
- RLS becomes a defense-in-depth layer, not the primary gate
- Supabase key rotation doesn't require mobile app update
- Backend logic is testable in isolation

**Cons:**
- More network hops (mobile → NestJS → Supabase vs mobile → Supabase)
- NestJS must implement all read operations currently handled by Supabase queries
- More backend code to write

## Option B: Supabase-Native

Remove NestJS entirely. All mobile → Supabase directly. RLS as the security layer.

**Pros:**
- Less infrastructure to maintain
- Real-time subscriptions are simpler
- Supabase Edge Functions handle complex logic

**Cons:**
- RLS policies become extremely complex and hard to test
- Business logic embedded in SQL/Edge Functions — harder to maintain
- No central place for rate limiting
- Harder to integrate with Chargily webhooks
- Admin portal complexity increases

## Recommendation: Option A (API-First)

**Rationale:** BarberDZ is a marketplace SaaS with a subscription billing system (Chargily), complex slot logic, and multi-role access. NestJS is already partially built and deployed. The investment to complete the API layer is lower than rewriting everything as Supabase Edge Functions. RLS stays as defense-in-depth.

## Migration Plan (API-First)

### Phase 2A — Migrate Remaining Direct Supabase Calls to NestJS

**Files to migrate (mobile app):**

| Current Direct Call | New NestJS Endpoint |
|---|---|
| `supabase.from('salons').insert(...)` in SalonSetupScreen | `POST /api/v1/salons` (already exists) |
| `supabase.from('reservations').insert(...)` in useCreateReservation | `POST /api/v1/reservations` (already exists) |
| `supabase.from('salons').select(...)` in Admin portal | `GET /api/v1/admin/salons/pending` (already exists) |
| `supabase.from('salons').update({is_approved})` in Admin portal | `PATCH /api/v1/admin/salons/:id/approve` (already exists) |

**Step 1 — Fix `useCreateReservation.ts` to use NestJS:**

```typescript
// apps/mobile/src/hooks/booking/useCreateReservation.ts
import { supabase } from '../../lib/supabase'; // Only for getting the session token

export function useCreateReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateReservationParams): Promise<Reservation> => {
      // Get the current JWT
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${API_URL}/api/v1/reservations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          salonId: params.salonId,
          serviceId: params.serviceId,
          barberId: params.staffId,
          appointmentDate: params.appointmentDate,
          startTime: params.startTime,
          notes: params.notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409) {
          throw new Error('Ce créneau n\'est plus disponible.');
        }
        throw new Error(error.message || 'Réservation échouée');
      }

      return response.json();
    },
    // ... rest unchanged
  });
}
```

**Step 2 — Fix `SalonSetupScreen.tsx` to use NestJS:**

```typescript
// Replace supabase.from('salons').insert() with NestJS call
const { data: { session } } = await supabase.auth.getSession();

const response = await fetch(`${API_URL}/api/v1/salons`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session!.access_token}`,
  },
  body: JSON.stringify({
    name: form.name,
    wilaya: form.wilaya,
    address: form.address,
    open_time: form.open_time,
    close_time: form.close_time,
    latitude: form.latitude,
    longitude: form.longitude,
  }),
});
```

**Step 3 — Fix Admin Portal to use NestJS API instead of direct Supabase.**

The admin portal at `apps/admin/app/salons/page.tsx` currently calls Supabase directly. Replace with NestJS calls using the admin's JWT.

**Step 4 — Create a typed API client shared package.**

```typescript
// packages/shared/api/client.ts
export class BarberDZApiClient {
  constructor(private baseUrl: string, private getToken: () => Promise<string>) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const response = await fetch(`${this.baseUrl}/api/v1${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw Object.assign(new Error(error.message), { status: response.status });
    }
    return response.json();
  }

  salons = {
    list: (params?: Record<string, string>) =>
      this.request<SalonListResponse>(`/salons?${new URLSearchParams(params)}`),
    get: (id: string) => this.request<Salon>(`/salons/${id}`),
    create: (dto: CreateSalonDto) =>
      this.request<Salon>('/salons', { method: 'POST', body: JSON.stringify(dto) }),
  };

  reservations = {
    create: (dto: CreateReservationDto) =>
      this.request<Reservation>('/reservations', { method: 'POST', body: JSON.stringify(dto) }),
    listMine: () => this.request<Reservation[]>('/reservations/my'),
  };
}
```

**Mobile app keeps Supabase for:**
- `supabase.auth` — OTP auth flow (phone sign in)
- `supabase.channel()` — Realtime subscriptions (live booking updates)
- `supabase.storage` — Direct file uploads (avatars, portfolio photos)

### Files To Modify (API-First Migration)

- `apps/mobile/src/hooks/booking/useCreateReservation.ts`
- `apps/mobile/src/screens/barber/SalonSetupScreen.tsx`
- `apps/admin/app/salons/page.tsx`
- `apps/admin/lib/adminApi.ts` → create (admin API client)
- `packages/shared/api/client.ts` → create
- `apps/mobile/src/lib/api.ts` → expand with full typed client

---

# 3. Database Refactor

## 3.1 — Subscriptions Table

### Problem

The `salons` table embeds subscription state (`subscription_status`, `trial_ends_at`) directly. This makes it impossible to track subscription history, store payment references, or support multiple subscription periods.

### Solution

Separate `subscriptions` into its own table with full lifecycle tracking.

```sql
-- Migration: 20240005_subscriptions_table.sql

CREATE TYPE subscription_status AS ENUM (
  'Trial',
  'Active',
  'Expired',
  'Suspended',
  'Cancelled'
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  status subscription_status NOT NULL DEFAULT 'Trial',
  plan TEXT NOT NULL DEFAULT 'monthly',   -- 'trial', 'monthly', 'annual'
  price_dzd NUMERIC(10, 2),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  suspended_at TIMESTAMPTZ,
  suspend_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_salon ON subscriptions(salon_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_ends_at ON subscriptions(ends_at)
  WHERE status IN ('Active', 'Trial');

-- Trigger to update salon.subscription_status when subscription changes
CREATE OR REPLACE FUNCTION sync_salon_subscription_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE salons
  SET
    subscription_status = NEW.status::text,
    trial_ends_at = NEW.trial_ends_at,
    updated_at = NOW()
  WHERE id = NEW.salon_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_subscription_to_salon
AFTER INSERT OR UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION sync_salon_subscription_status();
```

**Keep `subscription_status` on `salons` as a denormalized cache** for fast queries (don't JOIN subscriptions on every salon list query). The trigger keeps it in sync.

---

## 3.2 — Payments Table

```sql
-- Migration: 20240006_payments_table.sql

CREATE TYPE payment_status AS ENUM (
  'Pending',
  'Completed',
  'Failed',
  'Refunded',
  'Cancelled'
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount_dzd NUMERIC(10, 2) NOT NULL,
  status payment_status NOT NULL DEFAULT 'Pending',
  provider TEXT NOT NULL DEFAULT 'chargily',  -- 'chargily', 'manual'
  provider_payment_id TEXT,                   -- Chargily checkout ID
  provider_checkout_url TEXT,                 -- Chargily payment URL
  webhook_received_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_salon ON payments(salon_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_provider_id ON payments(provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
```

---

## 3.3 — Audit Log Table

Already defined in section 1.8. No additional changes needed.

---

## 3.4 — Loyalty Transactions Table

```sql
-- Migration: 20240007_loyalty_tables.sql

CREATE TABLE loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, salon_id)
);

CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('earn', 'redeem', 'expire', 'adjustment')),
  points INTEGER NOT NULL,  -- positive = earn, negative = redeem/expire
  balance_after INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loyalty_client_salon ON loyalty_accounts(client_id, salon_id);
CREATE INDEX idx_loyalty_tx_account ON loyalty_transactions(account_id);
CREATE INDEX idx_loyalty_tx_created ON loyalty_transactions(created_at DESC);
```

---

## 3.5 — Blocked Times Table

```sql
-- Migration: 20240008_blocked_times.sql

CREATE TABLE blocked_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  barber_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_days INTEGER[],  -- [1,3,5] = Mon, Wed, Fri
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blocked_time_order CHECK (end_time > start_time)
);

CREATE INDEX idx_blocked_times_salon_date ON blocked_times(salon_id, date);
```

**Update the slots service** to fetch blocked times and exclude overlapping slots.

---

## 3.6 — ERD Summary

```
profiles
  ↓ 1:1
salons (owner_id)
  ↓ 1:N
  subscriptions → payments
  services
  salon_staff → profiles
  reservations → profiles (client_id)
               → services
               → loyalty_transactions → loyalty_accounts
  blocked_times
  portfolio_photos
  reviews → profiles (client_id)

audit_log → profiles (actor_id)
```

### Migration Strategy (No Data Loss)

1. Run all migrations in a transaction on the staging database first.
2. For `subscriptions`: create the table, then INSERT one subscription row per existing salon based on the current `subscription_status` and `trial_ends_at` columns.
3. Keep the denormalized `subscription_status` column on `salons` — the trigger maintains it.
4. After a week in production with the new system working, `DROP COLUMN trial_ends_at` from `salons` (it's now in `subscriptions`).

```sql
-- Data migration: seed subscriptions from existing salon data
INSERT INTO subscriptions (salon_id, status, plan, trial_ends_at, starts_at)
SELECT
  id,
  subscription_status::subscription_status,
  'trial',
  trial_ends_at,
  created_at
FROM salons
WHERE subscription_status IS NOT NULL
ON CONFLICT DO NOTHING;
```

---

# 4. Subscription System

## State Machine

```
                 [Admin Approves]
New Salon ──────────────────────→ Trial
                                    │
                          trial_ends_at passes
                                    │
                                    ↓
                   ┌─────────── Expired
                   │                │
         [Payment Received]   [Admin suspends]
                   │                │
                   ↓                ↓
                Active          Suspended
                   │                │
          [ends_at passes]   [Payment received]
                   │                │
                   ↓                ↓
                Expired ←───────── Active
```

## Database Schema

Already defined in Section 3.1.

## API Endpoints

```
POST   /api/v1/subscriptions/checkout     → Create Chargily checkout
POST   /api/v1/subscriptions/webhook      → Chargily webhook (activate)
GET    /api/v1/subscriptions/my           → Get my salon's subscription
GET    /api/v1/admin/subscriptions        → Admin: list all
PATCH  /api/v1/admin/subscriptions/:id/suspend    → Admin: suspend
PATCH  /api/v1/admin/subscriptions/:id/reinstate  → Admin: reinstate
```

## Scheduled Jobs (Expiration & Reminders)

Use NestJS `@nestjs/schedule`:

```bash
npm install @nestjs/schedule
```

```typescript
// services/api/src/subscriptions/subscription-scheduler.service.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SubscriptionSchedulerService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  // Run daily at 06:00 Algiers time
  @Cron('0 6 * * *', { timeZone: 'Africa/Algiers' })
  async expireTrials() {
    const now = new Date().toISOString();

    const { data: expiredTrials } = await this.supabase.adminClient
      .from('subscriptions')
      .update({ status: 'Expired' })
      .eq('status', 'Trial')
      .lt('trial_ends_at', now)
      .select('salon_id');

    // Notify each expired salon owner
    for (const sub of (expiredTrials ?? [])) {
      await this.notifications.notifyBarber(sub.salon_id, {
        title: 'Période d\'essai terminée',
        body: 'Votre période d\'essai est terminée. Abonnez-vous pour continuer.',
      });
    }
  }

  // Run daily at 06:00 — warn 7 days before expiry
  @Cron('0 6 * * *', { timeZone: 'Africa/Algiers' })
  async sendExpiryWarnings() {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const tomorrow = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();

    const { data: expiringSoon } = await this.supabase.adminClient
      .from('subscriptions')
      .select('salon_id, ends_at')
      .eq('status', 'Active')
      .gte('ends_at', tomorrow)
      .lt('ends_at', sevenDaysFromNow);

    for (const sub of (expiringSoon ?? [])) {
      const daysLeft = Math.ceil(
        (new Date(sub.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      await this.notifications.notifyBarber(sub.salon_id, {
        title: `Abonnement expire dans ${daysLeft} jours`,
        body: 'Renouvelez votre abonnement pour ne pas interrompre votre service.',
      });
    }
  }
}
```

## NestJS Module Structure

```
services/api/src/subscriptions/
├── subscriptions.module.ts
├── subscriptions.controller.ts
├── subscriptions.service.ts
├── subscription-scheduler.service.ts
└── dto/
    ├── create-checkout.dto.ts
    └── update-subscription.dto.ts
```

---

# 5. Chargily Payment Integration

## Overview

Chargily is the primary Algerian payment gateway. The integration flow:

```
Barber clicks "Subscribe"
        │
        ▼
POST /api/v1/subscriptions/checkout
  → Creates payment record (Pending)
  → Calls Chargily API to create checkout
  → Returns checkout_url
        │
        ▼
Mobile opens checkout_url in WebView / Browser
        │
        ▼
User pays on Chargily
        │
        ▼
Chargily calls POST /api/v1/subscriptions/webhook
  → Verify HMAC signature
  → Update payment status
  → Activate/extend subscription
  → Send push notification to barber
```

## Files To Create

```
services/api/src/payments/
├── payments.module.ts
├── payments.controller.ts
├── payments.service.ts
├── chargily.service.ts
└── dto/
    ├── create-checkout.dto.ts
    └── chargily-webhook.dto.ts
```

## Chargily Service Implementation

```typescript
// services/api/src/payments/chargily.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface ChargilyCheckoutResponse {
  id: string;
  checkout_url: string;
  status: string;
}

@Injectable()
export class ChargilyService {
  private readonly logger = new Logger(ChargilyService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://pay.chargily.net/test/api/v2'; // switch to /prod for live

  constructor(private config: ConfigService) {
    this.apiKey = config.getOrThrow('CHARGILY_API_KEY');
  }

  async createCheckout(params: {
    amount: number;  // in DZD
    currency: 'dzd';
    description: string;
    successUrl: string;
    failureUrl: string;
    webhookUrl: string;
    metadata?: Record<string, string>;
  }): Promise<ChargilyCheckoutResponse> {
    const response = await fetch(`${this.baseUrl}/checkouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: params.amount * 100, // Chargily uses centimes
        currency: params.currency,
        description: params.description,
        success_url: params.successUrl,
        failure_url: params.failureUrl,
        webhook_endpoint: params.webhookUrl,
        metadata: params.metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Chargily API error: ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const secret = this.config.getOrThrow('CHARGILY_WEBHOOK_SECRET');
    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  }
}
```

## Webhook Handler

```typescript
// services/api/src/payments/payments.controller.ts
@Post('webhook')
@HttpCode(200)
async handleWebhook(
  @Req() req: Request,
  @Headers('signature') signature: string,
  @Body() body: any,
) {
  // Verify HMAC signature FIRST — before processing anything
  const rawBody = JSON.stringify(body);
  if (!this.chargilyService.verifyWebhookSignature(rawBody, signature)) {
    throw new UnauthorizedException('Invalid webhook signature');
  }

  // Process payment event
  if (body.type === 'checkout.paid') {
    const paymentId = body.data.metadata?.payment_id;
    await this.paymentsService.activateSubscription(paymentId, body.data);
  }

  return { received: true };
}
```

## Subscription Activation

```typescript
// services/api/src/payments/payments.service.ts
async activateSubscription(paymentId: string, chargilyData: any) {
  // 1. Update payment status
  const { data: payment } = await this.supabase.adminClient
    .from('payments')
    .update({
      status: 'Completed',
      provider_payment_id: chargilyData.id,
      webhook_received_at: new Date().toISOString(),
      metadata: chargilyData,
    })
    .eq('id', paymentId)
    .select('salon_id, subscription_id')
    .single();

  // 2. Determine plan duration
  const plan = chargilyData.metadata?.plan ?? 'monthly';
  const durationDays = plan === 'annual' ? 365 : 30;
  const endsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  // 3. Activate/extend subscription
  await this.supabase.adminClient
    .from('subscriptions')
    .update({
      status: 'Active',
      plan,
      ends_at: endsAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payment.subscription_id);

  // 4. Audit log
  await this.auditService.log({
    actorId: payment.salon_id, // salon acted on itself
    actorRole: 'System',
    action: 'subscription.activated',
    resourceType: 'subscription',
    resourceId: payment.subscription_id,
    metadata: { plan, endsAt },
  });

  // 5. Push notification to barber
  await this.notifications.notifyBarber(payment.salon_id, {
    title: 'Abonnement activé ! ✅',
    body: `Votre abonnement ${plan === 'annual' ? 'annuel' : 'mensuel'} est maintenant actif.`,
  });
}
```

### Failure & Refund Handling

```typescript
// On webhook type 'checkout.failed'
async handleFailedPayment(paymentId: string) {
  await this.supabase.adminClient
    .from('payments')
    .update({ status: 'Failed', updated_at: new Date().toISOString() })
    .eq('id', paymentId);
  // Notify barber of failure
}

// Manual refund (admin action)
async refundPayment(paymentId: string, adminId: string) {
  // Call Chargily refund API
  // Update payment.status = 'Refunded'
  // Suspend subscription
  // Audit log
}
```

### Environment Variables

```env
CHARGILY_API_KEY=your-chargily-api-key
CHARGILY_WEBHOOK_SECRET=your-webhook-secret
CHARGILY_MODE=test  # or 'prod'
```

---

# 6. Admin Portal Completion Plan

## Current State

Only one page exists: salon approvals (`apps/admin/app/salons/page.tsx`). No auth, no dashboard, no subscription management.

## Full Portal Structure

```
apps/admin/app/
├── layout.tsx                    (auth shell, sidebar)
├── login/page.tsx                (admin login)
├── unauthorized/page.tsx
├── page.tsx                      (dashboard / redirect to /dashboard)
├── dashboard/page.tsx            (stats overview)
├── salons/
│   ├── page.tsx                  (pending approvals — existing, fix auth)
│   └── [id]/page.tsx             (salon detail view)
├── subscriptions/page.tsx        (subscription management)
├── payments/page.tsx             (payment history)
├── sponsored/page.tsx            (sponsored listings management)
├── users/page.tsx                (user management)
├── audit/page.tsx                (audit log viewer)
└── revenue/page.tsx              (revenue dashboard)
```

## Dashboard Page

**Features:** Total salons, active salons, pending approvals, total users, total reservations, monthly revenue trend.

**APIs Required:**
- `GET /api/v1/admin/stats` (already implemented)
- Extend stats to include revenue data from `payments` table

**Components:**
- `StatsCard` — number + label + trend
- `RecentActivityList` — last 10 audit log entries
- `PendingApprovalsAlert` — count + link to salons page

## Salon Management

**Features:** List all salons (filterable by status/wilaya), approve/reject, view details, suspend.

**APIs Required:**
- `GET /api/v1/admin/salons` (paginated, filtered)
- `PATCH /api/v1/admin/salons/:id/approve`
- `PATCH /api/v1/admin/salons/:id/suspend`

**NestJS additions needed:**

```typescript
// New admin endpoints in admin.controller.ts
@Get('salons')
getAllSalons(@Query() query: GetSalonsQueryDto) {
  return this.adminService.getAllSalons(query);
}

@Patch('salons/:id/suspend')
suspendSalon(@Param('id') id: string, @Body('reason') reason: string, @CurrentUser() user: AuthenticatedUser) {
  return this.adminService.suspendSalon(id, reason, user.id);
}
```

## Subscription Management

**Features:** List all subscriptions with status, manually activate, suspend, view payment history.

**APIs Required:**
- `GET /api/v1/admin/subscriptions`
- `PATCH /api/v1/admin/subscriptions/:id/suspend`
- `PATCH /api/v1/admin/subscriptions/:id/reinstate`

## Sponsored Listings

**Features:** Mark a salon as sponsored, set `sponsored_until` date, set promotion amount (for internal billing records).

**APIs Required:**

```typescript
// New NestJS endpoint
@Patch('salons/:id/sponsor')
@Roles('Admin')
sponsorSalon(
  @Param('id') id: string,
  @Body() dto: SponsorSalonDto,
) {
  return this.adminService.sponsorSalon(id, dto);
}
```

```typescript
// SponsorSalonDto
export class SponsorSalonDto {
  @IsBoolean()
  sponsored: boolean;

  @IsDateString()
  @IsOptional()
  sponsored_until?: string;
}
```

## Revenue Dashboard

**Features:** Monthly revenue chart (sum of `payments.amount_dzd` by month), breakdown by plan type (monthly vs annual), top 10 highest-paying salons.

**DB Queries:**

```sql
-- Monthly revenue
SELECT
  DATE_TRUNC('month', created_at) AS month,
  SUM(amount_dzd) AS revenue,
  COUNT(*) AS payment_count
FROM payments
WHERE status = 'Completed'
GROUP BY 1
ORDER BY 1 DESC
LIMIT 12;

-- By plan
SELECT
  s.plan,
  COUNT(*) AS count,
  SUM(p.amount_dzd) AS total
FROM payments p
JOIN subscriptions s ON p.subscription_id = s.id
WHERE p.status = 'Completed'
GROUP BY s.plan;
```

## Audit Log Viewer

**Features:** Paginated log table, filter by actor/action/date range, export CSV.

**APIs Required:**
- `GET /api/v1/admin/audit?page=1&limit=50&action=salon.approved`

---

# 7. Testing Strategy

## 7.1 — Unit Tests

### Target Files and What to Test

| File | Tests |
|---|---|
| `supabase.service.ts` | `getClientForUser()` uses anon key not service role key |
| `auth.guard.ts` | Missing token throws 401; invalid token throws 401; role populated correctly |
| `roles.guard.ts` | Missing role throws 403; wrong role throws 403; correct role passes |
| `reservations.service.ts` | `addMinutesToTime()` correctness; conflict error → 409; service not found → 400 |
| `slots.service.ts` | Slot generation boundaries; closed-day returns empty; blocked times excluded |
| `salons.service.ts` | Create sets `is_approved=false`; update ownership check |
| `chargily.service.ts` | HMAC verification with correct/incorrect secrets |
| `subscription-scheduler.service.ts` | Expiry logic with mocked dates |

### Setup

```bash
cd services/api
npm install --save-dev jest @nestjs/testing
```

### Example Test

```typescript
// services/api/src/slots/slots.service.spec.ts
describe('SlotsService', () => {
  it('generates correct number of 30-min slots for 9:00–21:00', () => {
    const slots = service['generateTimeSlots']('09:00', '21:00', 30);
    expect(slots).toHaveLength(24); // 720 minutes / 30 = 24 slots
    expect(slots[0].startTime).toBe('09:00');
    expect(slots[23].endTime).toBe('21:00');
  });

  it('returns empty array for closed day', async () => {
    // Mock salon with working_days: [1,2,3,4,5] (no Sunday=0)
    const slots = await service.getAvailableSlots(salonId, serviceId, '2025-06-22'); // Sunday
    expect(slots).toEqual([]);
  });
});
```

## 7.2 — Integration Tests

### Flows to Test

1. **Auth flow:** Create phone user → OTP verify → get JWT → call protected endpoint → success.
2. **Salon creation:** POST `/salons` → verify `is_approved=false` in DB → appears in admin pending list.
3. **Booking flow:** GET `/slots` → POST `/reservations` → verify DB row → GET `/reservations/my` → confirm visible.
4. **Double-booking prevention:** Two concurrent POST `/reservations` for same slot → one succeeds (201), one fails (409).
5. **Subscription flow:** POST `/subscriptions/checkout` → fake Chargily webhook → verify subscription `Active`.
6. **Admin approval:** PATCH `/admin/salons/:id/approve` → salon appears in public listing.

### Setup

```bash
npm install --save-dev supertest @types/supertest
```

### Test Database

Use a separate Supabase project for integration tests, or use `supabase db reset` on a local Supabase instance via Docker:

```bash
# Run local Supabase for testing
supabase start
supabase db reset
```

## 7.3 — E2E Tests

### User Scenarios

1. **Client books a haircut:**
   - Open app → browse salons → select salon → choose service → pick date/time → confirm → receive confirmation.

2. **Barber manages their salon:**
   - Register → set up salon → wait for approval → see booking in calendar → confirm booking → mark complete.

3. **Admin approves a salon:**
   - Log in to admin portal → see pending salon → click approve → verify salon appears on mobile app.

4. **Subscription renewal:**
   - Trial expires → barber sees expired state → click subscribe → complete payment → salon active again.

### Tool

Use Maestro for React Native E2E:

```bash
npm install -g @maestro/cli
```

```yaml
# e2e/client-booking-flow.yaml
appId: com.ahmedyasser.hafefli
---
- launchApp
- tapOn: "Explorer"
- tapOn:
    text: "Barber VIP"
- tapOn: "Coupe classique"
- tapOn:
    text: "Lundi"
- tapOn: "10:00"
- tapOn: "Confirmer"
- assertVisible: "Réservation confirmée"
```

## Target Coverage

- Unit tests: 80%+ on `services/api/src/**`
- Integration tests: cover all 6 critical flows
- E2E: cover 4 main user journeys

---

# 8. DevOps & Infrastructure

## 8.1 — GitHub Actions CI/CD

Create `.github/workflows/api.yml`:

```yaml
name: API CI/CD

on:
  push:
    branches: [main]
    paths: ['services/api/**']
  pull_request:
    paths: ['services/api/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: services/api/package-lock.json

      - name: Install dependencies
        run: cd services/api && npm ci

      - name: Type check
        run: cd services/api && npm run build --dry-run || npx tsc --noEmit

      - name: Run unit tests
        run: cd services/api && npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Railway
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
        run: |
          npm install -g @railway/cli
          railway up --service api --detach
```

Create `.github/workflows/admin.yml` for the Next.js admin portal (deploy to Vercel).

## 8.2 — Railway Deployment

Current setup: `services/api` is already deployed to Railway at `https://7afefli-production.up.railway.app`.

**Improvements needed:**

1. Add health check endpoint:

```typescript
// services/api/src/health/health.controller.ts
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

2. Configure Railway to use the health check:
   - Health Check Path: `/api/v1/health`
   - Restart Policy: On Failure

3. Add `railway.json` at `services/api/railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/api/v1/health",
    "healthcheckTimeout": 60,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

## 8.3 — Monitoring with Sentry

```bash
cd services/api
npm install @sentry/nestjs @sentry/node
```

```typescript
// services/api/src/main.ts
import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions
});
```

Add `SENTRY_DSN` to Railway environment variables.

## 8.4 — Structured Logging

Replace `console.log` with a structured logger:

```bash
npm install winston nest-winston
```

```typescript
// Log format: JSON for production (for log aggregators), pretty for dev
const logger = WinstonModule.createLogger({
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production'
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
    }),
  ],
});
```

## 8.5 — Database Backups

Supabase Free/Pro tier includes automatic daily backups. For additional protection:

1. Enable Point-in-Time Recovery on Supabase Pro tier.
2. Schedule a weekly export job using Supabase CLI:

```bash
# .github/workflows/backup.yml
- name: Export database
  run: supabase db dump --db-url $SUPABASE_DB_URL > backup-$(date +%Y%m%d).sql
- name: Upload to S3
  run: aws s3 cp backup-*.sql s3://barberdz-backups/
```

## 8.6 — Disaster Recovery

- **RTO (Recovery Time Objective):** < 2 hours
- **RPO (Recovery Point Objective):** < 24 hours

**Recovery steps:**
1. If Railway service is down: redeploy from last successful Docker image (Railway keeps 10 versions).
2. If Supabase is down: fail-over is not feasible for free tier. Upgrade to Pro for failover support.
3. If data corruption: restore from Supabase point-in-time recovery.

---

# 9. UX/UI Fix Plan

## 9.1 — Cancellation Flow

**Problem:** Clients can cancel reservations but there's no feedback after cancellation — the appointment just disappears from the list without explanation.

**Fix:** After cancellation, show a confirmation modal with:
- "Reservation cancelled"
- Cancellation policy (e.g. "Free cancellation up to 2 hours before")
- Option to rebook

**Screens impacted:** `MyAppointmentsScreen.tsx`

**Implementation:**

```typescript
// Add confirmation dialog before cancellation
Alert.alert(
  'Annuler la réservation',
  `Êtes-vous sûr de vouloir annuler votre rendez-vous du ${formattedDate} à ${startTime} ?`,
  [
    { text: 'Garder', style: 'cancel' },
    {
      text: 'Annuler le rendez-vous',
      style: 'destructive',
      onPress: () => cancelReservation(reservation.id),
    },
  ]
);
```

## 9.2 — Booking Flow — Missing Validation Feedback

**Problem:** If a user submits a booking without selecting a service or time, no error is shown — the submit button just does nothing.

**Fix:** Add inline validation feedback:

```typescript
// BookingScreen.tsx
const [errors, setErrors] = useState<Record<string, string>>({});

const validateAndSubmit = () => {
  const newErrors: Record<string, string> = {};
  if (!selectedService) newErrors.service = 'Veuillez choisir un service';
  if (!selectedDate) newErrors.date = 'Veuillez choisir une date';
  if (!selectedSlot) newErrors.slot = 'Veuillez choisir un créneau';
  
  setErrors(newErrors);
  if (Object.keys(newErrors).length === 0) {
    submitBooking();
  }
};
```

## 9.3 — Onboarding — Back Button Signs Out

**Problem:** `SalonSetupScreen.tsx` has this bug:

```typescript
<TouchableOpacity onPress={() => supabase.auth.signOut()}>  // ← BACK BUTTON SIGNS OUT!
```

A barber who accidentally taps "back" is logged out immediately.

**Fix:** 

```typescript
// This should navigate back, not sign out
<TouchableOpacity onPress={() => navigation.goBack()}>
  <Ionicons name="arrow-back" size={24} color={colors.amber} />
</TouchableOpacity>
```

## 9.4 — Loading States

**Problem:** Many screens have no loading state — they appear blank while data loads, which feels broken.

**Fix:** Add skeleton loading screens to:
- `ExploreScreen.tsx` — show 3 skeleton salon cards
- `SalonDetailScreen.tsx` — show skeleton header + service list
- `BookingScreen.tsx` — show skeleton date strip + slot grid

```typescript
// Simple skeleton component
const SkeletonBox = ({ width, height, borderRadius = 8 }) => (
  <Animated.View
    style={[
      { width, height, borderRadius, backgroundColor: colors.carbon },
      { opacity: pulseAnimation }, // 0.3 → 0.8 loop
    ]}
  />
);
```

## 9.5 — RTL Support (Arabic)

**Problem:** No RTL layout support. Algeria has significant Arabic-language users.

**Fix:**
1. Add `I18nManager.forceRTL(isArabic)` in app initialization.
2. Replace all `StyleSheet` `left`/`right` margins with `start`/`end`.
3. Add language selector in Settings screen.
4. Add Arabic translations to a `locales/ar.json` file.

```typescript
// i18n setup
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './locales/fr.json';
import ar from './locales/ar.json';

i18n.use(initReactI18next).init({
  lng: 'fr', // default
  resources: { fr: { translation: fr }, ar: { translation: ar } },
});
```

## 9.6 — Accessibility

**Problems:** No `accessibilityLabel` on icon buttons, no screen reader support, color contrast may be insufficient.

**Fix:**
- Add `accessibilityLabel` to all `TouchableOpacity` elements without visible text.
- Add `accessibilityRole="button"` to touchable elements.
- Verify color contrast: amber (#E8A020) on dark (#0F0F0F) = ratio ~7.5:1 ✓ (passes WCAG AA).
- Add `accessibilityHint` for complex actions (e.g. slot picker).

---

# 10. Performance Optimization

## 10.1 — Database Indexes

Add missing indexes for common query patterns:

```sql
-- Migration: 20240009_performance_indexes.sql

-- Salons: most common filters
CREATE INDEX CONCURRENTLY idx_salons_is_approved_wilaya
  ON salons(is_approved, wilaya)
  WHERE is_approved = true;

CREATE INDEX CONCURRENTLY idx_salons_subscription_status
  ON salons(subscription_status)
  WHERE subscription_status IN ('Trial', 'Active');

-- Reservations: most common queries
CREATE INDEX CONCURRENTLY idx_reservations_client_date
  ON reservations(client_id, appointment_date DESC);

CREATE INDEX CONCURRENTLY idx_reservations_salon_date_status
  ON reservations(salon_id, appointment_date, status)
  WHERE status IN ('Pending', 'Confirmed');

-- Slots lookup (most performance-critical)
CREATE INDEX CONCURRENTLY idx_reservations_salon_date_times
  ON reservations(salon_id, appointment_date, start_time, end_time)
  WHERE status IN ('Pending', 'Confirmed');

-- Reviews
CREATE INDEX CONCURRENTLY idx_reviews_salon
  ON reviews(salon_id, created_at DESC);
```

## 10.2 — Query Optimizations

**Problem:** `salons.service.ts` `findAll()` does `SELECT *, services(*)` — this N+1-style join loads all services for every salon in the list view.

**Fix:** For list views, don't include services. Load them only in the detail view.

```typescript
// List view: no services
let query = this.supabase.adminClient
  .from('salons')
  .select('id, name, wilaya, address, average_rating, is_sponsored, subscription_status, latitude, longitude', { count: 'exact' })
  .eq('is_approved', true);

// Detail view: include everything
.select('*, services(*), profiles!owner(...), salon_staff(...), portfolio_photos(*)')
```

## 10.3 — Caching Strategy

For data that rarely changes (salon details, service lists), add Redis cache in NestJS:

```bash
npm install @nestjs/cache-manager cache-manager ioredis cache-manager-ioredis
```

```typescript
// Cache salon details for 5 minutes
@Get(':id')
@UseInterceptors(CacheInterceptor)
@CacheTTL(300)
findOne(@Param('id') id: string) {
  return this.salonsService.findOne(id);
}
```

Invalidate cache on salon update:

```typescript
// In update()
await this.cacheManager.del(`salon:${id}`);
```

## 10.4 — Realtime Improvements

**Problem:** The mobile app subscribes to realtime events but may create multiple subscriptions on re-render. `useRealtimeBookings.ts` should clean up on unmount.

**Fix:**

```typescript
// apps/mobile/src/hooks/barber/useRealtimeBookings.ts
useEffect(() => {
  const channel = supabase
    .channel(`salon-${salonId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'reservations',
      filter: `salon_id=eq.${salonId}`,
    }, handleChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel); // Cleanup on unmount
  };
}, [salonId]); // Only re-subscribe if salonId changes
```

## 10.5 — Mobile Performance

1. **Memoize expensive renders:** Wrap `SalonCard`, `ServiceCard`, `SlotPicker` in `React.memo`.
2. **Use `FlatList` instead of `ScrollView` for lists** of more than 10 items to avoid off-screen rendering.
3. **Lazy load map:** Only load `SalonMapView` when the map tab is active, not on initial render.
4. **Image optimization:** Use `expo-image` instead of React Native's built-in `Image` for progressive loading and caching.

```bash
npx expo install expo-image
```

---

# 11. Feature Implementation Plan

## 11.1 — Loyalty System

**DB Changes:** `loyalty_accounts`, `loyalty_transactions` tables (Section 3.4).

**API Changes:**
- `GET /api/v1/loyalty/my` — client views their points per salon
- `POST /api/v1/loyalty/redeem` — client redeems points

**Backend Logic:** After a reservation is marked `Completed`, a NestJS event listener triggers:

```typescript
@OnEvent('reservation.completed')
async awardLoyaltyPoints(reservation: Reservation) {
  const points = Math.floor(reservation.service.price / 100); // 1 point per 100 DZD
  await this.loyaltyService.addPoints(
    reservation.client_id,
    reservation.salon_id,
    reservation.id,
    points
  );
}
```

**UI Changes:** Add loyalty points display in `SalonDetailScreen` and `MyAppointmentsScreen`.

**Effort:** 3 days backend, 2 days frontend. **Priority:** P2.

---

## 11.2 — Revenue Dashboard

Already covered in Section 6. **Effort:** 2 days. **Priority:** P1.

---

## 11.3 — Sponsored Salons

**DB Changes:** `salons.is_sponsored`, `salons.sponsored_until` already exist.

**API Changes:**
- Admin: `PATCH /api/v1/admin/salons/:id/sponsor` (Section 6).
- Mobile: sponsored salons already appear first in `findAll()` via `.order('is_sponsored', { ascending: false })`.

**UI Changes:** Add `⭐ Sponsorisé` badge to `SalonCard.tsx`.

```typescript
// apps/mobile/src/components/salon/SalonCard.tsx
{salon.is_sponsored && (
  <View style={styles.sponsoredBadge}>
    <Text style={styles.sponsoredText}>⭐ Mis en avant</Text>
  </View>
)}
```

**Effort:** 1 day. **Priority:** P1 (revenue).

---

## 11.4 — Push Notifications

**DB Changes:** Add `expo_push_token` to `profiles` table.

```sql
ALTER TABLE profiles ADD COLUMN expo_push_token TEXT;
```

**Backend:** Create `NotificationsService`:

```typescript
// services/api/src/notifications/notifications.service.ts
import Expo from 'expo-server-sdk';

@Injectable()
export class NotificationsService {
  private expo = new Expo();

  async sendToUser(userId: string, message: { title: string; body: string; data?: object }) {
    const { data: profile } = await this.supabase.adminClient
      .from('profiles')
      .select('expo_push_token')
      .eq('id', userId)
      .single();

    if (!profile?.expo_push_token || !Expo.isExpoPushToken(profile.expo_push_token)) {
      return;
    }

    await this.expo.sendPushNotificationsAsync([{
      to: profile.expo_push_token,
      title: message.title,
      body: message.body,
      data: message.data,
    }]);
  }
}
```

**Mobile:** Register token on app start using `useNotificationSetup.ts` (already exists in codebase — wire it to save the token to the profile via NestJS).

**Effort:** 2 days. **Priority:** P1.

---

## 11.5 — Booking Rescheduling

**DB Changes:** Add `rescheduled_from` column to reservations:

```sql
ALTER TABLE reservations ADD COLUMN rescheduled_from UUID REFERENCES reservations(id);
```

**API Changes:**

```typescript
// POST /api/v1/reservations/:id/reschedule
async reschedule(id: string, dto: RescheduleDto, userId: string) {
  // 1. Cancel the old reservation (set status = 'Cancelled', cancel_reason = 'rescheduled')
  // 2. Create new reservation with rescheduled_from = id
  // 3. Return new reservation
}
```

**UI Changes:** Add "Reprogrammer" button in `MyAppointmentsScreen` on Pending reservations.

**Effort:** 2 days. **Priority:** P2.

---

## 11.6 — WhatsApp Integration

**Approach:** Use WhatsApp Business API (via Twilio or direct Meta API) to send booking confirmations.

**Trigger:** After successful booking creation, send a WhatsApp message to both client and barber.

**Implementation:**

```typescript
@OnEvent('reservation.created')
async sendWhatsAppConfirmation(reservation: Reservation) {
  const message = `✅ Votre réservation est confirmée!\n\nSalon: ${reservation.salon.name}\nDate: ${reservation.appointment_date}\nHeure: ${reservation.start_time}\nService: ${reservation.service.service_name}`;
  
  await this.whatsappService.send(reservation.client.phone_number, message);
}
```

**Effort:** 3 days (API integration + templates). **Priority:** P3 (after launch).

---

## 11.7 — Public Barber Profiles

**DB Changes:** Add `slug` column to salons for URL-friendly links:

```sql
ALTER TABLE salons ADD COLUMN slug TEXT UNIQUE;
CREATE INDEX idx_salons_slug ON salons(slug) WHERE slug IS NOT NULL;
```

**API Changes:**
- `GET /api/v1/salons/by-slug/:slug` — public profile endpoint

**Frontend:** Create a Next.js public profile page at `apps/web` (new app), or deep-link to the mobile app using `expo-linking`.

**Effort:** 4 days. **Priority:** P3.

---

# 12. Execution Roadmap

## PHASE 1 — Critical (Week 1–2)

**Goal:** Fix all security vulnerabilities and critical bugs. Nothing else ships until these are done.

| Task | Hours | Dependencies |
|---|---|---|
| Rotate Supabase anon key | 1 | — |
| Remove secrets from git history | 2 | — |
| Fix `is_approved: true` bypass (RLS + mobile) | 3 | — |
| Fix `getClientForUser` service role bug | 2 | — |
| Fix back-button signs-out bug in SalonSetupScreen | 1 | — |
| Add Helmet.js | 1 | — |
| Harden CORS | 1 | — |
| Add rate limiting | 3 | — |
| Add admin portal authentication (middleware + login page) | 6 | — |
| Create `SECURITY.md` | 2 | — |

**Total estimated hours:** ~22 hours  
**Expected outcome:** Platform is no longer exploitable by any anonymous user.

**Risks:**
- Rotating the anon key breaks existing mobile installs. Accept this — send a forced update notice to any TestFlight/Play Console testers.

---

## PHASE 2 — Security & Foundation (Week 3–4)

**Goal:** Complete database foundation, audit logging, and migrate to API-first architecture.

| Task | Hours | Dependencies |
|---|---|---|
| Run database migrations (subscriptions, payments, audit_log, loyalty, blocked_times) | 4 | Phase 1 |
| Implement `AuditService` and wire to admin actions | 4 | DB migrations |
| Migrate `useCreateReservation` to use NestJS | 3 | — |
| Migrate `SalonSetupScreen` to use NestJS | 2 | — |
| Migrate admin portal to use NestJS API | 4 | Admin auth |
| Add phone number validation (DTO + DB constraint) | 2 | — |
| Set up GitHub Actions CI | 3 | — |
| Add health check endpoint | 1 | — |
| Write unit tests for guards and services (80% coverage) | 8 | — |

**Total estimated hours:** ~31 hours  
**Expected outcome:** Consistent API-first data access, audit trail for all admin actions, CI running on every PR.

---

## PHASE 3 — Business Features (Week 5–7)

**Goal:** Complete the subscription + payment system and admin portal. This is the revenue engine.

| Task | Hours | Dependencies |
|---|---|---|
| Implement Chargily integration (checkout + webhook) | 8 | DB migrations |
| Implement subscription scheduler (expiry, warnings) | 4 | Subscriptions DB |
| Complete admin portal (dashboard, subscriptions, revenue) | 12 | Admin auth, NestJS admin endpoints |
| Add sponsored salon management | 4 | Admin portal |
| Implement push notifications | 6 | Expo setup |
| Integration tests for booking and payment flows | 6 | Chargily integration |

**Total estimated hours:** ~40 hours  
**Expected outcome:** Barbers can subscribe and pay. Admin can manage everything. Revenue starts flowing.

---

## PHASE 4 — Growth Features (Week 8–10)

**Goal:** Features that improve retention and marketplace quality.

| Task | Hours | Dependencies |
|---|---|---|
| Loyalty system (DB + API + UI) | 12 | Reservations complete |
| Booking rescheduling | 6 | Reservations complete |
| Blocked times feature | 4 | Blocked times DB |
| RTL/Arabic support | 8 | i18n setup |
| Loading skeleton screens | 4 | — |
| Cancellation flow UX improvements | 3 | — |
| Performance indexes (DB) | 2 | — |
| Performance: FlatList migration, React.memo | 4 | — |
| E2E test suite (Maestro) | 8 | Phase 3 complete |

**Total estimated hours:** ~51 hours  
**Expected outcome:** Polished app with full feature set. Ready for wider public launch.

---

## PHASE 5 — Scale (Week 11+)

**Goal:** Infrastructure and features for growth beyond launch.

| Task | Hours | Dependencies |
|---|---|---|
| Redis cache layer | 6 | Railway Redis service |
| WhatsApp notifications | 8 | Twilio/Meta API account |
| Public barber profile pages (web) | 16 | New Next.js app |
| Disaster recovery runbook | 4 | — |
| Supabase Pro upgrade (PITR, failover) | 2 | Budget approval |
| Sentry error monitoring | 3 | — |
| Structured logging (Winston) | 4 | — |
| Analytics dashboard (PostHog or Mixpanel) | 6 | — |

**Total estimated hours:** ~49 hours  
**Expected outcome:** Production-grade infrastructure. Monitoring and observability. SEO-friendly public profiles for organic growth.

---

## Summary Timeline

| Phase | Duration | Key Outcome |
|---|---|---|
| Phase 1 — Critical | 1–2 weeks | Security vulnerabilities closed |
| Phase 2 — Foundation | 2 weeks | Solid architecture, CI, tests |
| Phase 3 — Business | 3 weeks | Revenue system live |
| Phase 4 — Growth | 3 weeks | Full-featured polished app |
| Phase 5 — Scale | Ongoing | Production-grade platform |

---

## Important Notes for the Executing Developer

1. **Run Phase 1 items in a hotfix branch** — don't merge them as part of a larger PR. They are emergency fixes.

2. **Test every migration on a staging Supabase project first.** The production DB has live data and some migrations (like adding constraints) will fail if existing data violates them. Always run `SELECT * FROM table WHERE constraint_column IS NULL` before adding NOT NULL constraints.

3. **The `oracleJdk-26` directory in the repo root** is a Windows JDK installation that was committed by mistake. Remove it immediately — it adds ~200MB to the repo for no reason:
   ```bash
   git rm -r --cached oracleJdk-26/
   echo "oracleJdk-26/" >> .gitignore
   git commit -m "chore: remove accidentally committed JDK binary"
   ```

4. **`apps/src_backup/` directory** is a stale backup of old source files. Review and delete:
   ```bash
   git rm -r apps/src_backup/
   ```

5. **The `api.ts` file in the mobile app** (`apps/mobile/src/lib/api.ts`) defines endpoints without `/api/v1` prefix and lacks auth header support. Replace it with the typed API client from Section 2.

6. **Never call `this.supabase.adminClient` from a context where RLS should apply.** The admin client bypasses RLS unconditionally. The correct pattern is:
   - `adminClient` → server-side operations initiated by the system (scheduled jobs, webhook handlers)
   - `getClientForUser(token)` → operations initiated by an authenticated user

---

*End of IMPLEMENTATION_PLAN.md*
