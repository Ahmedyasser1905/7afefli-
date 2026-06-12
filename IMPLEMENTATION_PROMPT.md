# 7afefli / BarberDZ — Full Audit Fix & ClientSubscriptionScreen Removal Prompt

## Context

You are working on **7afefli (BarberDZ)**, a multi-platform Algerian barbershop marketplace. The monorepo structure is:

```
apps/
  mobile/src/               ← React Native / Expo (Client, Barber, Admin roles)
    screens/client/
    screens/barber/
    screens/auth/
    screens/admin/
    navigation/             ← AppNavigator, ClientTabNavigator, BarberTabNavigator
    components/
    hooks/
    store/                  ← Zustand stores
    lib/                    ← apiClient, supabase, notifications
  admin/app/                ← Next.js 14 admin panel (Vercel)
services/api/src/           ← NestJS 10 backend (Railway)
  auth/ salons/ reservations/ reviews/ slots/
  subscriptions/ payments/ notifications/ admin/ locations/ audit/
supabase/migrations/        ← PostgreSQL + PostGIS migrations
packages/shared/            ← Shared constants (wilayas, etc.)
```

A full audit has been completed. Your task is to implement **all fixes** from that audit in the exact priority order specified, plus **completely remove `ClientSubscriptionScreen`** across every layer of the stack.

---

## PHASE 0 — ClientSubscriptionScreen: Complete Removal

> Do this first. Every subsequent phase must be free of any reference to this screen.

`ClientSubscriptionScreen` was a dead feature — clients do not subscribe; only barbers (Coiffeurs) do. Both endpoints it called (`GET /subscription-plans` and `POST /payments/initiate`) never existed. It must be deleted without leaving any broken import, navigation link, dead route, orphaned type, or residual DB artifact.

### 0-A  Mobile App

1. **Delete the file** `apps/mobile/src/screens/client/ClientSubscriptionScreen.tsx` (and any `ClientSubscriptionScreen.test.tsx` if present).

2. **Navigation — `ClientTabNavigator`** (or wherever the Client tab stack is defined):
   - Remove the `ClientSubscriptionScreen` screen entry from the navigator stack.
   - Remove any `import` of `ClientSubscriptionScreen`.
   - Remove any route name constant (e.g. `'ClientSubscription'`, `'SubscriptionPlans'`) associated with it from the route types / navigation param list.

3. **Navigation — `AppNavigator` / deep-link config** (`linking` object):
   - Remove any deep-link path mapped to `ClientSubscriptionScreen`.

4. **Any screen that navigates *to* `ClientSubscriptionScreen`** (search all `.tsx` files for `navigate('ClientSubscription'` or similar):
   - Remove the navigation call and any button/menu item that triggered it (e.g. a "Subscribe" banner or menu entry in the Client tab).

5. **TypeScript types**:
   - Open the root navigation param types file (e.g. `RootStackParamList`, `ClientStackParamList`). Remove the `ClientSubscription` (or equivalent) key.
   - Run TypeScript (`tsc --noEmit`) to surface and fix any remaining type errors.

6. **Shared constants / feature flags**: Remove any constant, feature-flag, or condition that referenced client subscription access (e.g. `ENABLE_CLIENT_SUBSCRIPTION`, `canSubscribe` checks on the Client role).

7. **Hooks**: If any hook (e.g. `useClientSubscription`, `useSubscriptionPlans` used exclusively by this screen) exists solely to serve `ClientSubscriptionScreen`, delete it. If a hook is shared with the barber `SubscriptionScreen`, leave it untouched.

8. **Stores (Zustand)**: Remove any Zustand state slice, action, or selector that was introduced specifically for client subscription state. Leave barber subscription state untouched.

9. **`apiClient` / API helper**: Remove any typed API call functions that called `/subscription-plans` or `/payments/initiate` (client-specific variants). Leave `POST /payments/checkout` (Coiffeur-only) untouched.

### 0-B  Backend (NestJS)

1. **`SubscriptionsController`**: Confirm `GET /my-client-plan` route does not exist. If it does, delete the handler and its DTO. Only `GET /plans` and `GET /my-plan` (barber-only, guarded) should remain.

2. **`PaymentsController`**: Confirm `POST /payments/initiate` does not exist. If it does (as a stub or dead route), delete it with its DTO and any service method it called.

3. **`SubscriptionsService`**: Remove any method that was written to serve a client subscription flow (e.g. `getClientPlan()`, `initiateClientPayment()`). Leave all barber subscription methods untouched.

4. **DTOs / interfaces**: Delete any DTO files (e.g. `initiate-payment.dto.ts`, `client-subscription.dto.ts`) that existed only for the client subscription flow.

5. **Swagger decorators**: Ensure no `@ApiOperation` or `@ApiTags` docs remain for the removed routes.

6. **Module imports**: After deleting, confirm `SubscriptionsModule` and `PaymentsModule` compile cleanly (`nest build` or `tsc`).

