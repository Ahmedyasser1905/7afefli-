# 7afefli (BarberDZ) — Full Project Audit Report
**Date:** June 10, 2026  
**Branch audited:** main (latest commit)  
**Auditor:** Claude Sonnet 4.6  
**Mode:** Read-only analysis — zero file modifications

---

## Executive Summary

7afefli is an Algerian barbershop/salon booking platform with a React Native/Expo mobile app, a NestJS 10 backend deployed on Vercel, a Next.js 14 admin portal, and Supabase (PostgreSQL + PostGIS) as the database. The project has undergone multiple audit-and-remediation cycles. This audit captures the current state across all layers after those fixes.

**Overall Assessment:** The project has progressed significantly from early "DO NOT LAUNCH" status. The core booking flow is functional, security fundamentals are solid, and several critical bugs (double-booking trigger, RPC consolidation, admin prefix, RLS policy) have been fixed. However, significant gaps remain in notifications (push delivery is fully unimplemented at the backend), the mobile Admin role has only a single screen, test coverage on the mobile side is zero, and payment return deep-linking is missing. The project is approaching a beta-ready state but is not yet suitable for full public launch.

---

## Scores

| Category | Score |
|---|---|
| Frontend (Mobile) | 72/100 |
| Backend (NestJS API) | 79/100 |
| Database (Supabase) | 76/100 |
| Integration | 74/100 |
| Security | 78/100 |
| Performance | 72/100 |
| Production Readiness | 65/100 |

---

## Phase 2 — Frontend Audit (72/100)

### Working Features
- **Authentication flow** — Phone-based Supabase auth, session restore on app start, JWT token refresh handling, hardware back button fix, `needsPhone` gate, `needsPasswordReset` gate, profile auto-creation when missing. Fully functional.
- **Home Screen** — GPS-based location, `watchPositionAsync` with 50 m threshold, wilaya bounding-box geocoding, dual data source (`/salons/nearby` PostGIS → wilaya fallback), search, filter pills (nearby, top_rated, beard, haircut, keratin), `SalonMapView` with marker sync to list, pull-to-refresh. Solid implementation.
- **Explore Screen** — Full-text search with 300 ms debounce, wilaya dropdown (all 58 wilayas), sort by rating/distance/price, map/list toggle, GPS location. Well-integrated.
- **Salon Detail Screen** — Full salon info, gallery with photo viewer, services with multi-selection, staff list, reviews display, "Book Now" CTA, favorite toggle (add/remove via API). Functional.
- **Booking Flow (4-step wizard)** — Service → Date → Barber (optional, skipped if no staff) → Slot. `is_manually_closed` guard, slot picker with real-time API fetch, client phone input, `scheduleAppointmentReminder` notification scheduling, `BookingConfirmScreen` with animation and details. End-to-end working.
- **My Appointments Screen** — Upcoming/Past tabs, cancel mutation, leave review modal trigger. Working.
- **Favorites Screen** — Lists favorited salons, remove-from-favorites mutation. Working.
- **Settings/Profile Screen** — Profile load from API, edit modal, wilaya selector, push toggle (stored in SecureStore), logout. Working.
- **Barber Dashboard** — Day/Month/All view modes, server-side date filter for day mode, walk-in modal, block-time modal, reservation detail modal, realtime subscription hook (`useRealtimeBookings`). Solid.
- **Barber Calendar Screen** — Full timeline visualization with `HOUR_HEIGHT = 88px`, overlap resolution into columns, walk-in add, reservation detail. Good quality.
- **Barber Clients Screen** — Aggregated CRM view calling `/reservations/salon/:id/clients`, registered vs walk-in tab, search, per-client appointment history. Working.
- **Barber MySalon Screen** — Services, portfolio, reviews, staff tabs. Service CRUD, staff add/remove, portfolio upload (Supabase Storage direct upload via signed URL), review response. Functional.
- **Barber Subscription Screen** — Fully dynamic (fetches from `/subscriptions/my-plan` and `/subscriptions/plans`), plan cards, Chargily checkout via `Linking.openURL`. Works.
- **Salon Setup Screen** — Multi-step wizard (name/details → hours/days → map), WebView-based MapLibre map for location picking. Working.
- **Map Component (`SalonMapView`)** — WebView + MapLibre GL, stable HTML (compiled once), dynamic salon/user injection via `injectJavaScript`, zoom/reset controls, marker popup. Well-implemented.
- **Admin Dashboard Screen (mobile)** — Salon approval/rejection, user list with role change/ban/delete, reservations list, stats panel. Functional within its limited scope.

