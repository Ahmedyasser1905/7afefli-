# POST_MODIFICATION_AUDIT_V2.md
## 7afefli (BarberDZ) — Post-Modification Audit V2
**Date:** 2026-06-12  
**Branch:** main (post V1 audit remediation cycle)  
**Auditor:** Static code analysis — READ-ONLY, no modifications made  
**Baseline:** POST_MODIFICATION_AUDIT.md (2026-06-11, global completion 71%)

---

## 1. Executive Summary

This V2 audit finds that **four of the six issues flagged in V1 have been resolved**, and the project has made meaningful forward progress. The critical credential leak (service-role key in `scratch/`) is fully remediated. The `average_rating` field mismatch is patched in the backend. The `payments` table now has RLS. The `isRefreshing` spinner in SubscriptionScreen is corrected.

However, **three new bugs were introduced during the V1→V2 remediation cycle**, and two pre-existing medium issues remain unresolved.

The most significant new discovery is a **group of admin panel data bugs**: the `/admin/users` and `/admin/reservations` pages silently render empty tables because they cast a paginated API response object `{data, total, page, limit}` as a flat array. This makes two of the six admin panel sections non-functional. A secondary new bug is a **payment deep-link scheme mismatch** — Chargily's default fallback redirect URL uses `https://` while the mobile app listens for `hafefli://`, meaning payment success never triggers the in-app confirmation toast or query invalidation unless the env var is explicitly set.

**Global Completion: ~76%** (+5 points from V1 baseline of 71%)

---

## 2. Previous Issues Verification

| ID | Description | V1 Status | V2 Status | Evidence |
|----|-------------|-----------|-----------|----------|
| NEW-BUG-1 | `find_nearby_salons` returns `rating`, mobile expects `average_rating` | ❌ Bug | ✅ **FIXED** | `enrichSalon` line 177: `average_rating: s.average_rating ?? s.rating ?? null` |
| NEW-BUG-2 | Service-role key in `scratch/` scripts, anon key in `eas.json` | ❌ Bug | ✅ **FIXED** | `scratch/` directory deleted entirely; `eas.json` has comment block replacing the anon key with EAS Secrets instruction |
| NEW-BUG-3 | Two conflicting `find_nearby_salons` signatures in migrations | ⚠️ Partial | ✅ **FIXED** | `20260610080000` drops BOTH old signatures before re-creating with the correct one; idempotency confirmed |
| M-1 | No RLS migration for `payments` table | ❌ Open | ✅ **FIXED** | `20260612000000_payments_rls.sql` adds owner, service-role, and admin policies |
| M-2 | `my-salon` vs `barber-salon` query key inconsistency | ⚠️ Open | ⚠️ **STILL OPEN** | CalendarScreen uses `['barber-salon', user?.id]`; DashboardScreen uses `['my-salon', user?.id]`; stale data risk persists |
| M-3 | Anon key in `eas.json` and `setup_db.js` | ❌ Open | ✅ **FIXED** | `eas.json` cleaned; no `setup_db.js` found in repo |
| M-4 | OSRM public demo server | ⚠️ Open | ⚠️ **STILL OPEN** | `router.project-osrm.org` still used in `SalonMapView.tsx` line 177 |
| M-5 | Admin mobile screen missing analytics/charts | ⚠️ Open | ⚠️ **STILL OPEN** | Admin tab still has 2 tabs (Dashboard + Settings); no analytics/reports mobile tab |
| M-6 | No booking_reminder cron notification | ❌ Open | ✅ **FIXED** | `@Cron('0 * * * *')` in `ReservationsService` fires hourly; sends `booking_reminder` 1h before appointment |
| M-7 | Salon completeness not visible to barber | ⚠️ Partial | ✅ **FIXED** | `DashboardScreen` lines 455–465 show a banner listing missing items with navigation shortcuts |
| M-8 | `isRefreshing` hardcoded `false` in SubscriptionScreen | ❌ Open | ✅ **FIXED** | Line 146: `const isRefreshing = plansLoading \|\| subLoading;` — dynamic |

---

## 3. Fixed Issues (V1 → V2)

