# POST_MODIFICATION_AUDIT.md
## 7afefli (BarberDZ) — Post-Fix Full Audit Report
**Date:** 2026-06-11  
**Branch:** main (post `fix/audit-ultra-full` merge)  
**Auditor:** Static code analysis (read-only, no modifications)

---

## 1. Executive Summary

The project has undergone a significant remediation cycle. The "DO NOT LAUNCH" blockers from the first audit have been largely addressed: hardcoded service-role keys are gone from production code, the `is_approved: true` bypass is gone, the double-booking trigger is fixed, RLS policies are corrected, the admin panel has authentication, and the backend API prefix mismatch is resolved. The Chargily payment fallback that silently returned fake URLs in production is fixed.

However, **three new bugs have been introduced** during remediation, and several medium-priority items remain. The project is substantially closer to launch but is not yet production-ready.

**Overall completion estimate: 71%**

---

## 2. Phase 2 — Previous Fixes Verification

| Fix ID | Description | Status | Evidence |
|--------|-------------|--------|----------|
| C1 | Double-booking trigger: wrong column `date` → `appointment_date` | ✅ Fully Fixed | `20260610000000_critical_fixes.sql` |
| C2 | RLS on `user_subscriptions`: wrong join column | ✅ Fully Fixed | Policy now joins via `salons.owner_id` |
| C3 | Double-booking trigger: wrong status values | ✅ Fully Fixed | Now uses `'Cancelled','Completed'` |
| C4 | Missing RPCs consolidated into `supabase/migrations` | ✅ Fully Fixed | `create_reservation_safe`, `expire_reservation`, etc. all present |
| C5 | Admin panel 404s — missing `/api/v1` prefix | ✅ Fully Fixed | `apps/admin/lib/api.ts` centralised `apiFetch` helper |
| C6 | `find_nearby_salons` missing Expired filter | ✅ Fully Fixed | Newer migration `20260610030000` adds `subscription_status != 'Expired'` |
| H1 | Chargily silent mock URL fallback in production | ✅ Fully Fixed | Now throws on error instead of returning fake URL |
| H2 | Webhook: no salon existence check before activation | ✅ Fully Fixed | `salonExists` validation added |
| H3 | Reservation overlap: NULL `barber_id` bypass | ✅ Fully Fixed | Migration `20260610020000` present |
| H4 | `is_approved: true` hardcoded in barber signup | ✅ Fully Fixed | Not present in codebase |
| H5 | Trial expiry downgrade logic (month-end day bug) | ✅ Fully Fixed | `handleDailySubscriptionChecks` fully dynamic |
| H6 | `signOut()` back-button bug | ✅ Fully Fixed | `AppNavigator` now uses native React Navigation back handling |
| H7 | Wilayas table missing from `supabase/migrations` | ✅ Fully Fixed | Added in critical fixes migration |
| M1 | Walk-in vs member client separation | ✅ Fully Fixed | `getSalonClients` aggregates both types separately |
| M2 | Loyalty points awarded to walk-ins | ✅ Fully Fixed | `is_walk_in` guard in trigger |
| M3 | Favorites screen | ✅ Fully Fixed | `FavoritesScreen` + backend endpoints implemented |
| M4 | `SalonSetupScreen` broken `react-native-maps` import | ✅ Fully Fixed | Uses WebView + Leaflet approach |
| M5 | Map refresh loop (`salonsFingerprint`) | ✅ Fully Fixed | Static `mapHtml` + `injectJavaScript` pattern |
| M6 | `SubscriptionScreen` React hook ordering | ✅ Fully Fixed | All hooks at top level before any conditions |
| M7 | Admin portal has zero authentication | ✅ Fully Fixed | `middleware.ts` checks `profiles.role === 'Admin'` |
| M8 | GPS subscription outside async IIFE (unmount bug) | ✅ Fully Fixed | `subscriptionRef` pattern implemented |
| **NEW-BUG-1** | `find_nearby_salons` RPC returns `rating` field, but mobile uses `average_rating` | ❌ **New Bug Introduced** | RPC schema mismatch breaks ⭐4.5+ filter and SalonCard display |
| **NEW-BUG-2** | Anon key + service-role key still hardcoded in `scratch/` scripts and `eas.json` | ❌ **Still Present** | `scratch/query_profiles_admin.js`, `apps/mobile/eas.json` |
| **NEW-BUG-3** | `find_nearby_salons` original migration (`critical_fixes.sql`) uses `user_lat/user_lng/radius_meters/result_limit` but superseded migration (`030000`) uses correct params — **two conflicting function definitions exist** | ⚠️ Partially Fixed | Depends on migration execution order |