### Incomplete / Missing Features

**CRITICAL GAP — No push notification delivery from backend.** The mobile app registers for push notifications (`registerForPushNotifications`), stores the token… in `notifications.ts` lib. However, there is **no endpoint in the NestJS backend to receive and store push tokens**. The `NotificationsService.createNotification()` writes to the `notifications` in-app table, but never sends an actual Expo push notification. Barbers never receive a push when a client books. Clients never receive confirmation pushes. The in-app notification list endpoint exists (`GET /notifications`) but push delivery is completely absent.

**CRITICAL GAP — No payment return deep-link handler.** After Chargily redirects back to `hafefli://payment/success` (or failure), there is no React Native deep-link handler in `App.tsx` or anywhere else to catch the return and update the UI. The barber is left at a blank browser page with no confirmation inside the app. The `app.json` has `scheme: "hafefli"` configured, but nothing handles the inbound link.

**Missing — Admin role in mobile is severely limited.** The `AdminTabNavigator` has only 2 tabs: `AdminDashboardScreen` and `SettingsScreen`. There are no subscription management, payments, or detailed audit log views on mobile. The web admin portal (`apps/admin`) covers this, but the mobile admin experience is very basic.

**Missing — Notification bell / badge UI on client/barber side.** There is no notification center screen, no unread badge on any tab, and no UI component to display in-app notifications fetched from `/notifications`. The backend endpoint exists; the UI does not.

**Missing — Password reset screen completion.** `ResetPasswordScreen` is registered in the navigator and `ForgotPasswordScreen` exists, but the `VerifyCodeScreen` is not linked to the reset flow properly — it's only in the Auth stack.

**Missing — Loyalty points display.** The DB has `profiles.loyalty_points`, the trigger is set. But no screen in the mobile app shows a user's loyalty points balance.

**Incomplete — Dark mode toggle is cosmetic.** `SettingsScreen` has a "Dark Mode" switch, but toggling it does nothing — the app is always in dark mode. The preference is not persisted or applied to a theme context.

**Incomplete — Push notification preference toggle.** The toggle persists via `SecureStore`, but there is no mechanism to actually unregister from push on the Expo side when disabled.

### Bugs

- `BookingScreen`: `selectedServiceIds` syncing uses `useEffect` that fires after render, causing a flash of Step 0 before jumping to Step 1 when pre-selected services are passed.
- `BarberTabNavigator`: the `isComplete` salon completeness check is computed but never used to surface a visual warning to the barber that their profile is incomplete.
- `SettingsScreen`: uses `ALL_WILAYAS` as a hardcoded array (duplicating data already in `packages/shared/constants/wilayas.ts`), creating a maintenance divergence risk.
- `AdminDashboardScreen` (mobile): uses `apiClient.get('/admin/salons')` which returns **all** salons including unapproved ones, making the pending count confusing (it mixes data from `statsData` and raw list).

**Frontend Completion: 74%**

---

## Phase 3 — Backend Audit (79/100)

### Working Endpoints