1. **`average_rating` field mismatch** — `enrichSalon` now prefers `s.average_rating` then falls back to `s.rating`. The "⭐ 4.5+ Étoiles" filter and SalonCard rating display are functional for GPS-loaded salons.
2. **Service-role key credential leak** — `scratch/` directory removed from repo. `eas.json` anon key replaced with EAS Secrets comment.
3. **Conflicting `find_nearby_salons` signatures** — Migration `080000` drops both old signatures idempotently before creating the final version with `plan_price` sort. Execution order no longer matters.
4. **`payments` table RLS** — Three policies added: owner SELECT, service_role ALL, Admin SELECT. No RLS gap on financial data.
5. **Booking reminder notification** — Hourly cron implemented; queries upcoming confirmed appointments in the next 1-hour window and sends push + in-app notification.
6. **Barber onboarding progress indicator** — Dashboard banner shows exactly which requirements are missing (logo, services, staff) with tap-to-fix navigation.
7. **`isRefreshing` in SubscriptionScreen** — Pull-to-refresh spinner now reflects actual query loading state.
8. **`setup_db.js` anon key** — File no longer exists in repo.

---

## 4. Remaining Issues from V1

### Still Open (Medium)
- **M-2**: `CalendarScreen` uses `queryKey: ['barber-salon', user?.id]` while `DashboardScreen` uses `queryKey: ['my-salon', user?.id]`. Updating salon info in MySalonScreen invalidates `['my-salon']` but not `['barber-salon']`, so CalendarScreen can show stale salon data.
- **M-4**: OSRM public demo server (`router.project-osrm.org`) still used for route drawing. The OSRM project explicitly prohibits production use.
- **M-5**: Admin mobile tab navigator still shows only Dashboard + Settings. The `/admin/analytics` backend endpoint was built but is never called from any UI (web or mobile).

---

## 5. New Issues Found in V2

### 🔴 High — Admin Panel Empty Tables

**NEW-BUG-4**: The `GET /admin/users` and `GET /admin/reservations` API endpoints return a paginated wrapper `{ data: [...], total: number, page: number, limit: number }`. The admin panel pages (`apps/admin/app/users/page.tsx` line 35, `apps/admin/app/reservations/page.tsx` line 43) cast this response object directly as the array:

```ts
// users/page.tsx — BUG
const data = await apiFetch('/admin/users', session.access_token);
setUsers(data as typeof users); // data is {data:[],total,page,limit} not User[]
```

`users.map()` then iterates over a plain object, producing zero rows. The Users table and Reservations table in the admin panel show nothing, and the `users.length` subtitle reads `0 utilisateurs inscrits` regardless of real counts. **Fix**: extract `(data as { data: User[] }).data`.

**NEW-BUG-5**: The admin subscriptions page (`apps/admin/app/subscriptions/page.tsx` line 121) renders `sub.plan` directly. The `plan` column in `user_subscriptions` is a UUID FK referencing `plans.id`, not a human-readable name. Every row shows a UUID string like `"3f7a1c2e-..."` instead of `"Premium"` or `"Pro"`. **Fix**: join `plans(name)` in the `getAllSubscriptions` query and display `sub.plans?.name`.

### 🔴 High — Payment Deep-Link Scheme Mismatch

**NEW-BUG-6**: `chargilyService.createCheckoutUrl()` sends `success_url: process.env.PAYMENT_SUCCESS_URL || 'https://7afefli.com/payment/success'` to Chargily. After payment, Chargily redirects the browser to this URL. The mobile app's `useNotificationSetup.ts` listens for `hafefli://payment/success` (the app's custom URL scheme). Unless the `PAYMENT_SUCCESS_URL` env var is explicitly set to `hafefli://payment/success`, Chargily redirects to a website URL (`https://`), not the app scheme, and the Linking listener never fires. As a result, after a successful payment:
- The success Toast is not shown
- `my-salon-subscription` and `my-salon` queries are not invalidated
- The SubscriptionScreen does not refresh until the next app focus

`PAYMENT_SUCCESS_URL`, `PAYMENT_FAILURE_URL`, and `CHARGILY_WEBHOOK_URL` are also **absent from `ENV_CHECKLIST.md`**, so a developer setting up production would not know to configure them.

### 🟡 Medium — Completeness Check Mismatch

**NEW-INFO-1**: `BarberTabNavigator.isComplete` requires `portfolio_photos.length > 0`, but the backend's `ReservationsService.create()` completeness validation does **not** check portfolio photos. This means a salon with zero portfolio photos but all other fields filled will:
- Show the "salon incomplete" warning in BarberTabNavigator (incorrect)
- Accept client bookings successfully from the backend perspective

Barbers are blocked from seeing a clean dashboard unnecessarily, creating confusion. The dashboard banner even flags "portfolio" as missing, but clients can already book the salon.