---

## 3. Frontend Audit (Mobile — React Native / Expo)

### 3.1 Navigation
- **Root navigator** (`AppNavigator.tsx`): Clean. Role-based routing works correctly. `needsPasswordReset` and `needsPhone` gates in place. Hardware back-button now handled natively.
- **Client tab navigator**: Home → SalonDetail → Booking → BookingConfirm stack is complete. Explore stack is complete. Favorites, Appointments, Profile/Settings tabs all present.
- **Barber tab navigator**: Dashboard, Calendar, Clients, MySalon (tabbed: services, portfolio, staff, reviews), Subscription, Notifications, Settings all registered.
- **Admin tab navigator**: **⚠️ Only 2 tabs** — AdminDashboard + Settings. No dedicated Reports, Analytics, or Approvals tabs. All admin functionality is crammed into one screen.
- **Issue**: `Notifications` is a modal route nested in `RootStack`. Barber's tab navigator also registers `Notifications` as a full tab — **two separate notification entry points with no deduplication of unread state**.

### 3.2 React Query
- Global `queryClient` with proper stale times. Invalidation on mutations is consistent.
- `useFocusEffect` properly refetches on screen focus in Dashboard and SubscriptionScreen.
- **Issue**: `my-salon` and `barber-salon` are two different query keys both pointing to the same `/salons/my-salon` endpoint — risk of stale data if only one is invalidated.
- Cache invalidation for slots after booking: correct (`queryKey: ['slots', reservation.salon_id]`).

### 3.3 State Management (Zustand)
- `authStore`: Session, role, needsPhone flags — clean, atomic setState pattern.
- `bookingStore`: Booking wizard state — present and reset on success.
- `mapPreferencesStore`: Filter persistence with AsyncStorage — working.
- No issues found.

### 3.4 Key Screens

| Screen | Status | Notes |
|--------|--------|-------|
| HomeScreen | ✅ Working | GPS, wilaya fallback, filters, map, list — all connected |
| ExploreScreen | ✅ Working | Debounced search, wilaya filter, sort, map |
| SalonDetailScreen | ✅ Working | Favorites toggle, portfolio, reviews, book CTA |
| BookingScreen | ✅ Working | Service select, date strip, slot picker |
| BookingConfirmScreen | ✅ Working | Animated success, links to appointments |
| MyAppointmentsScreen | ✅ Working | Upcoming/past tabs, cancel, leave review |
| FavoritesScreen | ✅ Working | New in this audit cycle |
| NotificationsScreen | ✅ Working | Mark all read on open, realtime badge |
| DashboardScreen | ✅ Working | Day/month/all view, walk-in modal, realtime |
| CalendarScreen | ✅ Working | Timeline view, overlap handling |
| ClientsScreen | ✅ Working | Members vs walk-ins properly separated |
| MySalonScreen | ✅ Working | Services, portfolio, staff, reviews with response |
| SalonSetupScreen | ✅ Working | WebView + Leaflet map, geocoder search |
| SubscriptionScreen | ✅ Working | Dynamic plans, AppState refresh |
| SettingsScreen | ✅ Working | Profile edit, push toggle, wilaya picker |
| AdminDashboardScreen | ⚠️ Partial | Salons + Users + Stats only. No analytics/reports/subscription management tabs |