### 0-C  Database (Supabase / PostgreSQL)

1. **Audit all migrations** for any table, column, RLS policy, function, or trigger introduced exclusively for client subscriptions:
   - Search for: `client_subscription`, `client_plan`, `subscription_plans` (as a separate table from `plans`), `payments_initiate`, or any variant.
   - If any such artifact exists, write a new migration (`supabase/migrations/20260613000000_remove_client_subscription.sql`) that drops it cleanly with `DROP TABLE IF EXISTS`, `DROP FUNCTION IF EXISTS`, `DROP POLICY IF EXISTS`.

2. **RLS policies on `user_subscriptions`**: Verify that no policy inadvertently granted Client-role users write access to `user_subscriptions` as a result of the old feature. Only `Coiffeur` (salon owner) and `Admin` should have write access.

3. **`notifications` table — `notification_type` CHECK constraint**: Verify there is no `client_subscription_*` notification type in the constraint. If present, remove it via migration.

### 0-D  Validation

After all three layers are cleaned:

- [ ] `tsc --noEmit` in `apps/mobile` — zero errors
- [ ] `tsc --noEmit` in `services/api` — zero errors  
- [ ] `tsc --noEmit` in `apps/admin` — zero errors
- [ ] `grep -r "ClientSubscription\|subscription-plans\|payments/initiate\|my-client-plan" apps/ services/ packages/ supabase/` — zero matches
- [ ] Metro bundler (`expo start`) starts without missing module warnings
- [ ] NestJS builds cleanly (`nest build`)

---

## PHASE 1 — Critical Launch Blockers

These two issues prevent the app from working in production. Fix them before anything else.

### 1-A  Idempotent `find_nearby_salons` migration [Issue C-2 / MAP-1]

**Problem:** `find_nearby_salons` is defined in two migrations with incompatible parameter names:
- `20260610000000_critical_fixes.sql` → params: `(user_lat, user_lng, radius_meters, result_limit)`
- `20260610030000_fix_find_nearby_salons.sql` → params: `(p_latitude, p_longitude, p_radius_m, p_limit)`

The NestJS `SalonsService` calls with the second (correct) set of params. If migrations ever run out of order or partially, the RPC silently fails and geolocation degrades.

**Fix:** Create `supabase/migrations/20260613010000_idempotent_find_nearby_salons.sql`:

```sql
-- Drop both possible old signatures unconditionally
DROP FUNCTION IF EXISTS find_nearby_salons(float8, float8, float8, int);
DROP FUNCTION IF EXISTS find_nearby_salons(float8, float8, int, int);
DROP FUNCTION IF EXISTS find_nearby_salons(user_lat float8, user_lng float8, radius_meters float8, result_limit int);
DROP FUNCTION IF EXISTS find_nearby_salons(p_latitude float8, p_longitude float8, p_radius_m float8, p_limit int);

-- Recreate with canonical param names that match NestJS SalonsService
CREATE OR REPLACE FUNCTION find_nearby_salons(
  p_latitude   float8,
  p_longitude  float8,
  p_radius_m   float8 DEFAULT 50000,
  p_limit      int    DEFAULT 20
)
RETURNS TABLE (
  id               uuid,
  name             text,
  average_rating   float8,
  distance_meters  float8,
  is_open          boolean,
  is_sponsored     boolean,
  plan_price       numeric,
  latitude         float8,
  longitude        float8
)
LANGUAGE sql STABLE AS $$
  SELECT
    s.id,
    s.name,
    s.average_rating,
    ST_Distance(
      s.location::geography,
      ST_MakePoint(p_longitude, p_latitude)::geography
    ) AS distance_meters,
    s.is_open,
    s.is_sponsored,
    s.plan_price,
    ST_Y(s.location::geometry) AS latitude,
    ST_X(s.location::geometry) AS longitude
  FROM salons s
  WHERE
    s.is_approved = true
    AND s.is_manually_closed = false
    AND s.location IS NOT NULL
    AND ST_DWithin(
      s.location::geography,
      ST_MakePoint(p_longitude, p_latitude)::geography,
      p_radius_m
    )
  ORDER BY s.is_sponsored DESC, s.plan_price DESC, distance_meters ASC
  LIMIT p_limit;
$$;
```

Also add a comment header to `20260610000000_critical_fixes.sql`:
```sql
-- NOTE: find_nearby_salons defined here is superseded by 20260613010000.
-- Do not re-apply this definition independently.
```

### 1-B  `CHARGILY_WEBHOOK_URL` environment variable [Issue DEVOPS-1]

**Problem:** Chargily Pay requires a publicly reachable webhook URL to POST payment confirmations to. Without `CHARGILY_WEBHOOK_URL` set, subscriptions never activate after payment.

**Fix — two parts:**

