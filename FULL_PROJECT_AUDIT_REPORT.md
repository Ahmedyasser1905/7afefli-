# FULL PROJECT AUDIT REPORT
## BarberDZ / 7afefli (Hafefli)
**Audit Date:** 2026-06-12  
**Repository:** https://github.com/Ahmedyasser1905/7afefli-.git  
**Auditor Role:** Principal Software Architect · Senior Full-Stack · Senior DevOps · Senior Security · Senior DB Architect · Senior Mobile · Senior QA · Senior Product Owner · Senior Performance  

---

## Executive Summary

BarberDZ / 7afefli is a **multi-platform barber-salon marketplace** targeting the Algerian market, consisting of a React Native (Expo) mobile app, a NestJS REST API backend, and a Next.js admin panel, all backed by Supabase (PostgreSQL). The codebase is in an **advanced but not production-ready state** (~78% complete). A significant body of prior audit work has already resolved many critical bugs (double-booking triggers, RLS policies, API URL prefixes). What remains are one broken API contract, one outstanding migration conflict, several medium-security gaps, and a pattern of large god-files that raise maintainability risk.

The project **CANNOT ship to production today** without resolving at minimum two issues: the `find_nearby_salons` RPC parameter-name conflict between two migrations, and the missing `CHARGILY_WEBHOOK_URL` environment variable that silently prevents subscription activation after payment.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  MOBILE APP (Expo / React Native)                                   │
│  apps/mobile/src                                                    │
│  ├── screens/  (client, barber, admin, auth)                        │
│  ├── components/ (map, booking, barber, salon, ui)                  │
│  ├── hooks/ (booking, salons, barber realtime)                      │
│  ├── store/ (Zustand: auth, booking, theme, mapPreferences)         │
│  ├── navigation/ (AppNavigator, Client/Barber/AdminTabNavigator)    │
│  └── lib/ (apiClient, supabase, notifications)                      │
│                              ▼ REST /api/v1                         │
│  BACKEND API (NestJS on Railway)                                    │
│  services/api/src                                                   │
│  ├── auth, salons, reservations, reviews, slots                     │
│  ├── subscriptions, payments (Chargily), notifications              │
│  ├── admin, locations, audit                                        │
│  └── Supabase admin client, Redis cache, Sentry, Cron              │
│                              ▼ Supabase JS                          │
│  DATABASE (Supabase / PostgreSQL + PostGIS)                         │
│  ├── Tables: profiles, salons, services, salon_staff,               │
│  │           reservations, reviews, portfolio_photos,               │
│  │           user_subscriptions, plans, payments,                   │
│  │           notifications, wilayas, salon_favorites                │
│  ├── RPCs: find_nearby_salons, create_reservation_safe,             │
│  │         expire_*, sync_all_subscription_statuses                 │
│  └── Triggers: overlap check, loyalty points, subscription sync     │
│                              ▼                                      │
│  ADMIN PANEL (Next.js 14 on Vercel)                                 │
│  apps/admin/app                                                     │
│  └── dashboard, salons, users, reservations, subscriptions,         │
│      payments, login, unauthorized                                  │
└─────────────────────────────────────────────────────────────────────┘