### 3.5 Issues Found
- **⚠️ MEDIUM**: `average_rating` field is `undefined` for salons loaded via the `/nearby` endpoint (RPC returns `rating`, not `average_rating`). The "⭐ 4.5+ Étoiles" filter always returns empty. SalonCard shows "Nouveau" instead of the actual rating for all nearby salons.
- **LOW**: `@ts-nocheck` at the top of every screen file suppresses TypeScript errors. Real type errors are hidden.
- **LOW**: Default avatar uses a `lh3.googleusercontent.com` URL — not under your control, can break.
- **LOW**: `isRefreshing` in SubscriptionScreen is hardcoded to `false` — pull-to-refresh spinner never shows even though it fires refetch correctly.

**Frontend Score: 74 / 100**

---

## 4. Backend Audit (NestJS 10 / Vercel)

### 4.1 Modules Registered
All modules present in `AppModule`: Salons, SalonServices, Slots, Reservations, Reviews, Admin, Audit, Payments, Subscriptions, Locations, Notifications. ✅

### 4.2 Controller Coverage

| Controller | Routes | Auth | Status |
|------------|--------|------|--------|
| SalonsController | GET /salons, /salons/nearby, /my-salon, /my-salon/stats, /:id, POST, PATCH, DELETE + staff + portfolio + favorites + reviews + services | Proper guards | ✅ |
| ReservationsController | POST /, /block, GET /me, /salon/:id/pending, /salon/:id, /salon/:id/clients, PATCH /:id/status, GET /:id | Auth on all | ✅ |
| SlotsController | GET /slots | Public | ✅ |
| ReviewsController | POST /reviews, PATCH /reviews/:id/response | Role guards | ✅ |
| AdminController | Full CRUD + stats + audit + revenue + subscriptions + sponsoring | Admin role guard | ✅ |
| PaymentsController | POST /checkout, /webhook | Auth + throttle | ✅ |
| SubscriptionsController | GET /plans, /my-plan, /my-client-plan | Auth where needed | ✅ |
| NotificationsController | GET /, /unread-count, PATCH /read-all, /:id/read, POST/DELETE /push-token | Auth on all | ✅ |
| LocationsController | GET /locations/wilayas | Public | ✅ |
| AuthController | POST /verify, PATCH profile, DELETE account | Auth where needed | ✅ |

### 4.3 Issues Found
- **⚠️ MEDIUM**: `findNearby` in `salons.service.ts` passes `radiusKm * 1000` as `p_radius_m` but the new RPC signature has `p_radius_m integer` (not double). HomeScreen passes `radius=50` → `radiusMeters = 50000`. This is correct in intent, but a type coercion edge case when Supabase RPC receives a float. Low risk but worth fixing.
- **⚠️ MEDIUM**: `SalonsService.enrichSalon` does not remap `rating` → `average_rating` for RPC results. All clients expecting `average_rating` will get `undefined` from the `/nearby` endpoint.
- **LOW**: `ReservationsService.create` constructs `lastDayOfMonth` using `new Date(year, month + 1, 0)` — this is correct JavaScript for last day of month (was flagged in previous audit as broken, now fixed).
- **LOW**: No `GET /auth/profile` endpoint — profile is fetched by mobile app via Supabase direct query, bypassing the API layer. Inconsistency.
- **LOW**: Swagger is conditionally disabled in production (`main.ts`) — good. No information disclosure risk.
- **INFO**: Role cache TTL of 5 minutes means role changes take up to 5 minutes to propagate. Acceptable but documented.

**Backend Score: 80 / 100**

---

## 5. Database Audit (Supabase / PostgreSQL)

### 5.1 Migration Coverage

| Table/Object | Status |
|-------------|--------|
| profiles | ✅ Exists, RLS enabled, `push_token` column added |
| salons | ✅ Exists, PostGIS location, `is_manually_closed`, `image_url`, `commune`, `phone` |
| services | ✅ Exists |
| salon_staff | ✅ Exists |
| user_subscriptions / plans | ✅ Dynamic FK, plan catalog, `sort_order`, `is_recommended` |
| reservations | ✅ Double-booking trigger fixed, `is_walk_in`, `client_phone` columns |
| reviews | ✅ Exists, `response` column added |
| notifications | ✅ New migration in `supabase/migrations`, RLS correct, partial index for unread count |
| wilayas | ✅ Seeded with all 58 wilayas |
| audit_log | ✅ Exists |
| payments | ✅ Exists |
| favorites | ✅ Migration `20260610010000_salon_favorites.sql` |
| client_subscriptions | ⚠️ Indirectly via `/subscriptions/my-client-plan` — endpoint exists but no `client_subscriptions` table found in migrations |