**Part 1 — Add to `validateEnvironment()`** in `services/api/src/config/env.validation.ts` (or equivalent):
```typescript
// Add to the production-required vars check:
if (process.env.NODE_ENV === 'production' && !process.env.CHARGILY_WEBHOOK_URL) {
  throw new Error('CHARGILY_WEBHOOK_URL is required in production');
}
```

**Part 2 — Add to `.env.example`:**
```env
# Chargily Pay (required in production)
CHARGILY_WEBHOOK_URL=https://your-railway-api-url.railway.app/api/v1/payments/webhook
PAYMENT_SUCCESS_URL=https://your-railway-api-url.railway.app/api/v1/payments/success
PAYMENT_FAILURE_URL=https://your-railway-api-url.railway.app/api/v1/payments/failure
```

**Part 3 — Set on Railway:** Document this in `README.md` under "Required Environment Variables" so it is not skipped during deployment.

---

## PHASE 2 — Security Fixes

### 2-A  Harden AppNavigator profile auto-create [Issue H-3 / AUTH-3]

**File:** `apps/mobile/src/navigation/AppNavigator.tsx`

**Problem:** When auto-creating a missing profile row, the code reads `user.user_metadata.role`. An attacker who crafts a signup request with `role: 'Admin'` in their metadata would get that role persisted.

**Fix:** Find the profile auto-create block and hardcode the role:
```typescript
// BEFORE (vulnerable):
role: user.user_metadata?.role ?? 'Client'

// AFTER (hardened):
role: 'Client'  // Never trust client-provided metadata for role assignment
```

### 2-B  Per-email rate limiting on auth endpoints [Issues AUTH-1, M-4]

**File:** `services/api/src/auth/auth.controller.ts`

**Problem:** `POST /auth/resend-verification` and `POST /auth/reset-password` only have the global 100 req/min throttler. An attacker can spam either endpoint to any email address.

**Fix:** Apply a dedicated per-email `@Throttle` decorator on both endpoints. If `@nestjs/throttler` supports key-based throttling, use the email from the request body as the throttle key. Otherwise implement a simple in-memory map:

```typescript
// In AuthController, add a private in-memory rate limiter:
private readonly emailRateLimiter = new Map<string, { count: number; resetAt: number }>();

private checkEmailRateLimit(email: string, maxPerHour = 5): void {
  const now = Date.now();
  const entry = this.emailRateLimiter.get(email);
  if (entry && now < entry.resetAt) {
    if (entry.count >= maxPerHour) {
      throw new ThrottlerException();
    }
    entry.count++;
  } else {
    this.emailRateLimiter.set(email, { count: 1, resetAt: now + 3600_000 });
  }
}
```

Call `this.checkEmailRateLimit(dto.email)` at the top of both `resendVerification()` and `resetPassword()` handlers.

### 2-C  Confirm portfolio_photos RLS [Issue M-5 / C-7]

**Problem:** `portfolio_photos` RLS status is not visible in any migration. If RLS is disabled, any authenticated user can delete any photo by ID.

**Fix:** Create `supabase/migrations/20260613020000_portfolio_photos_rls.sql`:

```sql
-- Enable RLS (idempotent)
ALTER TABLE portfolio_photos ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can view portfolio photos of approved salons
CREATE POLICY IF NOT EXISTS "portfolio_photos_public_read"
ON portfolio_photos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM salons s
    WHERE s.id = portfolio_photos.salon_id AND s.is_approved = true
  )
);

-- Owner write: only the salon owner can insert/update/delete their photos
CREATE POLICY IF NOT EXISTS "portfolio_photos_owner_write"
ON portfolio_photos FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM salons s
    WHERE s.id = portfolio_photos.salon_id AND s.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM salons s
    WHERE s.id = portfolio_photos.salon_id AND s.owner_id = auth.uid()
  )
);

-- Service role bypass for admin operations
CREATE POLICY IF NOT EXISTS "portfolio_photos_service_role_all"
ON portfolio_photos FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

---

## PHASE 3 — Database Fixes

### 3-A  Add missing performance indexes [Issues H-2, C-5, C-6]

**File:** `supabase/migrations/20260613030000_add_missing_indexes.sql`

```sql
-- Barber dashboard: findByOwner, getSalonClients, join patterns
CREATE INDEX IF NOT EXISTS idx_salons_owner_id ON salons(owner_id);

-- Admin queries and RLS policies on role column
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Bonus: speed up pending salon approvals
CREATE INDEX IF NOT EXISTS idx_salons_pending_approval 
  ON salons(is_approved, created_at DESC) 
  WHERE is_approved = false;