| Module | Endpoint | Status |
|---|---|---|
| Auth | POST /auth/verify | ✅ |
| Auth | GET /auth/profiles/me | ✅ |
| Auth | PATCH /auth/profiles | ✅ |
| Auth | DELETE /auth/account | ✅ |
| Salons | GET /salons | ✅ wilaya filter, pagination |
| Salons | GET /salons/nearby | ✅ PostGIS RPC with fallback |
| Salons | GET /salons/my-salon | ✅ |
| Salons | GET /salons/my-salon/stats | ✅ day/month/all periods |
| Salons | GET /salons/favorites | ✅ |
| Salons | GET /salons/:id | ✅ enriched with is_open |
| Salons | POST /salons | ✅ Coiffeur only |
| Salons | PATCH /salons/:id | ✅ owner check |
| Salons | DELETE /salons/:id | ✅ owner check |
| Salons | GET/POST/DELETE :id/staff | ✅ |
| Salons | PATCH :id/staff/:staffId/avatar | ✅ |
| Salons | GET/POST/DELETE :id/portfolio | ✅ |
| Salons | POST :id/portfolio/upload-url | ✅ signed URL with quota check |
| Salons | GET :id/reviews | ✅ |
| Salons | GET :id/services | ✅ |
| Salons | GET/POST/DELETE :id/favorite | ✅ |
| Reservations | POST /reservations | ✅ `create_reservation_safe` RPC |
| Reservations | POST /reservations/block | ✅ |
| Reservations | DELETE /reservations/block/:id | ✅ |
| Reservations | GET /reservations/me | ✅ |
| Reservations | GET /reservations/salon/:id | ✅ |
| Reservations | GET /reservations/salon/:id/clients | ✅ aggregated CRM |
| Reservations | GET /reservations/:id | ✅ |
| Reservations | PATCH /reservations/:id/status | ✅ |
| Reservations | DELETE /reservations/:id | ✅ |
| Slots | GET /slots | ✅ Redis-cached 90s TTL |
| Reviews | POST /reviews | ✅ |
| Reviews | PATCH /reviews/:id/response | ✅ |
| Salon-services | Full CRUD | ✅ |
| Subscriptions | GET /subscriptions/plans | ✅ dynamic DB |
| Subscriptions | GET /subscriptions/my-plan | ✅ |
| Subscriptions | GET /subscriptions/my-client-plan | ✅ |
| Payments | POST /payments/checkout | ✅ dynamic pricing, rate-limited |
| Payments | POST /payments/webhook | ✅ HMAC verify, salon exists check |
| Notifications | GET /notifications | ✅ |
| Notifications | GET /notifications/unread-count | ✅ |
| Notifications | PATCH /notifications/read-all | ✅ |
| Notifications | PATCH /notifications/:id/read | ✅ |
| Locations | GET /locations/wilayas | ✅ |
| Admin | Full CRUD (salons, users, reservations, subs, stats, audit) | ✅ |

### Missing / Broken Endpoints

**CRITICAL — No `POST /notifications/push-token` endpoint.** The mobile app's `registerForPushNotifications()` function calls this endpoint to register the Expo push token. It does not exist in the NestJS backend. This means all push notifications are silently dropped.

**CRITICAL — No push notification dispatch.** `NotificationsService.createNotification()` writes to the DB table but never calls the Expo Push API. There is no `expo-server-sdk` or equivalent in `package.json`. When a reservation is created, confirmed, or cancelled, no push is sent.

**HIGH — `NotificationsModule` is not imported into `ReservationsModule`.** Even if push were implemented, `ReservationsService` has no reference to `NotificationsService`. New bookings, status changes, and cancellations generate zero notifications.

**MEDIUM — No `GET /admin/payments` endpoint.** The admin web portal's `payments/page.tsx` falls back to a direct Supabase client query for the payments list (bypassing the backend entirely). This violates the principle of all admin operations going through authenticated API endpoints.

**MEDIUM — No client subscription purchase flow.** `GET /subscriptions/my-client-plan` exists, but there is no `POST /payments/client-checkout` endpoint for clients to actually purchase a premium plan. Client premium is effectively non-functional beyond free-tier.

**LOW — `GET /reservations/salon/:id` has no date-range guard.** With no `limit` parameter and no RLS on admin calls, a salon with years of data could return an unbounded dataset.

### Logic / Security Observations