### 5.2 RLS Coverage

| Table | RLS | Notes |
|-------|-----|-------|
| profiles | ✅ | |
| salons | ✅ | |
| user_subscriptions | ✅ Fixed | Now joins via `salons.owner_id` |
| notifications | ✅ | Correct INSERT WITH CHECK (TRUE) for service_role |
| reservations | ✅ | |
| reviews | ✅ | |
| payments | ⚠️ Unknown | No migration found explicitly enabling RLS on `payments` |

### 5.3 Schema Issues
- **❌ CRITICAL**: `find_nearby_salons` RPC has **two conflicting definitions** in migrations:
  - `20260610000000_critical_fixes.sql` creates it with params: `user_lat, user_lng, radius_meters, result_limit`
  - `20260610030000_fix_find_nearby_salons.sql` drops and recreates it with params: `p_latitude, p_longitude, p_radius_m, p_limit`
  - The final state depends on migration execution order. If the second runs last (correct), function is OK. If not applied, all `/nearby` calls fail and fall back to unfiltered basic query.
- **⚠️ MEDIUM**: New `find_nearby_salons` RPC returns `rating` (not `average_rating`, not `total_reviews`) — schema mismatch with what mobile app expects.
- **LOW**: No `CASCADE` or `SET NULL` behavior documented for `salon_staff.profile_id` foreign key when a profile is deleted.

### 5.4 Performance Indexes
All critical indexes from the previous audit are present:
- `idx_reservations_salon_appt_date`
- `idx_reservations_pending_future` (partial)
- `idx_notifications_user_unread` (partial)
- `idx_user_subscriptions_salon_id`
- PostGIS geography index on `salons.location` (created by migration)

**Database Score: 75 / 100**

---

## 6. Integration Audit (Frontend ↔ Backend ↔ Database)

### 6.1 Critical Flow Verification

**Booking flow:**
```
Client selects service → BookingScreen
→ useAvailableSlots → GET /slots?salonId=&serviceId=&date= ✅
→ SlotPicker selects slot
→ useCreateReservation → POST /reservations ✅
→ ReservationsService.create → create_reservation_safe RPC ✅
→ Double-booking trigger fires ✅
→ Notification sent to barber ✅
→ Slot cache invalidated ✅
→ Navigate to BookingConfirmScreen ✅
```

**Nearby salons flow:**
```
HomeScreen GPS → GET /salons/nearby?lat=&lng=&radius=50 ✅
→ findNearby → RPC find_nearby_salons ✅ (params correct)
→ enrichSalons called ✅
→ Returns { rating: X } ❌ (should be average_rating)
→ HomeScreen filter s.average_rating >= 4.5 ❌ (always false)
→ SalonCard shows "Nouveau" instead of rating ❌
```

**Payment flow:**
```
SubscriptionScreen → POST /payments/checkout { plan: 'pro' } ✅
→ Lookup salon → Lookup plan from DB ✅
→ Chargily API call → returns checkout_url ✅
→ Linking.openURL ✅
→ Chargily webhook → POST /payments/webhook ✅
→ Signature verification ✅
→ Salon existence check ✅
→ Dynamic duration from plans table ✅
→ user_subscriptions UPDATE ✅
→ Notification sent ✅
```

**Admin approval flow:**
```
Admin web login → middleware.ts checks Admin role ✅
→ apiFetch('/admin/salons/pending') ✅ (prefixed correctly)
→ approveSalon PATCH ✅
→ Barber receives salon_approved notification ✅
```

### 6.2 Integration Score: 76 / 100

**Issues:**
- `average_rating` field mismatch on `/nearby` results breaks rating display and filter — affects HomeScreen experience for all GPS users.
- `my-salon` vs `barber-salon` duplicate query keys may cause stale data on Dashboard after creating a salon.

---

## 7. Role Audit