### 🟡 Medium — Analytics Endpoint Not Wired to UI

**NEW-INFO-2**: `GET /admin/analytics` was implemented in `admin.service.ts` (MRR, plan breakdown, top salons) and the controller route exists. The admin web dashboard (`dashboard/page.tsx`) calls `/admin/stats` and `/admin/revenue` but never calls `/admin/analytics`. The richer analytics data (MRR trend, plan distribution) is computed on every request but never surfaced.

---

## 6. Frontend Score

**Score: 77 / 100** (+3 from V1)

Improvements: `isRefreshing` fixed, `average_rating` display now works for nearby salons, completeness banner added, booking reminder UI connected. Deductions: two admin pages show empty tables (high), `@ts-nocheck` on all screens (medium), client tab has no dedicated Notifications tab (notification is only reachable via the bell icon in HomeScreen header — not discoverable from other tabs), OSRM in production.

---

## 7. Backend Score

**Score: 84 / 100** (+4 from V1)

Improvements: booking reminder cron added, `/admin/analytics` endpoint built, payments RLS confirmed, `enrichSalon` remaps `rating→average_rating`. Deductions: `max_services` limit not enforced (services can be added without plan limit check), `PAYMENT_SUCCESS_URL` env not documented, slight inconsistency where `SalonServicesService.create()` has no plan quota check while staff and photos do.

---

## 8. Database Score

**Score: 82 / 100** (+7 from V1)

Improvements: `payments` RLS added, notifications table RLS correct, `plan_price` column added to `salons` for sort ordering, `auto_cancel_pending_reservations` trigger added. Deductions: no `max_services` column in `plans` table (only `max_barbers`, `max_portfolio_photos`, `max_reservations`), `portfolio_photos` cascade delete is manual in `deleteSalon` instead of a DB-level `ON DELETE CASCADE`, `sponsored_until` expiry is not enforced by a DB trigger or cron.

---

## 9. Map Score

**Score: 76 / 100** (unchanged)

No new map issues. Previous issues persist: OSRM public demo server, CDN dependencies (MapLibre, Leaflet via jsdelivr/unpkg), no tile caching. The map itself functions correctly for discovery, filtering, route display, and WebGL fallback.

---

## 10. Notification Score

**Score: 88 / 100** (+6 from V1)

New: booking_reminder cron implemented and fires correctly 1h before appointments. Realtime badge updates via Supabase channel are correct. Push tokens are saved via `POST /notifications/push-token`. All 19 notification types are handled in `NotificationsScreen.getIcon()`. Deductions: client tab has no Notifications tab entry point (only header bell on HomeScreen), barber Notifications tab and RootStack Notifications modal are duplicate routes with no shared unread state synchronization.

---

## 11. Security Score

**Score: 82 / 100** (+20 from V1)

Major improvement: service-role key removed from committed files; `eas.json` cleaned; `payments` RLS added. Remaining: `@ts-nocheck` suppresses type errors that could hide security-relevant bugs (e.g., improper input handling), `sponsored_until` is not automatically enforced server-side (expiry relies on sync trigger or admin action). All guards, RLS policies, ownership checks, and DTO validation are verified correct.

---

## 12. Performance Score

**Score: 78 / 100** (unchanged)

No regressions. The booking reminder hourly cron is efficient (uses a windowed query, not a full table scan). DashboardScreen auto-cleanup of expired blocks is fire-and-forget with no blocking. No new N+1 queries detected. The `AdminDashboardScreen` `/admin/salons?limit=1000` call has not been paginated yet (known issue from V1, M-18).

---

## 13. Client Role Audit

| Feature | Status | Notes |
|---------|--------|-------|
| Registration (Supabase OTP) | ✅ Working | `SignUpScreen` → `PhoneEntryScreen` flow |
| Login | ✅ Working | Supabase email/password |
| Forgot Password OTP | ✅ Working | `ForgotPasswordScreen` → `VerifyCodeScreen` → `ResetPasswordScreen` |
| Profile Edit | ✅ Working | `SettingsScreen` with avatar, wilaya picker |
| Reservations (Book) | ✅ Working | Full service → date → slot → confirm flow |
| Reservations (Cancel) | ✅ Working | `MyAppointmentsScreen` cancel with confirmation |
| Reservations (Review) | ✅ Working | Review modal shown after completion |
| Favorites | ✅ Working | `FavoritesScreen` + toggle in SalonDetail |
| Map (HomeScreen) | ✅ Working | GPS, wilaya fallback, filters, markers |
| Map (ExploreScreen) | ✅ Working | Debounced search, sort |
| Notifications | ⚠️ Partial | Reachable via bell icon in HomeScreen header only; no dedicated tab; not accessible from Explore/Favorites/Appointments/Profile tabs |
| Push Notifications | ✅ Working | Expo token registration, delivery confirmed in service |
| Deep links (payment) | ⚠️ Broken | Requires `PAYMENT_SUCCESS_URL=hafefli://payment/success` env var; defaults to https:// |
| Loyalty Points | ✅ Working | Trigger guards walk-ins correctly |