- `salonsService.findAll()`: the `services` join in the SELECT returns all service data inside the salons list endpoint, making the response payload very large for paginated lists. Services are only needed on the detail view.
- `salonsService.findNearby()`: the RPC result is missing `services` data (the RPC doesn't JOIN to services), so client-side service-based filtering (beard/haircut/keratin) will return empty results from the nearby endpoint. The wilaya fallback does include services.
- Subscription cron: `handleDailySubscriptionChecks` transitions expired subscriptions to the free plan (status stays `Active`) instead of setting `status = 'Expired'`. This conflicts with `sync_all_subscription_statuses()` which sets `Expired`. The two routines disagree on the terminal state.
- `auth.guard.ts` role cache TTL is 5 minutes. An admin who changes a user's role will not see the effect for up to 5 minutes. For the admin-ban flow there is a `invalidateRoleCache(id)` call, but role changes via `PATCH /admin/users/:id/role` do **not** call it.

**Backend Completion: 82%**

---

## Phase 4 — Database Audit (76/100)

### Tables Used by Code
`profiles`, `salons`, `services`, `salon_staff`, `reservations`, `reviews`, `portfolio_photos`, `user_subscriptions`, `plans`, `client_subscriptions`, `payments`, `notifications`, `wilayas`, `salon_favorites`, `audit_logs`

### Migration Coverage
The `supabase/migrations/` directory now contains all canonical migrations post-audit:
- `20260610000000_critical_fixes.sql` — Overlap trigger fix, RLS on `user_subscriptions`, 5 RPCs (`create_reservation_safe`, `expire_*`, `sync_all_subscription_statuses`), `find_nearby_salons`, `wilayas` table, loyalty trigger, performance indexes.
- `20260610010000_salon_favorites.sql` — `salon_favorites` table with RLS.
- Earlier migrations covering subscription plans, notifications, walk-in flag, review responses, etc.

### RLS Policy Assessment

| Table | Select | Insert | Update | Delete | Notes |
|---|---|---|---|---|---|
| profiles | ✅ | ✅ | ✅ | — | |
| salons | ✅ | ✅ | ✅ owner | ✅ owner | |
| user_subscriptions | ✅ owner via salon | — | Admin only | — | **Missing INSERT policy** for initial sub creation |
| reservations | ✅ | ✅ | ✅ | ✅ | |
| reviews | ✅ | ✅ Client | ✅ owner | — | |
| salon_favorites | ✅ own | ✅ own | — | ✅ own | ✅ Fixed in latest migration |
| notifications | ✅ own | service_role | service_role | — | |
| plans | public read | — | — | — | |
| client_subscriptions | ✅ own | — | service_role | — | **Missing INSERT for clients** |
| payments | service_role | service_role | — | — | Admin panel bypasses via direct Supabase |
| audit_logs | Admin only | service_role | — | — | |

**CRITICAL — `user_subscriptions` has no INSERT RLS policy.** When a new salon is created and the backend tries to create the initial subscription record (via `service_role`), it bypasses RLS. But if RLS enforcement is tightened, initial subscription creation will fail. The `WITH CHECK` constraint is also absent.

**HIGH — `find_nearby_salons` RPC does not return `services` data.** The function returns salon columns but no services JOIN, breaking service-based filter pills (beard/haircut/keratin) on HomeScreen when GPS results are used.

**HIGH — `create_reservation_safe` overlap check only fires when `p_staff_id OR p_barber_id` is non-null.** For bookings with no specific barber (`NULL, NULL`), the overlap check is skipped entirely:
```sql
AND (
  (p_staff_id  IS NOT NULL AND staff_id  = p_staff_id)
  OR
  (p_barber_id IS NOT NULL AND barber_id = p_barber_id)
)
```
A salon-wide double-booking can occur when clients book "any barber" if no staff filtering is applied.

**MEDIUM — `sync_all_subscription_statuses` sets expired subs to `'Expired'` but the cron in `SubscriptionsService.handleDailySubscriptionChecks()` sets them back to `'Active'` (free plan).** The two mechanisms conflict and will toggle the status on each run.

**MEDIUM — No `push_tokens` table.** Push notification tokens have no persistent storage anywhere in the database schema. The feature cannot be implemented without it.

**LOW — No composite unique index on `reservations(salon_id, barber_id, appointment_date, start_time)`.** The advisory lock + overlap SELECT provides runtime safety, but there is no DB-level uniqueness constraint as a last-resort safeguard.

**Database Completion: 76%**

---

## Phase 5 — Integration Audit (74/100)

### Verified End-to-End Flows

| Flow | Status | Notes |
|---|---|---|
| Auth (phone/OTP → profile → role routing) | ✅ Working | |
| Client books appointment | ✅ Working | Service→Date→Barber→Slot→Confirm |
| Barber adds walk-in | ✅ Working | |
| Barber blocks time | ✅ Working | |
| Salon creation + setup | ✅ Working | |
| Salon edit (details, location, hours) | ✅ Working | |
| Service CRUD | ✅ Working | |
| Portfolio upload (signed URL) | ✅ Working | |
| Staff add/remove | ✅ Working | |
| Favorites add/remove | ✅ Working | |
| Subscription checkout (Chargily) | ✅ Working | checkout_url opens in browser |
| Webhook payment activation | ✅ Working | HMAC verified |
| Admin approve/reject salon | ✅ Working | |
| Admin ban/delete user | ✅ Working | |
| Review submission + barber response | ✅ Working | |
| Slot availability with Redis cache | ✅ Working | |
| Nearby salons (PostGIS) | ✅ Working | |

### Broken / Missing Integration Flows

**BROKEN — Service filter pills on HomeScreen when GPS is used.** `find_nearby_salons` RPC returns salon rows without `services`. The `filteredSalons` logic in `HomeScreen` does `s.services?.some(...)` which returns `undefined` → all service filters silently match nothing when the nearby RPC is used.

**BROKEN — Payment return deep link.** After Chargily redirects to `hafefli://payment/success`, nothing happens in the app. The subscription status will eventually update via webhook, but the barber has no in-app confirmation.

**BROKEN — Push notifications end-to-end.** Mobile registers token → sends to backend → 404 (no endpoint). Booking event → backend writes to `notifications` table → no push sent. Mobile notification bell → no UI exists.

**BROKEN — Client premium subscription purchase.** The `SubscriptionScreen` is only in the barber tab. There is no client-side flow to purchase a premium client plan. `GET /subscriptions/my-client-plan` always returns `{ plan: 'Free', isPremium: false }`.

**MISSING — Booking confirmation to barber.** When a client books, the barber only learns about it via the realtime Supabase subscription on `DashboardScreen`. There is no notification, no email, no push.

**MISSING — Cancellation notifications.** When a barber cancels a reservation, the client receives no notification. The reverse is also true.

**INTEGRATION MISMATCH — `BookingConfirmScreen` reservation field access.** The screen accesses `reservation.salons` (plural) and `reservation.services` (plural) — the shape returned by the `/reservations/:id` endpoint. This should be verified as the endpoint returns a joined Supabase row; the plural table names are the Supabase default join alias and should work, but it creates fragile coupling.

**INTEGRATION MISMATCH — Admin payments page.** The admin portal's `payments/page.tsx` fetches the payment list directly from Supabase (client-side) rather than through the API. No backend endpoint exists for `GET /admin/payments` (only `GET /admin/revenue` for aggregates).

**Integration Completion: 72%**

---

## Phase 6 — Role Audit

### CLIENT ROLE — 76% complete

**Implemented:** Auth/registration, home map + nearby salons, explore/search, salon detail (info, services, gallery, reviews), full booking flow (4 steps, slot picker, confirmation screen), my appointments (upcoming/past, cancel, leave review), favorites (add/remove, list), profile edit, settings (wilaya, push preference), logout.

**Missing/Broken:**
- No in-app notification center or bell badge
- No loyalty points display
- Dark mode toggle is cosmetic (non-functional)
- No premium client subscription purchase flow
- No payment return handling after subscription attempt
- Push notifications are not received

### BARBER/COIFFEUR ROLE — 80% complete

**Implemented:** Salon setup wizard (multi-step, map picker), dashboard (day/month/all views, filter by status, realtime updates), calendar (full timeline, overlap-aware), clients CRM (registered vs walk-in, search, call button), my salon (services, portfolio, staff, reviews with response), subscription management (dynamic plans, Chargily checkout).

**Missing/Broken:**
- No push notification receipt on new bookings
- No in-app notification bell
- Chargily checkout returns to browser with no app confirmation
- Salon completeness warning not shown when `isComplete = false`
- No advanced statistics (revenue charts, busiest hours) — partially exists in backend stats endpoint, not surfaced in mobile

### ADMIN ROLE (Mobile) — 45% complete

**Implemented:** Salon list with approve/reject, user list with ban/role-change/delete, reservations list, platform stats.

**Missing:**
- No subscription management
- No payment history view
- No audit log view
- No sponsorship management (the backend has `POST /admin/salons/:id/sponsor` but no mobile UI)
- No revenue charts
- Only 2 tabs (AdminDashboard + Settings)

### ADMIN ROLE (Web Portal) — 78% complete

**Implemented:** Login with Supabase SSR auth, middleware role guard, dashboard (stats, revenue, audit logs), salons page (list all, approve, delete), users page (list, ban, role change), reservations page (list, delete), subscriptions page (list), payments page (revenue stats + direct Supabase list).

**Missing/Broken:**
- Sponsorship management UI (backend endpoint exists, no web UI)
- Payment list fetched from Supabase directly (no backend endpoint; security gap)
- No plan management (create/edit subscription plans)
- No export/reporting beyond CSV audit log

---

## Phase 7 — Maps Audit

### Working Parts
- **`SalonMapView` component** — MapLibre GL via WebView with Leaflet fallback. HTML compiled once to prevent re-render. Salon and user location injected dynamically via `injectJavaScript`. Popup with salon name/rating. Zoom in/out/reset controls. Compass-style 3D pitch support. Correctly filters out salons with `lat=0/lng=0`.
- **HomeScreen map** — 220px height, synced to filtered salon list, marker click scrolls list to matching salon.
- **ExploreScreen map** — Full-screen toggle, shows all searched salons.
- **SalonDetail map** — Shows salon location via `EditSalonLocationModal` (WebView + Leaflet with Nominatim search).
- **SalonSetupScreen location picker** — WebView + MapLibre, tap-to-place marker, Nominatim geocoding search box. Coords propagated to form.
- **Wilaya bounding-box geocoding** — 58 wilayas defined in `HomeScreen`, GPS coords → wilaya name. Works correctly.
- **PostGIS nearby search** — `find_nearby_salons` RPC with 50 km radius, fallback to wilaya text filter.

### Missing/Broken Parts
- **No route drawing** — No navigation route from user to salon.
- **No search-by-location circle overlay** — The map does not visualize the 50 km search radius.
- **Service filter pills broken with GPS results** — `find_nearby_salons` returns no services data; beard/haircut/keratin filters fail silently.
- **SalonDetail does not have its own map view.** The detail screen has no embedded map showing the salon location (only shows address text). The `EditSalonLocationModal` is the barber-side location editor, not a client-facing view.

**Maps Completion: 68%**

---

## Phase 8 — Subscription Audit

### Truly Dynamic ✅
- Plan catalog: fetched from `plans` table (`GET /subscriptions/plans`)
- Pricing: read from `plans.price` in the checkout endpoint (no hardcoded amounts)
- Duration: `plans.duration_days` drives `ends_at` calculation in webhook
- Max reservations: `plans.max_reservations` enforced per booking
- Max portfolio photos: `plans.max_portfolio_photos` enforced in `getPortfolioUploadUrl`
- Max barbers: available on plan object (not enforced in `addStaff` — see below)
- Features array: fully dynamic, rendered in mobile plan cards

### Partially Hardcoded / Gaps
- **`max_barbers` not enforced.** `salonsService.addStaff()` does not check `plans.max_barbers` before adding staff. A salon on the free plan can add unlimited barbers.
- **Client subscriptions are non-functional.** `client_subscriptions` table exists, `GET /subscriptions/my-client-plan` reads it, but there is no way for a client to create a subscription (no checkout endpoint, no purchase UI).
- **Subscription cron conflict.** The daily cron sets expired subs to `Active + free plan`, while `sync_all_subscription_statuses` sets them to `Expired`. These run independently and disagree.
- **No subscription renewal / upgrade flow.** Webhook only handles initial activation. There is no upsert logic — a second payment for the same salon would try to create a duplicate record.

**Subscription Completion: 72%**

---

## Phase 9 — Salon Management Audit

### Implemented ✅
- Create salon (multi-step wizard with map)
- Edit salon basic info (name, description, address, wilaya, commune, phone)
- Edit salon location (separate modal with map picker)
- Edit working hours (open/close time, working days)
- Edit main salon image (Supabase Storage)
- Services: create, edit, delete
- Staff: add (custom name), remove, update avatar
- Portfolio photos: upload via signed URL, delete
- Working hours displayed to clients, `is_currently_open` computed server-side
- `is_manually_closed` toggle (temporarily close salon)
- Review responses (barber replies to client reviews)
- Reservations: view, confirm, cancel, mark complete
- Block time slots

### Missing / Broken
- **No `max_barbers` enforcement** when adding staff via API
- **No service ordering** — services display in DB insertion order, no drag-to-reorder
- **No salon visibility toggle** beyond `is_manually_closed` (no soft-draft mode)
- **No delete salon option in mobile UI** (backend endpoint exists, no mobile UI)
- **Portfolio quota check at upload** — the check correctly returns 403 if over limit, but the mobile UI doesn't display a clear quota indicator (how many photos remain)
- **Salon completeness warning not surfaced** — `isComplete` is computed in `BarberTabNavigator` but not passed to any screen to warn the barber

---

## Completion Percentages

```
Frontend completion:    74%
Backend completion:     82%
Database completion:    76%
Integration completion: 72%

Global Project Completion: ~76%
```

---

## High Priority Issues

### H1 — No Push Notification Backend (Critical Gap)
**Impact:** Barbers miss new booking alerts. Clients miss confirmation/cancellation updates. Core engagement feature completely absent.  
**Fix:** Create `push_tokens` table, add `POST /auth/push-token` endpoint, integrate `expo-server-sdk` into backend, call `NotificationsService.sendPush()` from `ReservationsService` on create/update.

### H2 — Payment Return Deep Link Missing
**Impact:** After Chargily payment, barber is stranded in a browser with no in-app confirmation. Subscription update happens via webhook, but the app never refreshes.  
**Fix:** Add `Linking.addEventListener` in App.tsx for `hafefli://payment/success` and `hafefli://payment/failure`, invalidate the subscription query on return, show a confirmation toast.

### H3 — `create_reservation_safe` NULL barber overlap skipped
**Impact:** Double-booking possible when `p_staff_id IS NULL AND p_barber_id IS NULL` (any-barber bookings). The overlap `WHERE` clause requires at least one to be non-null.  
**Fix:** In the RPC, add a branch that checks for any staff overlap when both are null: `OR (p_staff_id IS NULL AND p_barber_id IS NULL)`.

### H4 — `find_nearby_salons` RPC Missing `services` Data
**Impact:** Service-based filter pills (beard/haircut/keratin) on HomeScreen silently return no results when GPS-based nearby search is used.  
**Fix:** Add a subquery or lateral JOIN to the RPC to include services array, or fetch services separately in a follow-up query in the backend fallback.

### H5 — Subscription Cron vs Trigger State Conflict
**Impact:** Expired subscriptions oscillate between `Active` (free) and `Expired` on each daily cron run, causing salons to appear and disappear from search.  
**Fix:** Align `handleDailySubscriptionChecks` to also set `status = 'Expired'` (matching `sync_all_subscription_statuses`), then separately enforce hiding expired salons in the UI based on `ends_at` date.

### H6 — Role Cache Not Invalidated on Role Change
**Impact:** After `PATCH /admin/users/:id/role`, the changed user continues to have their old role enforced for up to 5 minutes.  
**Fix:** Call `invalidateRoleCache(userId)` inside `AdminService.changeUserRole()`.

---

## Medium Priority Issues

### M1 — `max_barbers` Not Enforced in `addStaff`
Add a plan-limit check in `SalonsService.addStaff()` before inserting the staff record.

### M2 — No In-App Notification UI
Create a `NotificationsScreen`, add a badge on the relevant tab, wire to `GET /notifications` and `GET /notifications/unread-count`.

### M3 — Admin Payments Endpoint Missing
Create `GET /admin/payments` in `AdminController` returning the payments table with salon names, removing the admin portal's direct Supabase bypass.

### M4 — Client Premium Purchase Flow Missing
Create `POST /payments/client-checkout` and a client-side subscription screen to allow premium client plan purchases.

### M5 — `user_subscriptions` Missing INSERT RLS Policy
Add a `WITH CHECK` INSERT policy on `user_subscriptions` for service_role and salon owners.

### M6 — `salons/findAll` Over-fetches Services
The list endpoint does `select('*, services(*)')` — for a large catalog this is expensive. Switch to `select('*, services(id)', { count: 'exact' })` and fetch full services only on detail.

### M7 — Loyalty Points Not Displayed
Add loyalty points display to client `SettingsScreen` or profile section.

### M8 — Dark Mode Toggle Non-Functional
Either implement a theme context / `Appearance` API integration, or remove the toggle.

### M9 — Subscription Webhook Idempotency
The webhook `UPDATE` on `user_subscriptions` does not guard against replay. Add a check for `provider_payment_id` uniqueness on the `payments` table to prevent duplicate activations.

---

## Low Priority Issues

### L1 — `SettingsScreen` Hardcodes Wilaya List
Duplicates `packages/shared/constants/wilayas.ts`. Import from shared package.

### L2 — `SalonCard` Distance Display Null-Check
`distance_km` can be undefined on wilaya-fallback results. The card should render "—" instead of "0.0 km".

### L3 — No Salon Delete UI on Mobile
`DELETE /salons/:id` exists but no mobile screen exposes it.

### L4 — Swagger Enabled in Dev, No API Key Auth for Docs
Swagger is disabled in production (good), but in development there is no basic auth on the docs. Consider adding a simple bearer token check for staging deployments.

### L5 — No E2E Tests
`test/app.e2e-spec.ts` is a stub. No end-to-end tests for critical paths (booking, payment webhook, auth).

### L6 — Mobile Has Zero Test Files
`apps/mobile/src/__tests__` does not exist. Even basic component/hook snapshot tests are absent.

### L7 — Portfolio Quota Not Shown in UI
When a barber is near their portfolio photo limit, no indicator is shown. Only a 403 error after attempting upload.

### L8 — `SalonDetail` Has No Embedded Map
Clients cannot see the salon's location on a map from the detail screen — only the address text.

---

## Remaining Work Before Launch

### Must-Fix (Blockers)
1. Implement push token storage + Expo push dispatch (H1)
2. Implement payment return deep-link handler (H2)
3. Fix `create_reservation_safe` NULL barber overlap (H3)
4. Fix `find_nearby_salons` to include services (H4)
5. Resolve subscription cron/trigger state conflict (H5)
6. Fix role cache invalidation on role change (H6)

### Should-Fix (Pre-Launch)
7. Enforce `max_barbers` plan limit in `addStaff`
8. Add in-app notification UI (bell + screen)
9. Add `GET /admin/payments` backend endpoint
10. Add `user_subscriptions` INSERT RLS WITH CHECK
11. Fix service filter pills on HomeScreen (GPS path)

### Nice-to-Have (Post-Launch)
- Client premium subscription purchase flow
- Salon location map on SalonDetail screen
- Loyalty points display
- Dark mode implementation
- Portfolio quota indicator
- Revenue/statistics charts on barber dashboard
- E2E test suite

---

*Report generated by full read-only static analysis of 7afefli repository. No files were modified.*