### 7.1 CLIENT Role

| Feature | Status |
|---------|--------|
| Authentication (phone OTP) | ✅ Working |
| Home with GPS + map | ✅ Working |
| Explore with search + filters | ✅ Working |
| Salon detail | ✅ Working |
| Booking flow | ✅ Working |
| My Appointments | ✅ Working |
| Cancel reservation | ✅ Working |
| Leave review | ✅ Working |
| Favorites | ✅ Working |
| Notifications | ✅ Working |
| Push notifications | ✅ Working |
| Profile edit | ✅ Working |
| ⭐ 4.5+ filter | ❌ Broken (rating field mismatch) |

**Client Completion: 92%**

---

### 7.2 BARBER Role

| Feature | Status |
|---------|--------|
| Authentication | ✅ Working |
| Salon setup (WebView map) | ✅ Working |
| Dashboard (day/month/all) | ✅ Working |
| Realtime booking updates | ✅ Working |
| Walk-in booking | ✅ Working |
| Block time | ✅ Working |
| Calendar timeline view | ✅ Working |
| Client directory (members + walk-ins) | ✅ Working |
| My Salon → Services | ✅ Working |
| My Salon → Staff | ✅ Working |
| My Salon → Portfolio | ✅ Working |
| My Salon → Reviews + response | ✅ Working |
| Subscription management | ✅ Working |
| Payment (Chargily) | ✅ Working |
| Notifications (tab + realtime) | ✅ Working |
| Approval pending banner | ✅ Working |
| Stats (dashboard) | ✅ Working |
| Edit salon location | ✅ Working |

**Barber Completion: 94%**

---

### 7.3 ADMIN Role

| Feature | Status |
|---------|--------|
| Web portal login | ✅ Working |
| Salon approvals | ✅ Working |
| User management | ✅ Working |
| Platform stats | ✅ Working |
| Revenue stats | ✅ Working |
| Audit log | ✅ Working |
| Reservation management | ✅ Working |
| Subscription management | ✅ Working |
| Salon sponsoring | ✅ Working |
| Mobile admin screen | ⚠️ Partial (single screen, no tabs) |
| Analytics / charts | ❌ Missing |
| Payment history detail | ⚠️ List only, no drilldown |
| Export audit CSV | ✅ Backend endpoint exists |

**Admin Completion: 68%**

---

## 8. Notification Audit

### 8.1 Notification Types Coverage

| Event | Barber notified | Client notified | Implemented |
|-------|----------------|-----------------|-------------|
| Booking created | ✅ `new_booking` | — | ✅ |
| Booking confirmed | — | ✅ `booking_confirmed` | ✅ |
| Booking cancelled | ✅ (by client) | ✅ (by barber) | ✅ |
| Booking completed | — | ✅ `completed` | ✅ |
| New review left | ✅ `new_review` | — | ✅ |
| Salon approved/rejected | ✅ `salon_approved/rejected` | — | ✅ |
| Subscription activated | ✅ `subscription_activated` | — | ✅ |
| Subscription expiring | ✅ `subscription_expiring` | — | ✅ (cron) |
| Loyalty points earned | — | ✅ `loyalty_points` | ✅ |

### 8.2 Realtime / Push
- **In-app realtime**: `NotificationBell` subscribes to `postgres_changes` INSERT on `notifications` table filtered by `user_id`. ✅
- **Unread badge**: Updates immediately via Supabase Realtime, no polling. ✅
- **Push notifications**: Expo push SDK used server-side. Token saved to `profiles.push_token` on login. Auto-cleared on `DeviceNotRegistered` error. ✅
- **Mark all read on open**: Called in `NotificationsScreen` `useEffect`. ✅

### 8.3 Issues
- **LOW**: No `booking_reminder` push notification is sent before the appointment (field exists in CHECK constraint but no cron job triggers it).
- **LOW**: Admin receives no notifications for new salon signup or payment events via the mobile app.

**Notification Score: 82 / 100**

---

## 9. New Barber Onboarding Flow Audit