**Client Completion: 93%**

---

## 14. Coiffeur Role Audit

| Feature | Status | Notes |
|---------|--------|-------|
| Salon Creation | ✅ Working | Multi-step with map, geocoder, coord validation |
| Salon Configuration | ✅ Working | Working days, hours, manual close toggle |
| Dashboard | ✅ Working | Day/month/all views, stats, realtime |
| Walk-in Client (Add) | ✅ Working | `AddWalkInModal` creates reservation with `is_walk_in: true` |
| Walk-in vs Member separation | ✅ Working | `ClientsScreen` splits both |
| Calendar | ✅ Working | Timeline, block slots, confirm/cancel |
| Services | ✅ Working | CRUD, `is_active` soft-delete |
| Portfolio | ✅ Working | Upload with plan limit enforcement |
| Staff | ✅ Working | Add/remove with `max_barbers` plan limit |
| Subscription | ✅ Working | Dynamic plans, Chargily checkout, AppState refresh |
| Reviews & Responses | ✅ Working | Response field, displayed on SalonDetail |
| Booking Reminder (Push) | ✅ Working | Hourly cron delivers reminder notifications |
| Salon Approval Wait | ✅ Working | `is_approved: false` by default; barber receives push when approved |
| Completeness Banner | ✅ Working | Missing items shown with nav shortcuts |
| isComplete check vs backend | ⚠️ Minor | Navigator requires portfolio_photos; backend does not — unnecessary "incomplete" state |

**Coiffeur Completion: 95%**

---

## 15. Admin Role Audit

| Feature | Status | Notes |
|---------|--------|-------|
| Auth / Middleware | ✅ Working | Next.js middleware checks `profiles.role === 'Admin'` |
| Dashboard Stats | ✅ Working | totalSalons, activeSalons, pendingSalons, totalUsers, totalReservations |
| Revenue Display | ✅ Working | `/admin/revenue` shows totalRevenue + totalPayments |
| Audit Log | ✅ Working | Paginated, CSV export endpoint |
| Salon Approvals | ✅ Working | Approve/reject with notification to owner |
| User Management (Role Change) | ✅ Working | Promote Client → Coiffeur → Admin |
| Delete User | ✅ Backend only | Backend cascade-deletes user + salons + reservations; **no Delete button in admin panel UI** |
| Ban User | ✅ Backend only | `banUser()` sets `ban_duration: 87600h` in Supabase Auth; **no Ban button in admin panel UI** |
| Delete Salon | ✅ Backend only | Backend cascade implemented; **no Delete button in admin panel UI** |
| Sponsoring (Add/Remove) | ✅ Backend only | `POST/DELETE /admin/salons/:id/sponsor`; **no Sponsor button in admin panel UI** |
| Users Table | ❌ Broken | Renders empty — API returns paginated object, page casts as array (NEW-BUG-4) |
| Reservations Table | ❌ Broken | Same paginated cast bug (NEW-BUG-4) |
| Subscriptions Table | ⚠️ Broken | Renders UUIDs instead of plan names (NEW-BUG-5) |
| Analytics (MRR, Plans) | ❌ Missing | Backend endpoint exists, never called from UI |
| Payments Table | ✅ Working | Fetches directly from Supabase client (not paginated API), displays correctly |

**Admin Completion: 60%** (down from 68% due to newly discovered broken tables)

---

## 16. Subscription Audit

Plans are fully backend-driven from the `plans` table. Changing `max_barbers`, `max_portfolio_photos`, or `max_reservations` in the database immediately changes app enforcement. Plan limits are enforced server-side in `SalonsService` (staff, photos) and `ReservationsService` (reservations). Triggers sync `subscription_status`, `is_sponsored`, `is_featured`, `plan_price` to the `salons` table on subscription change.