```

### 3-B  Supersede the broken first migration [Issue C-1]

`20260609140000_audit_fixes.sql` has a broken `check_reservation_overlap` trigger (wrong column `date` instead of `appointment_date`, wrong status values). It is overwritten by `20260610000000_critical_fixes.sql` if migrations run in order, but this is fragile.

**Fix:** Add a comment block at the top of `20260609140000_audit_fixes.sql`:
```sql
-- ⚠️  SUPERSEDED: This migration's check_reservation_overlap trigger used
-- the wrong column name (date) and wrong status values.
-- The correct trigger is defined in 20260610000000_critical_fixes.sql.
-- This file is kept for migration history only. Do not re-run independently.
```

Then create `supabase/migrations/20260613040000_drop_stale_force_closed_column.sql` to clean up the orphaned column reference [Issue C-4]:
```sql
ALTER TABLE salons DROP COLUMN IF EXISTS force_closed;
```

### 3-C  Standardize `average_rating` naming [Issue C-3 / L-12]

**Problem:** `find_nearby_salons` historically returned a column named `rating`, but the actual table column is `average_rating`. `SalonsService` compensates with `s.average_rating ?? s.rating ?? null`.

**Fix:** The idempotent RPC in Phase 1-A already returns `average_rating`. Now clean up `SalonsService`:
```typescript
// Remove the fallback chain — just use average_rating directly:
// BEFORE: rating: s.average_rating ?? s.rating ?? null
// AFTER:  average_rating: s.average_rating ?? null
```

Update any frontend component that reads `.rating` from a salon object returned by `find_nearby_salons` to read `.average_rating` instead.

### 3-D  Loyalty points config [Issue B-1 / L-1]

**Problem:** `GET /auth/profiles/me/loyalty` returns `points: 10` hardcoded per reservation.

**Fix — two options (choose one):**

**Option A (DB config — recommended):** Add a `settings` table or `app_config` row:
```sql
-- supabase/migrations/20260613050000_app_config.sql
CREATE TABLE IF NOT EXISTS app_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);
INSERT INTO app_config (key, value) VALUES ('loyalty_points_per_reservation', '10')
  ON CONFLICT (key) DO NOTHING;
```
Then in `AuthService`, read this value at startup (cache it) and use it in the loyalty calculation.

**Option B (env var — simpler):** Add `LOYALTY_POINTS_PER_RESERVATION=10` to `.env` and `validateEnvironment()`, then read via `ConfigService` in the auth service.

---

## PHASE 4 — Backend Fixes

### 4-A  Refactor `ReservationsService` [Issues B-3, M-6]

`ReservationsService` is 1,066 lines and handles creation, slot locking, blocking, status updates, cron expiry, and client aggregation. Split into three focused services:

**Target files:**
- `services/api/src/reservations/reservations-creation.service.ts` — `create()`, slot locking logic, `createWalkIn()`
- `services/api/src/reservations/reservations-query.service.ts` — `findAll()`, `findOne()`, `getClients()`, `getSalonReservations()`
- `services/api/src/reservations/reservations-cron.service.ts` — `@Cron` expiry, auto-cancel tasks

**Steps:**
1. Create the three new service files, moving the relevant methods.
2. Reduce the join width in `create()`: instead of `subscriptions:user_subscriptions(status, plans(*))`, perform a separate targeted lookup for subscription quota data only when needed (cache the result per salon for 5 minutes using the existing Redis pattern from `SlotsService`).
3. Update `ReservationsModule` to provide all three services.
4. Update `ReservationsController` to inject the correct sub-service for each route.
5. Keep the original `reservations.service.ts` as a thin facade that re-exports from the three sub-services (or delete it if all consumers are updated).

### 4-B  Admin panel: fix payments page to use API [Issue INT-1, M-7]

**File:** `apps/admin/app/payments/page.tsx`

**Problem:** This page queries Supabase directly with the anon key, bypassing the API and its business logic layer.

**Fix:**
1. Add `GET /admin/payments` to `AdminController` in the NestJS backend:
```typescript
@Get('payments')
@Roles('Admin')
async getPayments(
  @Query('page') page = 1,
  @Query('limit') limit = 50,
) {
  return this.adminService.getPayments({ page, limit });
}
```
2. Implement `AdminService.getPayments()` using the Supabase admin client (service role), returning paginated payment records with joined salon and user data.
3. In `apps/admin/app/payments/page.tsx`, replace the direct Supabase call with `apiFetch('/admin/payments?page=1&limit=50')` (using the existing `apiFetch` helper).

### 4-C  Fix cron timezone [Issue M-9 / SUB-2]

**File:** `services/api/src/subscriptions/subscriptions.service.ts`

**Problem:** `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)` runs in Railway UTC. Algeria is UTC+1, so midnight local time is missed by 1 hour.

**Fix:**
```typescript
// Change from:
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)