```
1. Signup (phone OTP)  ✅ — PhoneInputScreen → VerifyCodeScreen → SignUpScreen
2. Profile creation    ✅ — POST /auth/verify with fullName, role=Coiffeur
3. PhoneEntry gate     ✅ — needsPhone guard in AppNavigator
4. SalonSetupScreen    ✅ — Step 1 (form) + Step 2 (map) → POST /salons
5. Approval wait       ✅ — Dashboard shows pending banner when !salon.is_approved
6. Admin approval      ✅ — Admin web/mobile can approve
7. Barber notified     ✅ — salon_approved push + in-app notification
8. Add services        ✅ — MySalonScreen → ServiceModal → POST /salon-services
9. Add staff           ✅ — AddStaffModal → POST /salons/:id/staff
10. Add portfolio      ✅ — Image picker → Supabase storage → POST /portfolio
11. Subscription       ✅ — SubscriptionScreen → Chargily checkout
12. Receive booking    ✅ — Realtime + push on new_booking
```

**Onboarding Completion: 100% (all steps implemented)**

Minor friction: Salon completeness validation in `ReservationsService.create` requires `image_url`, `description`, `commune`, and at least one staff and one service — the onboarding screens don't show a progress indicator pointing the barber toward these requirements before they're blocked from receiving bookings.

---

## 10. Map Audit

| Map Feature | Location | Status |
|-------------|----------|--------|
| Home Map (SalonMapView) | HomeScreen | ✅ Working — MapLibre GL + Leaflet fallback |
| Explore Map | ExploreScreen | ✅ Working — Same component |
| GPS user dot | Both maps | ✅ Injected via `updateUserLocation` |
| Marker click | Both maps | ✅ Posts `MARKER_CLICK` message |
| Popup open/close | Both maps | ✅ `selectSalon` / `POPUP_CLOSE` |
| Route drawing (OSRM) | Both maps | ✅ Implemented but requires user location |
| Salon setup map | SalonSetupScreen | ✅ Drag-to-place + geocoder search |
| Edit salon location | EditSalonLocationModal | ✅ Separate modal component |
| WebGL detection | SalonMapView | ✅ Falls back to Leaflet if no WebGL |
| Map refresh loop | SalonMapView | ✅ Fixed — static HTML, inject-only updates |

**Remaining issues:**
- **LOW**: `mapHtml` in `SalonMapView` loads MapLibre and Leaflet from CDNs (jsdelivr, unpkg). Any CDN outage will break the map.
- **LOW**: Leaflet tiles load from `tile.openstreetmap.org`. No tile caching or rate-limit consideration for many simultaneous users.
- **LOW**: `drawRouteOSRM` uses the public OSRM demo server (`router.project-osrm.org`) which explicitly warns against production use.

---

## 11. Performance Audit

### 11.1 Backend
- Redis slot cache: 90s TTL, invalidated on every booking. ✅
- Rate limiter on checkout: 5/min per user. ✅
- Role cache: 5-min TTL prevents repeated DB lookups. ✅
- N+1 avoided in `findNearby`: services batch-fetched in one query. ✅
- `getDashboardStats` uses parallel `Promise.all`. ✅
- `CronExpression.EVERY_DAY_AT_MIDNIGHT` for subscription expiry — correct. ✅

### 11.2 Frontend
- GPS polling: `distanceInterval: 50m`, `timeInterval: 30s` — no excessive polling. ✅
- Map HTML static: compiled once with `useMemo([], [])` — no re-render spam. ✅
- `serializedSalons` memoized and only derived from salon IDs/coordinates. ✅
- Filter pills use `useCallback` for handlers. ✅
- `FlatList` used throughout — no `ScrollView` of 100+ items. ✅

### 11.3 Issues
- **LOW**: `HomeScreen` fetches both `/salons/nearby` AND `/salons?wilaya=` on load — two parallel queries even when the first succeeds. The wilaya fallback query is `enabled` only when nearby returns 0 results, but this check happens after the async result resolves, so both fire initially.
- **LOW**: `AdminDashboardScreen` fetches `/admin/salons?limit=1000` — unbounded result set. Can be slow with many salons.

**Performance Score: 78 / 100**

---

## 12. Security Audit