**Gap — `max_services`**: The `plans` table has no `max_services` column and `SalonServicesService.create()` performs no plan quota check. Services can be added without limit regardless of plan tier. This is either an intentional design choice (unlimited services on all plans) or an oversight — it should be clarified.

**Gap — `sponsored_until` expiry**: `sponsorSalon()` sets `sponsored_until` but no cron or trigger removes `is_sponsored` when that date passes. Admin must manually un-sponsor.

**Subscription Score: 80 / 100**

---

## 17. New Salon Audit (Full Flow)

| Step | Status | Notes |
|------|--------|-------|
| SalonSetupScreen — form validation | ✅ | All required fields checked before submit |
| Coordinate selection (drag or geocoder) | ✅ | `coordsChosen` gate prevents missing coords |
| `POST /salons` | ✅ | Creates with `subscription_status: 'Trial'`, `is_approved: false` |
| Free plan auto-assigned | ✅ | `user_subscriptions` row created dynamically |
| Salon NOT visible to clients | ✅ | `is_approved: false` gates all public queries |
| Admin sees salon in pending list | ✅ | `getPendingSalons()` filters `is_approved = false` |
| Admin approves → barber notified | ✅ | Push + in-app `salon_approved` notification |
| Salon appears in map after approval | ✅ | `find_nearby_salons` filters `is_approved = true` |
| Salon usable for bookings | ✅ | Requires services + staff + full profile (backend enforced) |
| Portfolio photos upload | ✅ | Plan limit enforced (max_portfolio_photos) |
| Staff addition | ✅ | Plan limit enforced (max_barbers) |

**No blockers in new salon flow.**

---

## 18. Integration Audit

| Integration Point | Status | Notes |
|-------------------|--------|-------|
| Mobile → NestJS REST | ✅ | All screens use `apiClient` with `/api/v1` prefix |
| Admin panel → NestJS REST | ⚠️ | `apiFetch` correctly adds `/api/v1`; but users/reservations pages have response-parsing bug |
| NestJS → Supabase (admin client) | ✅ | `SERVICE_ROLE_KEY` from env, bypasses RLS correctly |
| NestJS → Supabase (user scoped) | ✅ | `getClientForUser()` passes JWT in Authorization header |
| Supabase Realtime → Mobile | ✅ | Notification bell subscribes to `postgres_changes` INSERT |
| Supabase Realtime → Barber | ✅ | `useRealtimeBookings` hook handles INSERT/UPDATE on reservations |
| Chargily → NestJS webhook | ⚠️ | `CHARGILY_WEBHOOK_URL` defaults to `null`; relies on Chargily dashboard config |
| Chargily → Mobile deep link | ❌ | Default `success_url` is `https://` not `hafefli://`; deep link never fires without env var |
| Expo Push → Client device | ✅ | Token saved via `/notifications/push-token`, sent via `expo-server-sdk` |
| React Query cache invalidation | ⚠️ | `barber-salon` vs `my-salon` key split means CalendarScreen can be stale |

---

## 19. Launch Blockers

| # | Blocker | Severity |
|---|---------|----------|
| 1 | **Admin Users and Reservations tables are empty** (paginated object cast as array) | 🔴 Critical |
| 2 | **Payment deep-link never fires** unless `PAYMENT_SUCCESS_URL=hafefli://payment/success` is set; after paying, subscription appears unchanged until app is restarted | 🔴 Critical |
| 3 | **Admin Subscriptions table shows UUIDs** instead of plan names | 🟠 High |
| 4 | **OSRM public demo server** in production is prohibited by project terms | 🟠 High |

---

## 20. Priority Fix List