Payments: Chargily Pay (DZD)          Push: Expo Push Notifications
Realtime: Supabase Realtime           Maps: MapLibre GL + Leaflet fallback
Cache: Redis (Railway) or in-memory   Rate limiting: NestJS Throttler
Logging: Winston + Sentry             Auth: Supabase JWT + SupabaseAuthGuard
```

### Missing Modules
- No end-to-end test suite (Jest unit tests exist, no E2E/integration tests)
- No admin page for **Reviews** management (moderation, deletion)
- No admin page for **Plans** management (CRUD on subscription plans)
- No **analytics** page in admin Next.js panel (endpoint exists `/admin/analytics` but no page)
- No **push-notification send** UI for admin
- No rate-limit monitoring dashboard

---

## Frontend Audit

### Mobile App (React Native / Expo)

#### Auth Screens
| Screen | Status | Notes |
|---|---|---|
| PhoneInputScreen | ✅ Working | Primary OTP login entry |
| PhoneEntryScreen | ⚠️ Duplicate | Also exists as a post-signup phone collection flow; separate from PhoneInputScreen. Two screens for similar concerns; confusing |
| SignUpScreen | ✅ Working | Email + password sign-up |
| ForgotPasswordScreen | ✅ Working | Calls `/auth/reset-password` |
| VerifyCodeScreen | ✅ Working | OTP verification |
| ResetPasswordScreen | ✅ Working | Calls `/auth/update-password` |

**Issue A-1 (Medium):** `PhoneEntryScreen` and `PhoneInputScreen` overlap in purpose. Both handle phone number entry for different flow stages but share near-identical UI. Should be consolidated into one parametrized component.

#### Client Screens
| Screen | API Calls | Status | Issues |
|---|---|---|---|
| HomeScreen | `/salons/nearby`, `/salons?wilaya=` | ✅ Working | File 638 lines — could be split |
| ExploreScreen | `/salons?limit=200&wilaya=` | ✅ Working | Fetches 200 salons at once (no cursor pagination) |
| SalonDetailScreen | `/salons/:id`, `/salons/:id/portfolio`, `/salons/:id/favorited` | ✅ Working | Good hardcoded fallback cover from Unsplash |
| BookingScreen | `/salons/:id/services`, `/salons/:id/staff`, `/slots`, `/reservations` | ✅ Working | 4-step wizard works end-to-end |
| BookingConfirmScreen | — | ✅ Working | — |
| MyAppointmentsScreen | `/reservations/me` | ✅ Working | — |
| FavoritesScreen | `/salons/favorites`, `/salons/:id/favorite` | ✅ Working | — |
| NotificationsScreen | `/notifications`, `/notifications/read-all` | ✅ Working | — |
| LoyaltyPointsScreen | `/auth/profiles/me/loyalty` | ✅ Working | Points hardcoded to 10/reservation in backend |
| SettingsScreen | `/auth/profiles/me`, `/auth/profiles/me` (PATCH) | ✅ Working | Wilaya list duplicated inline (58 items) vs shared constants |

**Issue A-2 (Medium):** `ExploreScreen` fetches up to 200 salons in a single request with no cursor-based pagination. As the salon count grows, this will degrade performance significantly.

**Issue A-3 (Low):** `SettingsScreen` maintains its own hardcoded list of 58 wilayas instead of importing from `@barberdz/shared/constants/wilayas`. A change to the shared constants would not propagate.

#### Barber Screens
| Screen | API Calls | Status | Issues |
|---|---|---|---|
| SalonSetupScreen | `/salons` (POST) | ✅ Working | Default coords 36.7538/3.0588 (Algiers) pre-filled |
| MySalonScreen | `/salons/my-salon`, `/salons/:id/services`, `/salons/:id/portfolio`, `/salons/:id/reviews`, `/salons/:id/staff` | ✅ Working | File could be split |
| DashboardScreen | `/salons/my-salon`, `/reservations/salon/:id`, `/salons/my-salon/stats` | ✅ Working | 1370 lines — god file, needs splitting |
| CalendarScreen | `/salons/my-salon`, `/reservations/salon/:id?date=` | ✅ Working | Overlap resolution algorithm is correct |
| ClientsScreen | `/reservations/salon/:id/clients` | ✅ Working | — |
| SubscriptionScreen | `/subscriptions/plans`, `/subscriptions/my-plan` | ✅ Working | Correct endpoints |

**Issue A-4 (Medium):** `DashboardScreen` is 1,370 lines. It combines reservations list, stats display, walk-in modal, block-time modal, and reservation detail modal. Should be decomposed.

**Issue A-5 (Low):** `SalonSetupScreen` defaults latitude/longitude to Algiers (36.7538, 3.0588) without requiring the user to set coordinates explicitly. A salon can be created and submitted for approval with no real GPS location.

#### Admin Screen (Mobile)
| Screen | API Calls | Status | Issues |
|---|---|---|---|
| AdminDashboardScreen | `/admin/salons`, `/admin/users`, `/admin/stats`, `/admin/reservations`, `/admin/analytics` | ✅ Working | Mobile admin exists as a tab within the mobile app |

**Issue A-6 (Low):** The mobile app duplicates admin functionality already covered by the Next.js admin panel. Two separate admin UIs to maintain.

#### Components
| Component | Status | Notes |
|---|---|---|
| SalonMapView | ✅ Working | MapLibre GL via WebView + Leaflet fallback. Static HTML compiled once, dynamic injection via `injectJavaScript`. |
| NotificationBell | ✅ Working | Polls `/notifications/unread-count` |
| AddWalkInModal | ✅ Working | — |
| ReservationDetailModal | ✅ Working | — |
| BlockTimeModal | ✅ Working | — |
| DateStrip / SlotPicker | ✅ Working | — |
| LeaveReviewModal | ✅ Working | — |
| EditProfileModal | ✅ Working | — |

#### Hooks
| Hook | Status | Notes |
|---|---|---|
| useRealtimeBookings | ✅ Working | Unique channel name per instance prevents collision between Dashboard and Calendar |
| useNearbySalons | ✅ Working | — |
| useCreateReservation | ✅ Working | — |
| useAvailableSlots | ✅ Working | — |
| useSlotLock | ✅ Working | — |
| useNotificationSetup | ✅ Working | — |

#### Stores (Zustand)
| Store | Status | Notes |
|---|---|---|
| authStore | ✅ Working | Persisted to SecureStore; partializes correctly |
| bookingStore | ✅ Working | Ephemeral |
| themeStore | ✅ Working | — |
| mapPreferencesStore | ✅ Working | Persisted wilaya + sort + filter preferences |

---

## Backend Audit

### Controllers
| Controller | Routes | Auth | Notes |
|---|---|---|---|
| AuthController | POST /auth/verify, GET /profiles/me, GET /profiles/me/loyalty, PATCH /profiles/me, DELETE /me, POST /reset-password, POST /update-password, POST /resend-verification | ✅ Correct | Role never accepted from client body |
| SalonsController | 20+ routes incl. nearby, favorites, portfolio, staff, services, reviews | ✅ Correct | `favorites` route correctly ordered before `:id` |
| ReservationsController | GET /me, POST /, POST /block, DELETE /block/:id, GET /salon/:id, GET /salon/:id/pending, GET /salon/:id/clients, PATCH /:id/status, GET /:id | ✅ Correct | — |
| ReviewsController | POST /, GET /, DELETE /:id | ✅ Correct | — |
| SlotsController | GET / | ✅ Correct | Cached with TTL, invalidated on booking |
| AdminController | Full CRUD for salons/users/reservations/subscriptions/stats/audit | ✅ Correct | All Admin-guarded |
| SubscriptionsController | GET /plans, GET /my-plan | ✅ Correct | — |
| PaymentsController | POST /checkout, POST /webhook | ✅ Correct | Webhook validates HMAC signature |
| NotificationsController | GET /, GET /unread-count, PATCH /read-all, PATCH /:id/read, POST /push-token, DELETE /push-token | ✅ Correct | — |
| LocationsController | GET /wilayas | ✅ Correct | — |

**Issue B-1 (Low):** `GET /auth/profiles/me/loyalty` returns `points: 10` hardcoded per reservation. This should be read from a configuration constant or database field, not hardcoded in the codebase.

**Issue B-2 (Low):** `AuditModule` logs admin actions but the `AuditService` is not injected into controllers that should log non-admin mutations (e.g., salon creation/deletion by owners). Coverage is incomplete.

### Services
- **SalonsService (772 lines):** Large but logically structured. `enrichSalon` computes `is_currently_open` correctly using Algeria UTC+1. Subscription enforcement (max_barbers, max_photos, max_reservations) reads from DB — fully dynamic.
- **ReservationsService (1066 lines):** God file. Handles creation, slot locking, blocking, status updates, cron expiry, and client aggregation. Should be split into ReservationsCreationService and ReservationsQueryService.
- **SlotsService:** Clean algorithm with correct Redis/in-memory cache and invalidation.
- **SubscriptionsService:** Cron-based daily checks correctly downgrade expired trials/plans to Free.
- **NotificationsService:** Push via Expo SDK; fire-and-forget model appropriate.
- **ChargilyService:** Correctly switches between test and production endpoints based on `NODE_ENV`.

**Issue B-3 (Medium):** `ReservationsService.create()` fetches salon data with a very wide select including nested `subscriptions:user_subscriptions(status, plans(*))`. This is a large join on every reservation creation. Should be cached or split into targeted queries.

**Issue B-4 (Low):** `SalonsService.findAll()` uses `.order('plan_price', { ascending: false })` but `plan_price` is a column that must be synced by a trigger. If the trigger fails silently, sort order silently degrades.

### Guards & Security
- `SupabaseAuthGuard`: Verifies JWT via Supabase admin client. Role cached in-memory for 5 minutes. `invalidateRoleCache()` is called by `AdminService.changeUserRole()` for immediate propagation.
- `RolesGuard`: Reads `user.role` from request (set by auth guard). Works correctly.
- DTOs: `whitelist: true` + `forbidNonWhitelisted: true` + `transform: true` on global ValidationPipe.

---

## Database Audit

### Migrations (18 files, all dated 2026-06-09 to 2026-06-12)

| File | Purpose | Status |
|---|---|---|
| 20260609140000_audit_fixes.sql | First audit fixes: overlap trigger (using wrong column `date`), RLS on user_subscriptions (wrong column `user_id`) | ⚠️ Superseded — see C-1 below |
| 20260609151500_fix_prevent_salon_escalation.sql | Prevents privilege escalation via salon creation | ✅ |
| 20260609153000_salon_enforcement.sql | Subscription enforcement triggers | ✅ |
| 20260609160000_dynamic_subscription_plan_fk.sql | FK linking user_subscriptions.plan to plans.id | ✅ |
| 20260609170000_fix_triggers_plan_column.sql | Fixes plan column in triggers | ✅ |
| 20260609180000_audit_resolutions.sql | Various audit issue resolutions | ✅ |
| 20260609_dynamic_subscriptions.sql | Dynamic subscription infrastructure | ✅ |
| 20260610000000_critical_fixes.sql | Correct overlap trigger (`appointment_date`), correct RLS (via salons.owner_id join), RPCs create_reservation_safe/expire_*/sync_all, find_nearby_salons v1, wilayas table, loyalty points trigger, indexes | ✅ but creates find_nearby_salons with OLD param names |
| 20260610010000_salon_favorites.sql | salon_favorites table | ✅ |
| 20260610020000_h3_fix_reservation_overlap_null_barber.sql | Handle null barber_id in overlap check | ✅ |
| **20260610030000_fix_find_nearby_salons.sql** | **Redefines find_nearby_salons with new param names** | ⚠️ **C-2 CRITICAL** |
| 20260610040000_auto_cancel_pending_reservations.sql | Cron auto-cancel | ✅ |
| 20260610050000_subscription_fallback_to_free.sql | Fallback to free plan | ✅ |
| 20260610060000_lock_active_premium_subscriptions.sql | Lock premium subs | ✅ |
| 20260610070000_sync_premium_features_to_salons.sql | Sync trigger | ✅ |
| 20260610080000_sort_salons_by_plan_tier.sql | Sort infrastructure | ✅ |
| 20260611000000_create_notifications_table.sql | Notifications table + RLS | ✅ |
| 20260612000000_payments_rls.sql | Payments RLS | ✅ |

**Issue C-1 (Medium):** `20260609140000_audit_fixes.sql` creates `check_reservation_overlap` using `AND date = NEW.date` and `NOT IN ('cancelled','rejected')` — both wrong. This is overwritten by `20260610000000_critical_fixes.sql` which uses the correct `appointment_date` and correct status values. However if migrations are run out of order or only partially, the broken trigger could remain active.

**Issue C-2 (Critical):** `find_nearby_salons` exists in TWO incompatible definitions across migrations:
- `20260610000000_critical_fixes.sql` creates it with params `(user_lat, user_lng, radius_meters, result_limit)` 
- `20260610030000_fix_find_nearby_salons.sql` drops both old signatures and recreates it with `(p_latitude, p_longitude, p_radius_m, p_limit)`
- The NestJS `SalonsService` calls it with `(p_latitude, p_longitude, p_radius_m, p_limit)` which matches the **second** migration

If `20260610030000` runs after `20260610000000` (which it should, by timestamp), the final state is correct. However if any migration tooling skips or re-runs only `20260610000000`, the RPC will fail with parameter name mismatch and fall back to the basic `findAll` query — silently degrading geolocation. This is fragile and should be made idempotent.

**Issue C-3 (Low):** `salons` table uses both `rating` (returned by old RPC) and `average_rating` (actual column name). The service compensates with `s.average_rating ?? s.rating ?? null` but this is technical debt.

**Issue C-4 (Low):** No migration drops the stale `force_closed` column reference that was in an earlier version of `find_nearby_salons`. The `20260610030000` migration notes it fixed this but does not explicitly `ALTER TABLE salons DROP COLUMN IF EXISTS force_closed`.

### Indexes
The critical composite indexes were added in `20260610000000`:
- `idx_reservations_salon_appt_date` (salon_id, appointment_date) ✅
- `idx_reservations_pending_future` (partial: status = 'Pending') ✅
- `idx_notifications_user_unread` (partial: is_read = FALSE) ✅
- `idx_portfolio_photos_salon_id` ✅
- `idx_reviews_salon_id` ✅

**Issue C-5 (Medium):** No index on `salons(owner_id)` — used frequently in `findByOwner`, `getSalonClients`, and join patterns. Missing this index means full scans on the salons table for every barber dashboard load.

**Issue C-6 (Medium):** No index on `profiles(role)` — used in admin queries and RLS policies like `WHERE role = 'Admin'`. This could cause sequential scans on the profiles table for every admin operation.

### RLS Policies
| Table | RLS Enabled | Policies | Status |
|---|---|---|---|
| profiles | ✅ | Self-read, self-update | ✅ |
| salons | ✅ | Public read (approved), owner write | ✅ |
| reservations | ✅ | Client/barber/admin access | ✅ |
| reviews | ✅ | Public read, client write own | ✅ |
| user_subscriptions | ✅ | Owner via salons join, admin all | ✅ (fixed) |
| payments | ✅ | Owner via salons join, admin select, service_role all | ✅ (added in latest migration) |
| notifications | ✅ | Self-read, self-update, service_role insert | ✅ |
| plans | ✅ | Public read | ✅ |
| salon_favorites | ✅ | Self read/write | ✅ |
| wilayas | ✅ | Public read | ✅ |

**Issue C-7 (Medium):** `portfolio_photos` table — RLS status not visible in migration files. If RLS is not enabled, any authenticated user could potentially delete another salon's photos by knowing the `photo_id`.

---

## API Integration Audit

### Full Flow Verification

**Booking Flow (Client):**
```
HomeScreen → SalonDetailScreen → BookingScreen
→ /salons/:id (GET) ✅
→ /salons/:id/services (GET) ✅
→ /salons/:id/staff (GET) ✅
→ /slots?salonId=&serviceId=&date= (GET) ✅
→ /reservations (POST) ✅
→ BookingConfirmScreen ✅
→ /notifications triggered server-side ✅
```

**Barber Dashboard Flow:**
```
DashboardScreen
→ /salons/my-salon (GET) ✅
→ /reservations/salon/:id?date= (GET) ✅
→ /salons/my-salon/stats (GET) ✅
→ Realtime subscription: postgres_changes on reservations ✅
```

**Payment Flow (Barber):**
```
SubscriptionScreen → /subscriptions/plans (GET) ✅
→ /subscriptions/my-plan (GET) ✅
→ /payments/checkout (POST) ✅ (Coiffeur-only)
→ Chargily redirect → user pays
→ Chargily webhook → POST /payments/webhook ✅
→ user_subscriptions updated ✅
→ sync_all_subscription_statuses() RPC called ✅
→ Notification sent to barber ✅
```

**Admin Flow (Next.js):**
```
/dashboard → /admin/stats, /admin/revenue, /admin/audit ✅
/salons → /admin/salons/pending ✅
/users → /admin/users ✅
/subscriptions → /admin/subscriptions ✅
/reservations → /admin/reservations ✅
/payments → /admin/revenue + direct Supabase query ✅
```

**Issue INT-1 (Medium):** `apps/admin/app/payments/page.tsx` bypasses the API and queries Supabase directly for the payment detail list. This is inconsistent with the rest of the admin panel and bypasses any business logic layer. If RLS on the `payments` table is correctly configured (which it now is), this direct Supabase call uses the anon key (client-side), which would fail unless the user's JWT has admin role. Worth verifying in production.

**Issue INT-2 (Low):** `GET /admin/reservations` in the admin panel calls the API, but the `/admin/reservations` endpoint in `AdminController` accepts `page` and `limit` query params that the admin page does NOT pass — it calls `/admin/reservations` without pagination, and the API then defaults to page 1, limit 50. This could silently omit older reservations.

---

## Authentication Audit

| Flow | Status | Notes |
|---|---|---|
| Phone OTP login | ✅ Working | Via Supabase auth |
| Email/Password signup | ✅ Working | Via SignUpScreen |
| Forgot Password | ✅ Working | Sends reset email, redirects to `APP_URL/reset-password` |
| Reset Password | ✅ Working | POST /auth/update-password |
| Profile verify (post-signup) | ✅ Working | POST /auth/verify — role never accepted from client |
| Session persistence | ✅ Working | Zustand + SecureStore |
| Token refresh | ✅ Working | Supabase JS client handles automatically |
| Logout | ✅ Working | supabase.auth.signOut() + clearAuth() |
| Account deletion | ✅ Working | Checks for active reservations before deleting Coiffeur |
| Role cache | ✅ Working | 5-minute TTL, invalidated on admin role change |

**Issue AUTH-1 (Medium):** `POST /auth/resend-verification` is a public unauthenticated endpoint that calls `supabase.auth.resend()`. There is no rate limiting specifically on this endpoint (only the global 100 req/min throttler applies). A malicious actor could spam verification emails to any address.

**Issue AUTH-2 (Low):** `POST /auth/reset-password` similarly has no per-email rate limiting — only the global throttler. Dedicated per-user/per-email throttling should be applied.

**Issue AUTH-3 (Low):** `AppNavigator` auto-creates a profile row if the profile is missing, using `user.user_metadata.role` — which is client-provided metadata. This could allow a malicious user to self-assign a role by crafting a signup request with `role: 'Admin'` in their metadata. The auto-create path should hardcode `role: 'Client'`.

---

## Client Role Audit

| Feature | Status | Notes |
|---|---|---|
| View home map with nearby salons | ✅ Working | GPS + wilaya fallback |
| Search & filter salons | ✅ Working | Debounced, wilaya-filtered |
| Salon detail view | ✅ Working | Services, photos, reviews, staff |
| Book appointment | ✅ Working | 4-step wizard |
| Cancel appointment | ✅ Working | Via MyAppointmentsScreen |
| Leave review | ✅ Working | Only after Completed reservation |
| Favorites | ✅ Working | Add/remove/list |
| Notifications | ✅ Working | In-app list, push |
| Loyalty points | ✅ Working | Balance + history |
| Settings / profile edit | ✅ Working | Avatar, name, wilaya |
| Password change | ✅ Working | POST /auth/update-password |
| Account deletion | ✅ Working | — |

---

## Coiffeur Role Audit

| Feature | Status | Notes |
|---|---|---|
| Create salon | ✅ Working | POST /salons |
| Edit salon info | ✅ Working | PATCH /salons/:id via EditSalonModal |
| Edit salon location | ✅ Working | WebView map picker |
| Add/remove services | ✅ Working | With subscription quota enforcement |
| Add/remove staff | ✅ Working | With subscription quota enforcement |
| Upload portfolio photos | ✅ Working | Signed URL flow with quota enforcement |
| View reservations (day/month/all) | ✅ Working | — |
| Accept/reject reservations | ✅ Working | PATCH /reservations/:id/status |
| Add walk-in client | ✅ Working | POST /reservations (Coiffeur role allowed) |
| Block time slot | ✅ Working | POST /reservations/block |
| Calendar view | ✅ Working | Timeline with overlap resolution |
| Realtime booking updates | ✅ Working | Supabase Realtime channel |
| View clients (CRM) | ✅ Working | Aggregated list: members + walk-ins |
| Dashboard stats | ✅ Working | Day/month/all modes |
| Subscription management | ✅ Working | Plans list, current plan, Chargily checkout |
| Open/close toggle | ✅ Working | is_manually_closed flag |
| Salon approval submission | ✅ Working | Barber submits → admin approves |

**Issue COIF-1 (Medium):** `SalonSetupScreen` allows a salon to be created with default Algiers coordinates (36.7538, 3.0588) if the user skips the map step. The `coordsChosen` flag is only visual — it doesn't block form submission. A salon with fake coordinates will appear on the wrong position on the map.

---

## Admin Role Audit

### Next.js Admin Panel
| Feature | Status | Notes |
|---|---|---|
| Dashboard stats | ✅ Working | `/admin/stats`, `/admin/revenue`, `/admin/audit` |
| Pending salon approvals | ✅ Working | `/admin/salons/pending` |
| Approve/reject salon | ✅ Working | PATCH with `{ approved: true/false }` |
| Delete salon | ✅ Working | DELETE /admin/salons/:id |
| List all salons | ✅ Working | Paginated |
| List all users | ✅ Working | Paginated |
| Ban/unban user | ✅ Working | PATCH /admin/users/:id/ban |
| Change user role | ✅ Working | PATCH /admin/users/:id/role — invalidates role cache |
| Delete user | ✅ Working | — |
| List subscriptions | ✅ Working | — |
| Sponsor/unsponsor salon | ✅ Working (mobile only) | Mobile AdminDashboardScreen has this; Next.js panel does NOT |
| Payments overview | ✅ Working | Revenue stats + direct Supabase query |
| Reviews management | ❌ MISSING | No admin page exists for reviews moderation |
| Plans management | ❌ MISSING | No CRUD UI for subscription plans |
| Analytics page | ❌ MISSING | Endpoint exists, no Next.js page |

**Issue ADMIN-1 (High):** No Reviews moderation page in the admin panel. There is no way for the admin to delete abusive/spam reviews from the web interface. The backend endpoint `DELETE /reviews/:id` exists and requires Admin role, but no admin UI exposes it.

**Issue ADMIN-2 (Medium):** No Plans management UI. Admin cannot change plan prices, durations, or features through the admin panel. Must use Supabase dashboard directly.

**Issue ADMIN-3 (Medium):** `GET /admin/salons` doesn't distinguish between approved and pending salons in the response (no filter UI). The pending list is a separate `/admin/salons/pending` endpoint, but the general salons list shows all salons without a clear pending indicator.

---

## Subscription Audit

### Plan Enforcement (Backend)
| Limit | Enforced | Method |
|---|---|---|
| max_barbers | ✅ DB + Backend | `SalonsService.addStaff` checks plan |
| max_portfolio_photos | ✅ DB + Backend | `SalonsService.getPortfolioUploadUrl` checks plan |
| max_reservations | ✅ Backend | `ReservationsService.create` checks plan |
| sponsored_listing | ✅ DB trigger | Synced to `salons.is_sponsored` |
| premium_badge | ✅ DB column | `salons.premium_badge` |
| featured_listing | ✅ DB column | Affects sort order via `plan_price` |
| advanced_statistics | ⚠️ Frontend-only | No backend enforcement |
| marketing_included | ⚠️ Frontend-only | Display-only |
| priority_support | ⚠️ Frontend-only | Display-only |

**Issue SUB-1 (Low):** `advanced_statistics`, `marketing_included`, and `priority_support` are plan features exposed in the UI but have no backend enforcement logic. These are soft marketing features and may be intentional, but should be documented as such.

**Issue SUB-2 (Low):** The daily cron job runs `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)` in server time (Railway UTC). Algeria is UTC+1. Subscriptions expiring at midnight Algeria time won't be caught until 23:00 UTC the previous day or 01:00 UTC — a potential 1-hour window where an expired subscription appears active.

---

## Map Audit

| Feature | Status | Notes |
|---|---|---|
| MapLibre GL rendering | ✅ Working | Static HTML compiled once, salons injected dynamically |
| Leaflet fallback | ✅ Working | Falls back if MapLibre CDN fails |
| Marker rendering | ✅ Working | Filtered: only salons with non-zero coordinates shown |
| Marker selection | ✅ Working | `selectSalon()` injected via JS |
| Geolocation | ✅ Working | watchPositionAsync with 50m threshold |
| Nearby salon search | ✅ Working | PostGIS RPC with 50km radius fallback |
| Algeria bounds guard | ✅ Working | Falls back to Algiers if outside bounds |
| Salon open/closed state | ✅ Working | Computed in `enrichSalon()` |
| Route drawing | ❌ Missing | No turn-by-turn route from user to salon |

**Issue MAP-1 (Medium):** The `find_nearby_salons` RPC in migration `20260610000000` uses old param names (`user_lat`, `user_lng`, `radius_meters`, `result_limit`), while the service calls with new names (`p_latitude`, `p_longitude`, `p_radius_m`, `p_limit`). If only the earlier migration was applied, RPC calls would fail silently and fall back to the basic query (losing geolocation precision). Migration `20260610030000` corrects this, but the ordering dependency is fragile.

**Issue MAP-2 (Low):** The map does not refresh automatically when a new salon is approved or when a salon opens/closes. The user must pull-to-refresh or navigate away and back.

---

## Notification Audit

### Triggers
| Event | Notification Created | Push Sent | Status |
|---|---|---|---|
| Booking created (for barber) | ✅ | ✅ (local + server) | Working |
| Booking confirmed (for client) | ✅ | ✅ | Working |
| Booking cancelled (for client/barber) | ✅ | ✅ | Working |
| Booking completed (for client) | ✅ | ✅ | Working |
| Salon approved/rejected | ✅ | ✅ | Working |
| Subscription activated | ✅ | ✅ | Working |
| Subscription expiring/expired | ✅ | ✅ | Working |
| New review | ✅ | ✅ | Working |
| Loyalty points earned | ❌ Missing | ❌ Missing | No notification on loyalty points |
| Appointment reminder | ⚠️ Partial | ✅ Local only | `scheduleAppointmentReminder` is client-side only; no server-side 24hr reminder |

**Issue NOTIF-1 (Low):** No notification is sent when a client earns loyalty points, despite `loyalty_points` being a defined notification type in the DB schema.

**Issue NOTIF-2 (Low):** Appointment reminders are scheduled client-side using `scheduleAppointmentReminder()` (local device notification). If the app is uninstalled or the device reboots, the reminder is lost. A server-side scheduled push would be more reliable.

---

## Realtime Audit

| Channel | Subscription | Cleanup | Status |
|---|---|---|---|
| salon-reservations:{salonId}-{random} | INSERT, UPDATE on reservations | ✅ cleanup on unmount | Working |
| Supabase client reconnection | Handled by Supabase JS v2 auto-reconnect | ✅ | Working |

**Issue RT-1 (Low):** Both `DashboardScreen` and `CalendarScreen` instantiate `useRealtimeBookings` simultaneously when both tabs are active (if the navigator renders both). The unique channel name suffix (`Math.random()`) prevents collision, but results in two concurrent subscriptions to the same data. A shared context or singleton hook would be more efficient.

**Issue RT-2 (Low):** No realtime subscription for the client — booking status changes (confirmed, cancelled) are not pushed in real time to the client's `MyAppointmentsScreen`. The client must manually refresh.

---

## Performance Audit

| Module | Issue | Severity |
|---|---|---|
| ExploreScreen | Fetches 200 salons in one request | Medium |
| ReservationsService.create() | Wide join selecting full subscription + plans on every booking | Medium |
| DashboardScreen | 1,370-line component, many state variables, high re-render surface | Medium |
| salons(owner_id) index | Missing — full table scan on every barber dashboard load | Medium |
| profiles(role) index | Missing — sequential scan on admin operations and RLS policies | Medium |
| useRealtimeBookings | Two instances on active barber tabs | Low |
| SalonMapView | injectJavaScript on every `salons` or `selectedSalonId` change | Low (acceptable — avoids remount) |
| find_nearby_salons | Falls back to unindexed query if RPC fails | Medium |
| Slot generation | Correct: parallel DB fetches, Redis cached with invalidation | ✅ |
| Subscription cron | Correct: once daily, minimal queries | ✅ |

**Performance Score: 68/100** — The foundation is solid (PostGIS, Redis caching, React Query stale-time), but missing indexes and a 200-salon bulk fetch hurt.

---

## Security Audit

| Category | Status | Notes |
|---|---|---|
| JWT verification | ✅ | Supabase admin client validates token on every request |
| Role assignment | ✅ | Role never accepted from client body |
| IDOR (Reservation) | ✅ | `findOne` checks client_id, owner_id, or Admin role |
| IDOR (Salon) | ✅ | `update`/`remove` verify `owner_id === user.id` |
| IDOR (Portfolio photos) | ⚠️ | RLS on portfolio_photos not confirmed in migrations |
| Privilege escalation | ✅ | Fixed: prevent_salon_escalation migration applied |
| Payment webhook HMAC | ✅ | `verifySignature()` verifies Chargily signature before processing |
| Webhook salon_id forgery | ✅ | Fixed: salon existence verified before activation |
| Rate limiting | ✅ | 100 req/min global, 5/min on checkout |
| SQL injection | ✅ | Supabase client uses parameterized queries |
| Body size limit | ✅ | 1MB limit on JSON bodies |
| Helmet headers | ✅ | Applied globally |
| CORS | ✅ | Restricted to `ALLOWED_ORIGINS` env var |
| Sensitive data in logs | ✅ | No PII logged (passwords, tokens) |
| Swagger in production | ✅ | Disabled when `NODE_ENV=production` |
| Auth metadata role injection | ⚠️ | AppNavigator auto-create uses `user_metadata.role` — should hardcode 'Client' |
| Email enumeration (reset) | ✅ | Always returns same message regardless of email existence |
| Resend-verification rate limit | ⚠️ | No per-email throttling — only global 100/min |

**Security Score: 72/100** — Core attack vectors are covered. Gaps are in edge cases (metadata role injection, per-endpoint rate limits, portfolio_photos RLS).

---

## DevOps Audit

| Area | Status | Notes |
|---|---|---|
| Railway (NestJS) | ✅ | Graceful shutdown, port configurable |
| Vercel (Next.js admin) | ✅ | SSR middleware, Admin auth check |
| EAS Build | ✅ | development/preview/production profiles |
| Environment validation | ✅ | `validateEnvironment()` fails fast on missing vars |
| Docker | ❌ Missing | No Dockerfile provided. Railway likely uses buildpack detection |
| Health check endpoint | ⚠️ | `GET /` returns `{ status: 'ok' }` via AppController. No `/health` or `/readiness` endpoint |
| Sentry monitoring | ✅ | Configured when `SENTRY_DSN` present |
| Winston logging | ✅ | Console transport with timestamps |
| Redis | ✅ Optional | Falls back to in-memory gracefully |
| Chargily test vs prod | ✅ | Switches via `NODE_ENV` |
| CHARGILY_WEBHOOK_URL | ⚠️ | Not set → webhook may not reach the API (Chargily needs the deployed URL) |
| APP_URL env var | ⚠️ | Used in reset-password redirect. Production-only requirement but missing from checklist as critical |

**Issue DEVOPS-1 (High):** No `CHARGILY_WEBHOOK_URL` configured means Chargily cannot call back to the API after payment. Without this, payment confirmations won't be processed and subscriptions won't activate. This must be set to the deployed Railway API URL + `/api/v1/payments/webhook`.

**Issue DEVOPS-2 (Medium):** No Dockerfile. Railway can detect NestJS via `package.json` scripts, but a Dockerfile would make the build reproducible and explicit.

**Issue DEVOPS-3 (Low):** No `/health` or `/ready` endpoint beyond the generic `GET /`. Railway and load balancers benefit from a proper health check.

---

## Code Quality Audit

| Metric | Score | Notes |
|---|---|---|
| Naming consistency | 8/10 | Consistent French UI, consistent English code |
| TypeScript usage | 7/10 | Many `any` types in service files |
| Modularity | 6/10 | ReservationsService and DashboardScreen are god files |
| Duplication | 7/10 | Wilaya list duplicated in SettingsScreen; minor overlap in auth screens |
| Dead code | 8/10 | Very little dead code found |
| Comments | 8/10 | Good inline comments, security notices in guards |
| Error handling | 7/10 | Consistent NestJS exceptions; some mobile screens lack error states |
| Test coverage | 3/10 | Unit test stubs exist but no real test logic; no E2E tests |

**Issue CQ-1 (Medium):** `any` type is used extensively in service files. While the runtime behavior is correct, this removes compile-time safety and makes refactoring dangerous.

**Issue CQ-2 (Low):** 14 markdown plan/audit files in the repository root (`IMPLEMENTATION_PLAN.md`, `barber-marketplace-plan.md`, `barberdz-frontend-plan.md`, etc. — 200KB+ total). These are development artifacts that should be moved to `/docs` or removed from the production branch.

---

## Critical Issues

| # | Issue | Location | Impact |
|---|---|---|---|
| C-1 | `find_nearby_salons` RPC has two conflicting signatures across migrations; if run out of order, geolocation degrades silently | `supabase/migrations/20260610000000`, `20260610030000` | Map shows wrong or no nearby salons |
| C-2 | `CHARGILY_WEBHOOK_URL` not configured in production → payment confirmations not processed | Railway env / `services/api/src/payments/chargily/chargily.service.ts` | Payments accepted but subscriptions never activated |

---

## High Issues

| # | Issue | Location | Impact |
|---|---|---|---|
| H-1 | No admin UI for Reviews moderation | `apps/admin/app/` | Admin cannot moderate abusive reviews from web panel |
| H-2 | Missing indexes on `salons(owner_id)` and `profiles(role)` | Database | Sequential scans on frequent queries |
| H-3 | Auth metadata role injection — `AppNavigator` uses `user_metadata.role` for auto-created profiles | `apps/mobile/src/navigation/AppNavigator.tsx` | Attacker could self-assign any role at signup |

---

## Medium Issues

| # | Issue | Location | Impact |
|---|---|---|---|
| M-1 | `ExploreScreen` fetches 200 salons at once with no cursor pagination | `apps/mobile/src/screens/client/ExploreScreen.tsx` | Performance degradation as data grows |
| M-2 | No admin Plans management UI | `apps/admin/app/` | Admin must use Supabase dashboard to change pricing |
| M-3 | `SalonSetupScreen` allows submission with default (Algiers) coordinates | `apps/mobile/src/screens/barber/SalonSetupScreen.tsx` | Salons appear at wrong map position |
| M-4 | No per-email rate limit on `/auth/resend-verification` and `/auth/reset-password` | `services/api/src/auth/auth.controller.ts` | Email spam potential |
| M-5 | `portfolio_photos` RLS policy not visible in migrations | `supabase/migrations/` | Potential unauthorized photo deletion |
| M-6 | `ReservationsService.create()` performs wide join on every booking creation | `services/api/src/reservations/reservations.service.ts` | Unnecessary DB load |
| M-7 | Admin payments page queries Supabase directly (bypasses API) | `apps/admin/app/payments/page.tsx` | Inconsistent with rest of admin panel; bypasses business logic |
| M-8 | No Dockerfile | `services/api/` | Builds are non-deterministic |
| M-9 | Cron job runs in UTC, Algeria is UTC+1 | `services/api/src/subscriptions/subscriptions.service.ts` | 1-hour subscription window after expiry |
| M-10 | `DashboardScreen` is 1,370 lines | `apps/mobile/src/screens/barber/DashboardScreen.tsx` | Maintainability risk |

---

## Low Issues

| # | Issue | Location | Impact |
|---|---|---|---|
| L-1 | Loyalty points per-reservation hardcoded to 10 | `services/api/src/auth/auth.controller.ts` | Inflexible; should be DB config |
| L-2 | `SettingsScreen` duplicates wilaya list vs shared constants | `apps/mobile/src/screens/client/SettingsScreen.tsx` | Drift risk |
| L-3 | `PhoneEntryScreen` and `PhoneInputScreen` overlap | `apps/mobile/src/screens/auth/` | Confusing user flow |
| L-4 | Two concurrent realtime subscriptions on active barber tabs | `useRealtimeBookings` | Redundant DB load |
| L-5 | No client realtime for booking status updates | `apps/mobile/src/screens/client/MyAppointmentsScreen.tsx` | Client must manually refresh |
| L-6 | No turn-by-turn route on map | `SalonMapView` | UX gap |
| L-7 | No loyalty points notification | `services/api/src/notifications/notifications.service.ts` | Missing user feedback |
| L-8 | Appointment reminders are device-local only | `apps/mobile/src/lib/notifications.ts` | Lost on device reset |
| L-9 | No health check endpoint | `services/api/src/app.controller.ts` | Railway monitoring gap |
| L-10 | 200KB+ of plan/audit markdown files in repo root | `repo root` | Bloated repository |
| L-11 | `advanced_statistics`, `marketing_included`, `priority_support` are display-only plan features | Frontend + plans table | No backend enforcement |
| L-12 | `salons.rating` vs `salons.average_rating` naming inconsistency between RPC and table | DB + SalonsService | Technical debt |
| L-13 | `any` types widespread in service files | `services/api/src/` | Compile-time safety gap |

---

## Missing Features

1. **Admin Reviews moderation** — No web UI to delete reviews
2. **Admin Plans CRUD** — No web UI to manage plan prices/features
3. **Admin Analytics page** (Next.js) — Endpoint exists, no page
4. **Server-side appointment reminders** — Client-side only, unreliable
5. **Map route drawing** — No directions from user to salon
6. **Client real-time booking status updates** — Must refresh manually
7. **Salon search by service type** — Only name/wilaya search available (service-type filtering is client-side only)
8. **Portfolio photo ordering** — No ability to reorder photos
9. **Staff availability management** — Each staff member cannot have individual working hours

---

## Technical Debt

1. `find_nearby_salons` has two conflicting migration definitions — consolidate into one idempotent migration
2. `ReservationsService` and `DashboardScreen` are god files — split by concern
3. `any` types in service layer — add proper TypeScript interfaces
4. Wilaya list duplicated in `SettingsScreen` — use shared constants
5. First audit migration (`20260609140000`) contains a buggy trigger that is overwritten by a later migration — can be removed
6. `plan_price` sync requires triggers — fragile; consider computed columns or materialized views
7. `ratings` vs `average_rating` dual naming — standardize in RPC output
8. 200KB+ planning markdown files in repo root — move to `/docs` branch or remove

---

## Launch Blockers

1. **C-1:** Ensure `find_nearby_salons` migration `20260610030000` is the final applied definition; drop the conflicting one from `20260610000000` or add idempotency guard
2. **C-2:** Set `CHARGILY_WEBHOOK_URL` on Railway to the deployed API URL + `/api/v1/payments/webhook`
3. **H-3:** Fix AppNavigator auto-profile-create to hardcode `role: 'Client'` instead of reading from `user_metadata.role`

---

## Recommended Fix Order

1. **Fix `CHARGILY_WEBHOOK_URL` on Railway** (30 min) — Payments are broken in production without this
2. **Harden AppNavigator profile auto-create** — hardcode `role: 'Client'` (30 min)
3. **Add `salons(owner_id)` and `profiles(role)` DB indexes** (30 min) — Immediate performance win
4. **Confirm `portfolio_photos` RLS** — Check and add if missing (30 min)
5. **Add admin Reviews moderation page** (1 day) — Expose existing DELETE endpoint
6. **Add admin Analytics page** (half day) — Expose existing endpoint
7. **Add per-email rate limiting** on reset-password and resend-verification (2 hours)
8. **Split `ReservationsService`** into creation + query services (1 day)
9. **Split `DashboardScreen`** into sub-components (1 day)
10. **Implement cursor pagination** in ExploreScreen (half day)
11. **Add Dockerfile** for Railway (2 hours)
12. **Add `/health` endpoint** (30 min)
13. **Add `admin Plans` management page** (1 day)

---

## Top 50 Improvements

1. Configure `CHARGILY_WEBHOOK_URL` in Railway
2. Harden AppNavigator auto-create: hardcode `role: 'Client'`
3. Add `CREATE INDEX IF NOT EXISTS idx_salons_owner_id ON salons(owner_id)`
4. Add `CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role)`
5. Confirm and add RLS policies on `portfolio_photos` table
6. Add admin Reviews moderation page (Next.js)
7. Add admin Plans CRUD page (Next.js)
8. Add admin Analytics page (Next.js)
9. Add `CHARGILY_WEBHOOK_URL` to env validation as production-required
10. Split `ReservationsService` into creation, query, and cron sub-services
11. Split `DashboardScreen` into DashboardStats, ReservationsList, and ActionModals
12. Implement cursor-based pagination for ExploreScreen (replace 200-salon bulk fetch)
13. Add per-email/per-IP rate limiting on auth resend and reset endpoints
14. Remove duplicate Wilaya list from `SettingsScreen` — use shared constants
15. Consolidate `PhoneEntryScreen` and `PhoneInputScreen` into one parametrized component
16. Add server-side appointment reminders via cron + push
17. Add client-side realtime subscription for booking status changes
18. Standardize `find_nearby_salons` to a single idempotent migration; remove duplicate definition
19. Standardize `rating` → `average_rating` in RPC RETURNS TABLE definition
20. Replace `any` types in SalonsService, ReservationsService, AdminService with proper interfaces
21. Add a `/health` readiness endpoint to AppController
22. Add a Dockerfile for reproducible Railway builds
23. Add loyalty points notification when points are earned
24. Run cron in Algeria timezone (`Africa/Algiers`) rather than UTC
25. Add `CHARGILY_WEBHOOK_URL` and `PAYMENT_SUCCESS_URL`, `PAYMENT_FAILURE_URL` to `.env.example`
26. Cache salon owner lookup in `findByOwner` (same pattern as slot cache)
27. Reduce `ReservationsService.create()` join width — split into targeted queries
28. Add `is_walk_in` filter to analytics endpoint for clean revenue figures
29. Add map route/directions from user location to salon
30. Move 200KB+ planning markdown files to `/docs` folder or separate branch
31. Add E2E tests using Detox or Maestro for booking flow
32. Add integration tests for payment webhook flow
33. Remove the first (broken) audit migration `20260609140000` or mark it superseded in a comment header
34. Add admin page to manage user push notifications
35. Add `NEXT_PUBLIC_API_URL` validation to admin app startup
36. Implement cursor pagination in admin salons/users lists (currently page-based with hardcoded 50 limit)
37. Add a "pending" badge/filter to the admin all-salons page for quick access
38. Add salon sponsoring controls to Next.js admin panel (currently mobile-only)
39. Add SalonMapView refresh trigger on salon open/close toggle
40. Add shared singleton for realtime subscription to avoid dual subscriptions on barber tabs
41. Add `plan_price` column update test to CI — trigger failure would be silent
42. Add `BookingScreen` guest mode (unauthenticated user redirected to login)
43. Add wilaya pre-filtering to `find_nearby_salons` RPC for multi-wilaya markets
44. Add `force_closed` column cleanup migration (drop if still present)
45. Add portfolio photo ordering (drag-to-reorder)
46. Add individual staff working hours
47. Add client-facing reservation cancellation deadline (e.g. cannot cancel within 2 hours)
48. Add search-by-service-type to backend (`/salons?service=coupe`)
49. Add APM (Application Performance Monitoring) via Sentry performance tracing on Railway
50. Add audit log entries for owner-initiated mutations (salon creation, service changes)

---

## Final Scorecard

| Module | Score | Key Factors |
|---|---|---|
| **Frontend** | **74/100** | Strong mobile app; god files; two auth screen duplicates |
| **Backend** | **80/100** | Well-structured NestJS; correct guards; cron; wide joins; hardcoded constants |
| **Database** | **74/100** | Good RLS coverage; critical indexes added; migration conflict risk; missing 2 indexes |
| **Integration** | **73/100** | Most flows work end-to-end; admin payments page bypasses API |
| **Security** | **72/100** | Core vectors covered; metadata role injection gap; no per-email rate limiting |
| **Performance** | **68/100** | PostGIS + Redis solid; missing indexes; 200-salon bulk fetch; god file re-render surface |
| **DevOps** | **65/100** | Railway + Vercel + EAS configured; no CHARGILY_WEBHOOK_URL; no Dockerfile; no /health |
| **Code Quality** | **69/100** | Good naming and comments; widespread `any`; god files; no E2E tests; docs in root |

---

## Final Verdict

**Project Completion: 78%**

**Production Readiness: 61/100**

**Launch Status: ❌ NOT READY**

**Estimated Work Remaining:** 2–3 weeks (with 1 developer) to resolve all blockers and high-priority issues, reach production readiness score of 85+.

**Top 5 Priorities:**

1. **Configure `CHARGILY_WEBHOOK_URL`** on Railway immediately — payments silently fail without it
2. **Harden auth profile auto-create** — `role: 'Client'` must be hardcoded, not read from client metadata
3. **Add missing DB indexes** (`salons.owner_id`, `profiles.role`) — performance fix with no downside
4. **Add admin Reviews moderation page** — only then can the admin actually moderate platform content
5. **Resolve `find_nearby_salons` migration conflict** — consolidate to a single idempotent definition

---

*This report is read-only. No files were modified. No code was generated. Audit only.*