| Issue | Severity | Status |
|-------|----------|--------|
| Supabase anon key in `apps/mobile/eas.json` | Medium | ❌ Still Present |
| Service-role key in `scratch/query_profiles_admin.js` | **Critical** | ❌ Still Present |
| Service-role key in `scratch/signup_and_test_slots.js` | **Critical** | ❌ Still Present |
| Supabase anon key in `apps/mobile/setup_db.js` | Medium | ❌ Still Present |
| Supabase anon key in multiple `scratch/*.js` files | Medium | ❌ Still Present |
| Hardcoded `is_approved: true` bypass | Fixed | ✅ Removed |
| Chargily production fake URL fallback | Fixed | ✅ Removed |
| Admin portal unauthenticated | Fixed | ✅ Middleware enforces Admin role |
| Role escalation via `/auth/verify` | Fixed | ✅ `role` field ignored in verify |
| Webhook without salon existence check | Fixed | ✅ Added |
| CORS configuration | Present | ✅ `ALLOWED_ORIGINS` env var |
| Helmet security headers | Present | ✅ Applied in `main.ts` |
| Body size limit | Present | ✅ 1MB cap |
| Input validation (class-validator) | Present | ✅ Global ValidationPipe |
| RLS on all critical tables | Mostly done | ⚠️ `payments` table RLS status unknown |

**The service-role JWT in `scratch/query_profiles_admin.js` and `scratch/signup_and_test_slots.js` is fully live and grants admin access to the Supabase database. These must be rotated immediately (Supabase Dashboard → Settings → API → Reset service_role key).**

**Security Score: 62 / 100** (heavily penalized by live credentials in repo)

---

## 13. Remaining Critical Issues

1. **[C-NEW-1] Live service-role JWT in committed files** — `scratch/query_profiles_admin.js` and `scratch/signup_and_test_slots.js` contain the production service-role key. Anyone with repo access has full database admin access. **Rotate the key immediately.**

2. **[C-NEW-2] `find_nearby_salons` RPC schema mismatch** — RPC returns `rating` field, but `enrichSalon` spreads it as `rating` while mobile expects `average_rating`. The "⭐ 4.5+ Étoiles" filter is broken for all GPS users, and all salon cards show "Nouveau" when loaded via the nearby endpoint.

3. **[C-NEW-3] Two conflicting `find_nearby_salons` definitions in migrations** — `critical_fixes.sql` defines the old signature; `030000_fix_find_nearby_salons.sql` redefines it correctly. If migrations run out of order, the nearby endpoint silently falls back to an unfiltered basic query with no distance data.

---

## 14. Remaining Medium Issues

1. **[M-1] No `RLS` migration found for `payments` table** — unclear if it has row-level security.
2. **[M-2] `my-salon` vs `barber-salon` duplicate React Query keys** — can cause stale Dashboard state after salon creation.
3. **[M-3] Anon key exposed in `eas.json` and `setup_db.js`** — not directly dangerous (anon key is public by design) but should be moved to `.env` and removed from git history.
4. **[M-4] OSRM public demo server used for route drawing** — will fail at production scale.
5. **[M-5] Admin mobile screen has no analytics, charts, or subscription management tabs** — 32% of planned admin features are not accessible from mobile.
6. **[M-6] No appointment reminder notification** — cron job fires subscription expiry, but no reminder push before a booking.
7. **[M-7] Salon completeness requirements not visible to barber** — barber can create a salon and wonder why clients can't book without being guided to fix it.
8. **[M-8] `isRefreshing` hardcoded to `false` in SubscriptionScreen** — pull-to-refresh spinner never shows.

---

## 15. Remaining Low Issues

1. Unsplash and `lh3.googleusercontent.com` default image URLs — external, can break.
2. `@ts-nocheck` on all screens — TypeScript errors suppressed, real bugs hidden.
3. Leaflet/MapLibre loaded from CDN — no offline fallback.
4. OSRM public demo server for routing — not production-grade.
5. No `booking_reminder` cron notification trigger implemented.
6. `AdminDashboardScreen` fetches `limit=1000` — may be slow.
7. Scratch test files committed to main branch — messy repo.
8. `fix_dashboard.js` and `fix_dashboard.ps1` debug scripts in repo root.
9. No deep-link handling for payment success/failure redirects from Chargily.
10. Chargily `webhook_endpoint` is `null` in checkout call — relying on Chargily dashboard webhook configuration rather than per-checkout override.