// Change to (runs at 23:00 UTC = 00:00 Algeria time):
@Cron('0 23 * * *', { timeZone: 'Africa/Algiers' })
```

### 4-D  Extend AuditService coverage [Issue B-2]

**Problem:** `AuditService` only logs Admin actions. Owner mutations (salon creation, service changes, staff changes) are not logged.

**Fix:** Inject `AuditService` into `SalonsService`. Add audit log calls at the end of:
- `createSalon()` — log `{ action: 'salon.created', actorId, salonId }`
- `deleteSalon()` — log `{ action: 'salon.deleted', actorId, salonId }`
- `addService()` / `removeService()` — log `{ action: 'salon.service.added/removed', ... }`

Use the existing `AuditService.log()` signature; do not change the audit table schema.

### 4-E  Add `/health` endpoint [Issue L-9 / DEVOPS-3]

**File:** `services/api/src/app.controller.ts`

```typescript
@Get('health')
@Public() // no auth required
health() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  };
}
```

Railway health-check path: set to `/health` in Railway dashboard.

---

## PHASE 5 — Mobile Frontend Fixes

### 5-A  Decompose DashboardScreen [Issues A-4, M-10]

**File:** `apps/mobile/src/screens/barber/DashboardScreen.tsx` (currently 1,370 lines)

Extract the following into separate component files under `apps/mobile/src/screens/barber/dashboard/`:

- `DashboardStats.tsx` — day/month/all stats cards
- `ReservationsList.tsx` — the scrollable list of reservations with status chips
- `DashboardModals.tsx` — `AddWalkInModal`, `BlockTimeModal`, `ReservationDetailModal` (re-export from existing modal components or keep inline if small)
- `DashboardHeader.tsx` — salon name, date selector, open/close toggle

`DashboardScreen.tsx` becomes a slim orchestrator:
```typescript
export default function DashboardScreen() {
  // state and data-fetching hooks only
  return (
    <View>
      <DashboardHeader ... />
      <DashboardStats ... />
      <ReservationsList ... />
      <DashboardModals ... />
    </View>
  );
}
```

### 5-B  Cursor-based pagination for ExploreScreen [Issue A-2, M-1]

**File:** `apps/mobile/src/screens/client/ExploreScreen.tsx`

**Problem:** `GET /salons?limit=200&wilaya=` fetches all salons at once.

**Fix:**
1. Backend: Ensure `GET /salons` supports `cursor` query param (use `created_at` as cursor column). If not already implemented, update `SalonsController` and `SalonsService.findAll()` to accept and return a `nextCursor` field.
2. Frontend: Replace the single fetch with an `onEndReached` infinite-scroll pattern using React Query's `useInfiniteQuery`:
```typescript
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteQuery({
  queryKey: ['salons', wilaya, search],
  queryFn: ({ pageParam }) =>
    apiClient.get(`/salons?wilaya=${wilaya}&cursor=${pageParam}&limit=20`),
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
});
```
3. The FlatList `onEndReached` should call `fetchNextPage()` when `hasNextPage` is true.

### 5-C  Fix SettingsScreen wilaya list [Issue A-3, L-2]

**File:** `apps/mobile/src/screens/client/SettingsScreen.tsx`

Replace the hardcoded 58-wilaya array with an import:
```typescript
// Remove the local array, replace with:
import { WILAYAS } from '@barberdz/shared/constants/wilayas';
```

Ensure `packages/shared/constants/wilayas.ts` exports both the array and the type that `SettingsScreen` needs. If it doesn't already, add the export there.

### 5-D  Harden SalonSetupScreen coordinates [Issue A-5, M-3, COIF-1]

**File:** `apps/mobile/src/screens/barber/SalonSetupScreen.tsx`

**Problem:** A salon can be submitted with default Algiers coordinates (36.7538, 3.0588) if the user skips the map step.

**Fix:** Block form submission if coordinates are still at the default:
```typescript
const DEFAULT_LAT = 36.7538;
const DEFAULT_LNG = 3.0588;