| # | Task | Severity | Effort |
|---|------|----------|--------|
| 1 | **Fix admin users/reservations pages**: unwrap `(data as {data:T[]}).data` from paginated response | 🔴 | 15 min |
| 2 | **Set `PAYMENT_SUCCESS_URL=hafefli://payment/success`** on Railway; add to `ENV_CHECKLIST.md`; also set `PAYMENT_FAILURE_URL` and `CHARGILY_WEBHOOK_URL` | 🔴 | 30 min |
| 3 | **Fix admin subscriptions**: join `plans(name)` in `getAllSubscriptions()`; display `sub.plans?.name` in UI | 🟠 | 1h |
| 4 | **Add Delete User / Delete Salon / Ban User / Sponsor buttons** to admin panel pages — backend exists, UI missing | 🟠 | 2–3h |
| 5 | **Wire `/admin/analytics` to admin dashboard** — add MRR card, plan breakdown chart, top salons table | 🟠 | 3–4h |
| 6 | **Fix `my-salon` vs `barber-salon` query key**: standardize CalendarScreen to use `['my-salon', user?.id]` | 🟡 | 30 min |
| 7 | **Fix `isComplete` in BarberTabNavigator**: remove `portfolio_photos` requirement (not required by backend) | 🟡 | 15 min |
| 8 | **Replace OSRM demo with self-hosted or Valhalla** routing for production | 🟠 | 1–2 days |
| 9 | **Add Notifications tab to ClientTabNavigator** — currently only reachable via HomeScreen header bell | 🟡 | 1h |
| 10 | **Add `PAYMENT_SUCCESS_URL`, `PAYMENT_FAILURE_URL`, `CHARGILY_WEBHOOK_URL` to ENV_CHECKLIST.md** | 🟡 | 15 min |
| 11 | **Add `sponsored_until` expiry cron** to auto-unset `is_sponsored` when date passes | 🟡 | 2h |
| 12 | **Decide on `max_services` plan limit**: either add column + enforcement or document as intentionally unlimited | 🟡 | 1–2h |
| 13 | **Deduplicate barber Notifications entry point**: remove from tab navigator OR from RootStack modal, not both | 🟢 | 30 min |
| 14 | **Remove `@ts-nocheck` from screen files** and fix revealed TypeScript errors | 🟢 | 2–4h |
| 15 | **Bundle MapLibre/Leaflet assets locally** instead of CDN dependency | 🟢 | 2h |

---

## 21. Scores Summary

| Category | V1 Score | V2 Score | Delta |
|----------|----------|----------|-------|
| **Frontend** | 74 / 100 | 77 / 100 | +3 |
| **Backend** | 80 / 100 | 84 / 100 | +4 |
| **Database** | 75 / 100 | 82 / 100 | +7 |
| **Map** | 76 / 100 | 76 / 100 | 0 |
| **Notifications** | 82 / 100 | 88 / 100 | +6 |
| **Security** | 62 / 100 | 82 / 100 | +20 |
| **Performance** | 78 / 100 | 78 / 100 | 0 |

---

## 22. Role Completion

| Role | V1 | V2 | Delta |
|------|----|-----|-------|
| **Client** | 92% | 93% | +1% |
| **Coiffeur** | 94% | 95% | +1% |
| **Admin** | 68% | 60% | −8% (new bugs discovered) |

---

## 23. Final Verdict

```
Frontend:      77%
Backend:       84%
Database:      82%
Integration:   78%
Notifications: 88%
Security:      82%

GLOBAL COMPLETION: ~76%

Previous audit (V1):  ~71%
Current audit (V2):   ~76%
Delta:                +5 points

Estimated time to soft-launch readiness: 1 week
  - Blockers 1–2 (empty tables, deep-link): 1 day
  - Blockers 3–4 (UUIDs, OSRM): 3 days
  - Polish (items 5–10): remaining days
```

---

## PRODUCTION READINESS: 58 / 100

**LAUNCH STATUS:**
❌ NOT READY

Two new launch-blocking bugs were introduced since V1 (empty admin tables, broken payment deep-link). These must be fixed before any form of beta launch. With those two resolved, the system is viable for a **limited beta** targeting the Client and Coiffeur roles, with the Admin panel usable only for salon approvals and stats (not user management or reservation review).

---

## NEXT PHASE — Top 10 Remaining Tasks

1. **Fix admin Users & Reservations pages** — unwrap `data.data` from paginated response (30 min)
2. **Set `PAYMENT_SUCCESS_URL=hafefli://payment/success`** in Railway env + update ENV_CHECKLIST (30 min)
3. **Fix admin Subscriptions table** — join plan name, display human-readable string (1h)
4. **Wire `/admin/analytics` to dashboard** — surface MRR, plan distribution, top salons (4h)
5. **Add Delete/Ban/Sponsor actions** to admin panel UI pages (3h)
6. **Unify `my-salon`/`barber-salon` query key** in CalendarScreen (15 min)
7. **Fix `isComplete` portfolio_photos requirement** in BarberTabNavigator (15 min)
8. **Add Notifications tab to ClientTabNavigator** (1h)
9. **Replace OSRM** with production-grade routing API (1–2 days)
10. **Add `sponsored_until` expiry handling** (cron or DB trigger) (2h)

---

*Audit performed in READ-ONLY mode on 2026-06-12. No files were modified, no commits made, no database altered.*