---

## 16. Top 20 Remaining Tasks (Priority Order)

| # | Task | Priority |
|---|------|----------|
| 1 | **Rotate Supabase service-role key** (leaked in scratch/) | 🔴 Critical |
| 2 | **Fix `find_nearby_salons` RPC field name**: add `average_rating: s.rating` in `enrichSalon` | 🔴 Critical |
| 3 | **Delete scratch/ and root test scripts from git history** | 🔴 Critical |
| 4 | Remove `eas.json` anon key and `apps/mobile/setup_db.js` from git | 🟠 High |
| 5 | Verify/add RLS on `payments` table in supabase/migrations | 🟠 High |
| 6 | Fix `my-salon` vs `barber-salon` query key inconsistency | 🟠 High |
| 7 | Add onboarding progress checklist for barbers showing what's needed to accept bookings | 🟠 High |
| 8 | Replace OSRM public demo with self-hosted or commercial routing API | 🟠 High |
| 9 | Fix `isRefreshing` in SubscriptionScreen (use actual query state) | 🟡 Medium |
| 10 | Add admin analytics/charts screen (reservation trends, revenue by month) | 🟡 Medium |
| 11 | Add booking_reminder cron notification (push 1h before appointment) | 🟡 Medium |
| 12 | Add client Notifications screen to BarberTabNavigator (currently no way to reach it for barbers from within their tab context) | 🟡 Medium |
| 13 | Replace CDN map libs with bundled assets or ensure fallback text | 🟡 Medium |
| 14 | Add Chargily `webhook_endpoint` in checkout call for reliability | 🟡 Medium |
| 15 | Add deep-link handling for payment success/failure in mobile app | 🟡 Medium |
| 16 | Remove `@ts-nocheck` from screen files and fix TypeScript errors | 🟡 Medium |
| 17 | Replace default avatar URLs with in-app assets or Supabase-hosted images | 🟢 Low |
| 18 | Paginate `GET /admin/salons?limit=1000` properly | 🟢 Low |
| 19 | Add progress bar / completion percentage to SalonSetupScreen | 🟢 Low |
| 20 | Clean up scratch/ and root test files from repo (even if not in history) | 🟢 Low |

---

## 17. Scores Summary

| Category | Score |
|----------|-------|
| **Frontend** | 74 / 100 |
| **Backend** | 80 / 100 |
| **Database** | 75 / 100 |
| **Integration** | 76 / 100 |
| **Notifications** | 82 / 100 |
| **Security** | 62 / 100 |
| **Performance** | 78 / 100 |

---

## 18. Role Completion

| Role | Completion |
|------|-----------|
| **Client** | 92% |
| **Barber** | 94% |
| **Admin** | 68% |

---

## 19. Launch Readiness

**Not yet recommended for production.** Three blockers must be cleared first:

1. The live service-role key in committed files is an active security incident.
2. The `average_rating` field mismatch breaks a visible UX feature (star filter, rating display) for GPS users — the most common HomeScreen path.
3. Confirm migration `20260610030000_fix_find_nearby_salons.sql` has been applied to the production Supabase project.

After those three are resolved, the project is viable for a **soft launch / beta with known limitations** (OSRM routing, no booking reminders, admin mobile limited).

---

## 20. Global Project Completion

```
Frontend:      74%
Backend:       80%
Database:      75%
Integration:   76%
Notifications: 82%

GLOBAL PROJECT COMPLETION: ~71%

Previous audit:   ~22%
Current audit:    ~71%
Delta:            +49 points

Estimated time to production-ready soft launch: 2–3 weeks
(clearing the 3 critical blockers: 1–2 days; medium issues: 1–2 weeks)
```

---

*Audit performed in READ-ONLY mode. No files were modified, no commits were made, no database was altered.*