const handleSubmit = () => {
  if (
    !coordsChosen ||
    (latitude === DEFAULT_LAT && longitude === DEFAULT_LNG)
  ) {
    Alert.alert(
      'Position requise',
      'Veuillez placer votre salon sur la carte avant de continuer.'
    );
    return;
  }
  // proceed with submission
};
```

### 5-E  Add realtime for client booking status [Issue L-5, RT-2]

**File:** `apps/mobile/src/screens/client/MyAppointmentsScreen.tsx`

**Problem:** Client must manually pull-to-refresh to see booking status changes.

**Fix:** Subscribe to `postgres_changes` on the `reservations` table filtered by `client_id`:
```typescript
useEffect(() => {
  const channel = supabase
    .channel(`client-reservations:${user.id}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'reservations',
        filter: `client_id=eq.${user.id}`,
      },
      (payload) => {
        queryClient.invalidateQueries({ queryKey: ['reservations', 'me'] });
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [user.id]);
```

### 5-F  Singleton realtime hook for barber tabs [Issue L-4, RT-1]

**Problem:** `DashboardScreen` and `CalendarScreen` both instantiate `useRealtimeBookings`, creating two concurrent Supabase Realtime subscriptions to the same data.

**Fix:** Create a shared React context:
```typescript
// apps/mobile/src/contexts/RealtimeBookingsContext.tsx
const RealtimeBookingsContext = createContext(null);

export function RealtimeBookingsProvider({ salonId, children }) {
  // move the useRealtimeBookings logic here — single subscription
  const bookings = useRealtimeBookingsInternal(salonId);
  return (
    <RealtimeBookingsContext.Provider value={bookings}>
      {children}
    </RealtimeBookingsContext.Provider>
  );
}

export const useRealtimeBookings = () => useContext(RealtimeBookingsContext);
```

Wrap the `BarberTabNavigator` (or the barber stack root) in `<RealtimeBookingsProvider salonId={salon.id}>`. Both `DashboardScreen` and `CalendarScreen` then consume the single shared context.

### 5-G  Loyalty points push notification [Issue L-7, NOTIF-1]

**Problem:** No notification is sent when a client earns loyalty points, despite `loyalty_points` being a valid `notification_type` in the DB schema.

**Fix — Backend** (`services/api/src/reservations/reservations-cron.service.ts` or wherever reservation status is set to `Completed`):

When a reservation transitions to status `Completed`, after the loyalty trigger fires, send a notification:
```typescript
await this.notificationsService.create({
  userId: reservation.client_id,
  type: 'loyalty_points',
  title: 'Points de fidélité gagnés !',
  body: `Vous avez gagné ${LOYALTY_POINTS} points pour votre visite.`,
  data: { reservationId: reservation.id },
});
```

### 5-H  Consolidate PhoneEntryScreen / PhoneInputScreen [Issue A-1, L-3]

**Problem:** Two screens handle phone entry for different flows but share near-identical UI.

**Fix:** Create a shared component:
```typescript
// apps/mobile/src/components/auth/PhoneInputForm.tsx
interface PhoneInputFormProps {
  mode: 'login' | 'post-signup';
  onSubmit: (phone: string) => void;
  title: string;
  subtitle?: string;
}
export function PhoneInputForm({ mode, onSubmit, title, subtitle }: PhoneInputFormProps) { ... }
```

Update `PhoneInputScreen` and `PhoneEntryScreen` to use `<PhoneInputForm>` with their respective `mode` prop. Do not delete either screen file — they handle different navigation flows — but eliminate duplicated UI code.

---

## PHASE 6 — Admin Panel Fixes (Next.js)

### 6-A  Admin Reviews moderation page [Issues H-1, ADMIN-1]

**File:** `apps/admin/app/reviews/page.tsx` (new file)

Create a new page that:
1. Fetches all reviews from `GET /reviews` (add `?all=true&adminOverride=true` or use a dedicated `GET /admin/reviews` endpoint — add to `AdminController` if it doesn't exist).
2. Displays them in a table: reviewer name, salon name, rating, body text, date.
3. Each row has a **Delete** button that calls `DELETE /reviews/:id` with the admin JWT.
4. Add to the admin nav sidebar: `Reviews`.
5. Add to `apps/admin/middleware.ts` (if route protection exists): protect `/reviews` with admin role check.

Backend: If `GET /admin/reviews` does not exist, add to `AdminController`:
```typescript
@Get('reviews')
@Roles('Admin')
getReviews(@Query('page') page = 1, @Query('limit') limit = 50) {
  return this.adminService.getAllReviews({ page, limit });
}
```

### 6-B  Admin Plans CRUD page [Issues M-2, ADMIN-2]

**File:** `apps/admin/app/plans/page.tsx` (new file)

Create a page that:
1. Lists all plans from `GET /subscriptions/plans`.
2. Allows editing plan `name`, `price`, `max_barbers`, `max_portfolio_photos`, `max_reservations`, `duration_days`.
3. Uses `PATCH /admin/plans/:id` (add to `AdminController`) for updates.
4. Add to the admin nav sidebar: `Plans`.

Backend — add to `AdminController`:
```typescript
@Patch('plans/:id')
@Roles('Admin')
updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
  return this.adminService.updatePlan(id, dto);
}
```

### 6-C  Admin Analytics page [Missing Feature 3]

**File:** `apps/admin/app/analytics/page.tsx` (new file)

The endpoint `GET /admin/analytics` already exists. Create a page that:
1. Fetches analytics data on mount.
2. Renders: total bookings chart (by day/week/month), revenue by wilaya, top-performing salons, new user signups trend.
3. Use a simple charting library already present (or add `recharts` which is lightweight).
4. Add to the admin nav sidebar: `Analytics`.

### 6-D  Fix admin reservations pagination [Issue INT-2]

**File:** `apps/admin/app/reservations/page.tsx`

Add `page` and `limit` query params to the API call:
```typescript
// BEFORE:
const data = await apiFetch('/admin/reservations');

// AFTER:
const data = await apiFetch(`/admin/reservations?page=${currentPage}&limit=50`);
```

Implement pagination UI (prev/next buttons) using the total count returned by the API.

### 6-E  Add salon sponsoring to admin panel [Top-50 Item 38]

**File:** `apps/admin/app/salons/page.tsx` (or a detail modal)

The mobile `AdminDashboardScreen` already has sponsor/unsponsor. Expose the same in the Next.js panel:
1. Add a **Sponsor** toggle button to each salon row in the admin salons list.
2. On toggle, call `PATCH /admin/salons/:id` with `{ is_sponsored: true/false }`.

### 6-F  Add `NEXT_PUBLIC_API_URL` validation [Top-50 Item 35]

**File:** `apps/admin/app/layout.tsx` or a startup utility:
```typescript
if (!process.env.NEXT_PUBLIC_API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is not set. Admin panel cannot start.');
}
```

Also add it to `apps/admin/.env.example`.

---

## PHASE 7 — DevOps & Infrastructure

### 7-A  Add Dockerfile [Issue M-8 / DEVOPS-2]

**File:** `services/api/Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

**File:** `services/api/.dockerignore`
```
node_modules
dist
.env
*.md
```

### 7-B  Move planning docs [Issue L-10, CQ-2]

Move the 14 planning/audit markdown files from the repo root to a `docs/` directory:
```bash
mkdir -p docs
git mv IMPLEMENTATION_PLAN.md docs/
git mv barber-marketplace-plan.md docs/
git mv barberdz-frontend-plan.md docs/
# ... repeat for all *.md files except README.md
```

Add `docs/` to `.gitignore` on the production branch (or keep in a separate `docs` branch).

---

## PHASE 8 — Code Quality

### 8-A  Eliminate `any` types in core services [Issues CQ-1, L-13]

In the following files, replace `any` with proper TypeScript interfaces. Do not change runtime behavior — only add types.

**`services/api/src/salons/salons.service.ts`:**
```typescript
// Define:
interface SalonRow { id: string; name: string; owner_id: string; average_rating: number | null; /* ... */ }
interface EnrichedSalon extends SalonRow { is_currently_open: boolean; plan_price: number; }
// Replace: any → SalonRow | EnrichedSalon as appropriate
```

**`services/api/src/reservations/` (all three new services from Phase 4-A):**
```typescript
interface ReservationRow { id: string; client_id: string; salon_id: string; appointment_date: string; status: ReservationStatus; /* ... */ }
type ReservationStatus = 'Pending' | 'Confirmed' | 'Cancelled' | 'Completed' | 'Rejected';
```

**`services/api/src/admin/admin.service.ts`:**
```typescript
interface AdminUserRow { id: string; email: string; role: UserRole; is_banned: boolean; created_at: string; }
interface AdminSalonRow extends SalonRow { is_approved: boolean; owner_email: string; }
```

After changes, run `tsc --noEmit` in `services/api` — zero errors required.

---

## PHASE 9 — Notifications & Realtime Polish

### 9-A  Server-side appointment reminders [Issue L-8, NOTIF-2]

**Problem:** `scheduleAppointmentReminder()` is client-side only. If the device reboots or the app is uninstalled, the reminder is lost.

**Fix:** Add a cron job in `services/api/src/reservations/reservations-cron.service.ts`:

```typescript
// Runs every hour
@Cron('0 * * * *', { timeZone: 'Africa/Algiers' })
async sendAppointmentReminders() {
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const windowStart = new Date(in24h.getTime() - 30 * 60 * 1000); // ±30 min window
  
  const { data: upcoming } = await this.supabase
    .from('reservations')
    .select('id, client_id, appointment_date, salons(name)')
    .eq('status', 'Confirmed')
    .gte('appointment_date', windowStart.toISOString())
    .lte('appointment_date', in24h.toISOString());

  for (const reservation of upcoming ?? []) {
    await this.notificationsService.create({
      userId: reservation.client_id,
      type: 'appointment_reminder',
      title: 'Rappel de rendez-vous',
      body: `Votre rendez-vous chez ${reservation.salons.name} est dans 24h.`,
      data: { reservationId: reservation.id },
    });
  }
}
```

Ensure `appointment_reminder` is a valid value in the `notification_type` CHECK constraint. If not, add it via migration.

### 9-B  Map auto-refresh on salon toggle [Issue MAP-2, Top-50 Item 39]

**File:** `apps/mobile/src/components/map/SalonMapView.tsx` (or the screen that hosts it)

When the open/close toggle fires (PATCH to salon), invalidate the salon query so `SalonMapView` re-renders with the updated `is_open` state:
```typescript
// In EditSalonModal or wherever the toggle is handled:
await apiClient.patch(`/salons/${salonId}`, { is_manually_closed: !isOpen });
queryClient.invalidateQueries({ queryKey: ['salon', salonId] });
queryClient.invalidateQueries({ queryKey: ['nearbySalons'] });
```

---

## PHASE 10 — Final Validation Checklist

Run all of the following before considering the implementation complete. Every item must pass with zero errors/warnings.

### Database
- [ ] `supabase db push` (or equivalent migration runner) applies all new migrations cleanly in order
- [ ] `find_nearby_salons` RPC exists with params `(p_latitude, p_longitude, p_radius_m, p_limit)` and returns `average_rating`
- [ ] `salons(owner_id)` index exists
- [ ] `profiles(role)` index exists
- [ ] `portfolio_photos` has RLS enabled with correct owner-write policy
- [ ] `force_closed` column is absent from `salons`
- [ ] `user_subscriptions` has no Client-role write policy
- [ ] Zero references to `ClientSubscription`, `subscription-plans`, or `payments/initiate` in DB schema or functions

### Backend (NestJS)
- [ ] `nest build` — zero errors
- [ ] `tsc --noEmit` in `services/api` — zero errors
- [ ] `GET /health` returns `{ status: 'ok', timestamp, uptime, environment }`
- [ ] `POST /payments/initiate` route does NOT exist (curl returns 404)
- [ ] `GET /subscriptions/my-client-plan` route does NOT exist (curl returns 404)
- [ ] `POST /auth/resend-verification` with same email 6 times in 1 hour → 429 on 6th attempt
- [ ] `POST /payments/checkout` with `role: 'Client'` → 403 Forbidden
- [ ] `GET /admin/reviews` returns paginated reviews when called with Admin JWT
- [ ] `GET /admin/payments` returns paginated payments when called with Admin JWT
- [ ] Cron expression for subscription expiry is `'0 23 * * *'` with `timeZone: 'Africa/Algiers'`
- [ ] `ReservationsService` is split into three focused files; module compiles cleanly

### Mobile App (React Native / Expo)
- [ ] `tsc --noEmit` in `apps/mobile` — zero errors
- [ ] `expo start` — no "Could not resolve module" warnings in Metro
- [ ] `grep -r "ClientSubscription" apps/mobile/` — zero matches
- [ ] `grep -r "subscription-plans\|payments/initiate\|my-client-plan" apps/mobile/` — zero matches
- [ ] Client tab navigator has no `ClientSubscription` screen
- [ ] `AppNavigator` profile auto-create hardcodes `role: 'Client'`
- [ ] `ExploreScreen` uses infinite scroll (no `limit=200` in any request)
- [ ] `SettingsScreen` imports wilayas from `@barberdz/shared/constants/wilayas`
- [ ] `SalonSetupScreen` blocks submission if coordinates are still at default Algiers values
- [ ] `MyAppointmentsScreen` has a Supabase Realtime subscription active while mounted
- [ ] `DashboardScreen` file is under 300 lines (logic extracted to sub-components)
- [ ] Only one Supabase Realtime subscription is active when both barber tabs (Dashboard + Calendar) are visible

### Admin Panel (Next.js)
- [ ] `tsc --noEmit` in `apps/admin` — zero errors
- [ ] `next build` — zero errors
- [ ] `/reviews` page renders, lists reviews, Delete button calls API not Supabase directly
- [ ] `/plans` page renders, allows editing plan values
- [ ] `/analytics` page renders charts from `GET /admin/analytics`
- [ ] `/payments` page fetches from `GET /admin/payments` (API), not direct Supabase
- [ ] `/reservations` page passes `page` and `limit` to the API call
- [ ] `grep -r "ClientSubscription" apps/admin/` — zero matches

### Security Spot-checks
- [ ] Sign up with `{ role: 'Admin' }` in user metadata → profile is created with `role: 'Client'`
- [ ] Attempt to delete another user's portfolio photo → 403 / RLS violation
- [ ] Send `POST /auth/resend-verification` with same email 6 times → throttled on 6th

### Grep for leftover references (must all return zero matches)
```bash
grep -r "ClientSubscription" apps/ services/ packages/ supabase/
grep -r "subscription-plans" apps/ services/ packages/ supabase/
grep -r "payments/initiate" apps/ services/ packages/ supabase/
grep -r "my-client-plan" apps/ services/ packages/ supabase/
grep -r "getClientPlan\|initiateClientPayment" apps/ services/ packages/
```

---

## Implementation Notes

**Do not skip phases.** Each phase assumes the previous one is complete. Phase 0 (removal) must run first so no other fix accidentally re-introduces a reference.

**Migration naming:** All new migrations must be named `20260613XXXXXX_description.sql` with a timestamp after `20260612000000_payments_rls.sql` (the last existing migration). Use sequential suffixes: `000000`, `010000`, `020000`, etc.

**Do not touch working code:** The following are confirmed working and must not be regressed:
- Booking flow (4-step wizard)
- Barber `SubscriptionScreen` (plans list, checkout via Chargily)
- Payment webhook HMAC verification
- Supabase RLS on `reservations`, `reviews`, `user_subscriptions`, `payments`
- Redis slot cache and invalidation
- `check_reservation_overlap` trigger in `20260610000000_critical_fixes.sql`
- All existing auth flows (OTP, email/password, reset, verify)

**After all phases are complete, re-run the full validation checklist in Phase 10.** Production readiness should reach 85+/100 and project completion should reach 90%+.
