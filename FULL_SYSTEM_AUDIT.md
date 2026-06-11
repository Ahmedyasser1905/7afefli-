# 7afefli — FULL SYSTEM AUDIT REPORT
**Date:** 2026-06-10  
**Branch audited:** main (read-only)  
**Auditor:** Ultra Full Audit Pass  
**Mode:** READ ONLY — no code changes, no DB changes, no commits

---

## 1. EXECUTIVE SUMMARY

The 7afefli platform has made substantial progress since the initial "DO NOT LAUNCH" verdict. The core booking loop, authentication, role routing, and payment webhook are all functional. Recent migrations fixed the most critical blockers (double-booking trigger, RLS gaps, admin prefix).

However, this audit reveals a cluster of high-severity issues concentrated in the **notification system** that put production viability at risk:

1. The `notifications` table migration lives **outside** the official `supabase/migrations/` folder — it may not be applied to production.
2. The DB `CHECK` constraint on `notifications.type` **rejects** every type the backend actually sends (`new_booking`, `confirmed`, `cancelled`, `completed`) causing **silent insert failures**.
3. **Zero subscription-expiry, review-reminder, salon-approval, or walk-in-cancelled notifications** exist anywhere in the codebase.
4. The barber role has **no dedicated notifications screen** — it relies on a shared `ClientTabNavigator` `Notifications` modal that may not be reachable from all barber navigation contexts.
5. Realtime is **only active for the barber reservation feed**; client appointments, notifications unread count, and subscription status all poll or require a manual refetch.

---

## 2. SCORES

| Domain | Score | Trend |
|---|---|---|
| **Notifications** | 38 / 100 | ⚠️ |
| **Realtime** | 42 / 100 | ⚠️ |
| **Frontend** | 68 / 100 | ✅ |
| **Backend** | 72 / 100 | ✅ |
| **Database** | 62 / 100 | ⚠️ |
| **Integration** | 65 / 100 | ⚠️ |
| **Performance** | 70 / 100 | ✅ |
| **Security** | 74 / 100 | ✅ |
| **Production Readiness** | 56 / 100 | ⚠️ |

---

## 3. COMPLETION ESTIMATES

| Layer | Completion |
|---|---|
| Frontend | 68% |
| Backend | 72% |
| Database | 62% |
| Realtime | 42% |
| Notifications | 38% |
| Integration | 65% |

**Overall project completion: ~61%**

---

---

# PRIORITY 1 — NOTIFICATION SYSTEM AUDIT

## 3.1 Database Layer

### 🔴 CRITICAL — `create_notifications_table.sql` NOT in `supabase/migrations/`

**File:** `services/api/migrations/create_notifications_table.sql`  
**Status:** This migration is in `services/api/migrations/` — a directory that is **not tracked by the Supabase CLI** and has no automatic application mechanism.  
The official versioned migrations are in `supabase/migrations/`. All 16 files there have timestamps. The `create_notifications_table.sql` has none and is in the wrong folder.

**Consequence:** If this file has not been manually run on production, the `notifications` table does not exist. Every `createNotification()` call silently fails with `error.code === '42P01'` (relation does not exist), which is caught and swallowed in `getMyNotifications()`:
```
if (error && error.code !== '42P01') { this.logger.error(...) }
```
The table's absence would be invisible in logs.

---

### 🔴 CRITICAL — `notifications.type` CHECK constraint rejects all backend-sent types

**File:** `services/api/migrations/create_notifications_table.sql`, line 7  
**The constraint:**
```sql
type TEXT NOT NULL CHECK (type IN (
  'booking_confirmed', 'booking_cancelled',
  'booking_reminder', 'new_review', 'system'
))
```

**What the backend actually sends:**

| Call site | Type sent |
|---|---|
| New booking → salon owner | `'new_booking'` |
| Auto-cancel pending reservations | `'booking_cancelled'` ✅ |
| Status → Confirmed → client | `'confirmed'` (lowercased) |
| Status → Cancelled → client | `'cancelled'` (lowercased) |
| Status → Completed → client | `'completed'` (lowercased) |
| Client cancels → barber | `'booking_cancelled'` ✅ |

**Failing types:** `'new_booking'`, `'confirmed'`, `'cancelled'`, `'completed'`  
4 out of 6 types sent by the backend are **rejected** by the CHECK constraint and would cause PostgreSQL to raise a constraint violation error on every insert.

---

### 🟡 Missing `idx_notifications_user_id` general index

The partial index `idx_notifications_user_unread` (on `user_id, created_at WHERE is_read = FALSE`) is good for the unread badge. However, the `getMyNotifications()` query fetches **all** notifications (read + unread), ordered by `created_at`. This query will not benefit from the partial index and will do a full table scan for active users with many notifications.

---

## 3.2 Backend Layer

### ✅ Notification service infrastructure — FUNCTIONAL
- `NotificationsService` properly handles: write to DB + fire-and-forget push.
- `sendPushToUser()` correctly reads `profiles.push_token`, validates it, handles `DeviceNotRegistered` by clearing the token.
- `savePushToken()`, `removePushToken()`, `getUnreadCount()`, `getMyNotifications()`, `markAsRead()`, `markAllAsRead()` — all implemented.

### ✅ Reservation lifecycle notifications — PARTIALLY IMPLEMENTED

| Event | Recipient | Implemented |
|---|---|---|
| New booking created | Salon owner | ✅ (type `new_booking` — blocked by CHECK) |
| Booking confirmed | Client | ✅ (type `confirmed` — blocked by CHECK) |
| Booking cancelled by barber | Client | ✅ (type `cancelled` — blocked by CHECK) |
| Booking cancelled by client | Barber/owner | ✅ (type `booking_cancelled`) |
| Booking completed | Client | ✅ (type `completed` — blocked by CHECK) |
| Auto-cancel pending on confirm | Client | ✅ (type `booking_cancelled`) |

### 🔴 MISSING — Review submitted → barber notification
`ReviewsService.create()` creates the review but sends **no notification** to the barber/salon owner. There is no `NotificationsService` import in `reviews.service.ts`.

### 🔴 MISSING — Subscription expiry warning notification
`SubscriptionsService.handleDailySubscriptionChecks()` (cron at midnight) downgrades expired trials and paid subscriptions but sends **no notification** to the affected barber/owner. A barber's plan could silently expire.

### 🔴 MISSING — Salon approval/rejection notification
`AdminService.approveSalon()` updates `is_approved` but sends **no notification** to the salon owner. A barber submitting their salon for review never hears back via the app.

### 🔴 MISSING — Payment confirmed notification
`PaymentsController.handleWebhook()` activates the subscription on `checkout.paid` but sends **no notification** to the barber confirming the payment was received and subscription activated.

### 🔴 MISSING — Review reminder for client
No scheduled job or trigger sends a notification to clients after a `Completed` reservation suggesting they leave a review.

---

## 3.3 Frontend Layer

### ✅ `NotificationsScreen` — Functional (CLIENT role)
- Marks all as read on open.
- Individual mark-as-read on tap.
- Navigates to Appointments on `data.reservationId` tap.
- Renders icons and colors by type.

### 🔴 Type mismatch — frontend icons vs backend types
The `getIcon()` switch handles: `reservation_created`, `reservation_confirmed`, `reservation_cancelled`, `loyalty_points`, `system`.  
The backend sends: `new_booking`, `confirmed`, `cancelled`, `completed`, `booking_cancelled`.  
**None of these match.** Every notification will render the default `notifications-outline` icon and default amber color regardless of type.

### 🔴 BARBER has no dedicated Notifications screen
The `BarberTabNavigator` has no `Notifications` tab. The `NotificationBell` in `DashboardScreen` calls `navigation.getParent()?.navigate('Notifications')`. This works only if the barber's root navigator is the `RootStack` (which it is). However:
- Tapping the bell while the barber is deep in a nested sub-navigator may fail because `getParent()` returns the tab navigator, not the root stack.
- There is no visual affordance to access notifications from Calendar, Clients, Mon Salon, or Subscription screens.

### 🔴 `cancelAppointmentReminder()` is NEVER called
`scheduleAppointmentReminder()` is called in `BookingScreen` after a successful booking. But `cancelAppointmentReminder()` is exported from `notifications.ts` and **never imported or called anywhere**. If a client cancels a booking, the local 30-minute reminder will still fire even though the appointment no longer exists.

### 🟡 Unread count refreshes by polling (30s interval), not Realtime
`NotificationBell` uses `refetchInterval: 30000`. This means there is a 0–30 second delay before the badge updates after a new notification arrives. It should use Supabase Realtime on the `notifications` table for instant badge updates.

### 🟡 `NotificationsScreen` staleTime is 60s
Notifications list stays cached for 60 seconds. Combined with the polling gap, a user might see a stale list for up to 90 seconds after opening the screen.

---

## 3.4 Notification Coverage Matrix

### CLIENT ROLE

| Scenario | In-App DB | Push | Local | Status |
|---|---|---|---|---|
| Booking created (pending) | ❌ | ❌ | ❌ | **MISSING** |
| Booking confirmed by barber | ⚠️ DB blocked | ✅ push | ❌ | **PARTIAL** |
| Booking cancelled by barber | ⚠️ DB blocked | ✅ push | ❌ | **PARTIAL** |
| Booking completed | ⚠️ DB blocked | ✅ push | ❌ | **PARTIAL** |
| 30-min reminder | ❌ | ❌ | ✅ local | **LOCAL ONLY** |
| Auto-cancel (other confirmed) | ✅ | ✅ push | ❌ | ✅ |
| Review reminder | ❌ | ❌ | ❌ | **MISSING** |
| Subscription alerts | ❌ | ❌ | ❌ | **MISSING** |

### BARBER ROLE

| Scenario | In-App DB | Push | Local | Status |
|---|---|---|---|---|
| New client reservation | ⚠️ DB blocked | ✅ push | ✅ local | **PARTIAL** |
| Reservation cancelled by client | ✅ | ✅ push | ❌ | ✅ |
| New review received | ❌ | ❌ | ❌ | **MISSING** |
| Subscription expiring | ❌ | ❌ | ❌ | **MISSING** |
| Subscription expired | ❌ | ❌ | ❌ | **MISSING** |
| Payment confirmed | ❌ | ❌ | ❌ | **MISSING** |
| Salon approval / rejection | ❌ | ❌ | ❌ | **MISSING** |
| Reservation modified | ❌ | ❌ | ❌ | **MISSING** |

### ADMIN ROLE

| Scenario | Implemented |
|---|---|
| New salon submitted for approval | ❌ MISSING |
| Salon moderation alerts | ❌ MISSING |
| Subscription monitoring events | ❌ MISSING |
| Reports / analytics alerts | ❌ MISSING |

> **Note:** Admin has no notification system at all — no in-app notifications screen, no push token registration, and no notification bell in `AdminTabNavigator`.

---

---

# PRIORITY 2 — REALTIME AUDIT

## 4.1 What IS Realtime

| Feature | Mechanism | Detail |
|---|---|---|
| Barber calendar — new bookings | Supabase Realtime (`postgres_changes`) | ✅ INSERT on `reservations` where `salon_id = X` |
| Barber calendar — status changes | Supabase Realtime (`postgres_changes`) | ✅ UPDATE on `reservations` where `salon_id = X` |
| Barber local device notification on new booking | `triggerLocalNotification()` | ✅ fired from `useRealtimeBookings` INSERT handler |

## 4.2 What is POLLING (not Realtime)

| Feature | Interval | Concern |
|---|---|---|
| Notification bell unread count | 30 seconds | Badge lags up to 30s |
| Client `MyAppointmentsScreen` | 2 minutes | Status changes invisible for 2min |
| Barber `CalendarScreen` | 2 minutes | Redundant with Realtime, wastes DB calls |
| Slot picker in `BookingScreen` | 30 seconds | Could race with Realtime slot invalidation |

## 4.3 What REQUIRES MANUAL REFRESH

| Feature | Trigger | User Impact |
|---|---|---|
| Client booking status after barber confirms | Manual pull-to-refresh | Client doesn't see confirmation until they refresh |
| Notification list (read state) | Focus event only (60s staleTime) | Stale notifications visible |
| Subscription status after payment | App foreground + focus event | Acceptable for this use case |
| Salon profile changes | Manual tab-switch or focus | Acceptable |
| Admin dashboard stats | Manual refresh or 60s stale | Acceptable for admin |

## 4.4 What is BROKEN / MISSING

| Feature | Issue |
|---|---|
| Client appointment status updates | No Realtime subscription on `reservations` for client |
| Notification badge count | Polls every 30s, should be Realtime on `notifications` table |
| Client walk-in status (barber adds walk-in) | No Realtime channel; client won't see it unless they refresh |

## 4.5 Performance Notes on Realtime

- `useRealtimeBookings` creates a unique channel name per mount (`Math.random()`). When both `DashboardScreen` and `CalendarScreen` mount simultaneously (they share the bottom tab navigator), **two parallel Realtime channels** are open for the same `salon_id`. Both receive every event and both trigger cache invalidations — doubling Supabase Realtime bandwidth for barbers.
- The channel is properly cleaned up on unmount.

---

---

# PRIORITY 3 — SERVER PERFORMANCE AUDIT

## 5.1 Slow Endpoints

### 🟡 `POST /reservations` — 5–7 sequential DB calls before insert
In `ReservationsService.create()`, the initial `Promise.all` is good, but plan enforcement adds 1–2 additional sequential queries (default plan lookup, monthly count). Total: 3 parallel + 2–3 sequential = 5–6 DB round-trips before the advisory-lock RPC fires. On a Vercel cold start this can take 800ms–1.2s.

### 🟡 `GET /salons/nearby` — Double query on RPC failure
`findNearby()` first calls `find_nearby_salons` RPC. On failure, it falls back to a second `FROM salons` query. If PostGIS is misconfigured, every home screen load does 2 queries.

### 🟡 `GET /reservations/salon/:id` (month/all mode) — No pagination
When `viewMode !== 'day'`, the barber calendar fetches **all reservations for the salon** without a date filter, no pagination. For an active salon with 500+ reservations this returns a very large payload.

## 5.2 N+1 Query Analysis

| Location | Status |
|---|---|
| `findNearby()` service enrichment | ✅ Fixed — batch join with `servicesBySalon` map |
| `getSalonClients()` — iterates reservations in JS | ✅ Acceptable — one query, client-side aggregation, limited to 500 rows |
| `getPortfolio()` — `getPublicUrl()` per photo | ✅ No DB call — Supabase SDK returns public URL synchronously |
| `invalidateSlotsCache()` — may loop over all staff | ✅ Parallel with `Promise.all` |

No true N+1 query patterns detected in the current codebase. Previous N+1 issues appear to have been fixed.

## 5.3 Caching

- Slot cache: ✅ Redis, 90s TTL, per `salon:service:date:barber` key.
- Cache invalidation: ✅ Called on every booking, cancellation, block, unblock.
- Rate limiting: ✅ Global 100 req/min (Redis-backed in prod), checkout throttled to 5/min.
- `profiles` role cache: ✅ 5-minute in-memory cache per user to avoid 2 DB hits per request.

## 5.4 Missing Indexes

The `notifications` table (if it exists) only has a partial index on `(user_id, created_at) WHERE is_read = FALSE`. A full index on `(user_id, created_at DESC)` is needed to efficiently serve `getMyNotifications()` (which fetches all notifications, not just unread).

---

---

# PRIORITY 4 — NEW BARBER ACCOUNT AUDIT

## 6.1 Signup Flow

| Step | Screen | Status |
|---|---|---|
| Phone entry | `PhoneInputScreen` | ✅ |
| OTP verification | `VerifyCodeScreen` | ✅ |
| Role selection (Coiffeur) | During signup metadata | ✅ |
| Profile creation (`/auth/verify`) | Auto on login | ✅ |
| Redirect to `BarberTabNavigator` | `AppNavigator` role routing | ✅ |

## 6.2 Salon Setup Flow

| Step | Screen | Status |
|---|---|---|
| No salon → `SalonSetupScreen` shown | `BarberTabNavigator` on 404 | ✅ |
| Basic info form (name, address, wilaya, phone) | `SalonSetupScreen` step 1 | ✅ |
| Map location picker (WebView MapLibre) | `SalonSetupScreen` step 2 | ✅ |
| Hours & working days | `SalonSetupScreen` step 3 | ✅ |
| POST `/salons` on submit | `apiClient.post('/salons')` | ✅ |
| Auto-creates `user_subscriptions` (Trial) | `SalonsService.create()` | ✅ |

### 🔴 MISSING — `working_days` not sent in create payload
In `SalonSetupScreen.handleCreateSalon()`, the POST body for new salon creation includes `working_days: form.working_days`. However, looking at `CreateSalonDto`, let's verify if `working_days` is in the DTO:

```ts
// From SalonSetupScreen
await apiClient.post('/salons', {
  name, description, wilaya, commune, address, phone,
  open_time, close_time, latitude, longitude,
  working_days: form.working_days  // ← is this in the DTO?
});
```

This needs to be verified against `create-salon.dto.ts`. If `working_days` is not in the DTO and `forbidNonWhitelisted: true` is active globally, this will cause a `400 Bad Request`.

### 🟡 No photo upload step during initial setup
`SalonSetupScreen` does not include logo/cover photo upload. The logo is required for the salon to be bookable (`hasLogo` check in `create()` service). The barber must navigate to `MySalonScreen` after setup to upload a photo — this is not communicated in the setup flow.

## 6.3 Post-Setup Flow (MySalonScreen)

| Step | Status |
|---|---|
| Add services (ServiceModal) | ✅ |
| Add staff (AddStaffModal) | ✅ |
| Upload portfolio photos (Supabase Storage) | ✅ |
| Edit salon details (EditSalonModal) | ✅ |
| Edit map location (EditSalonLocationModal) | ✅ |
| View/respond to reviews | ✅ |

## 6.4 Subscription Activation Flow

| Step | Status |
|---|---|
| View plans | ✅ `SubscriptionScreen` fetches from `/subscriptions/plans` |
| Trial period visible | ✅ |
| Tap "Subscribe" → `POST /payments/checkout` | ✅ |
| Chargily redirect URL opened in browser | ✅ |
| Return to app (foreground event triggers refetch) | ✅ `AppState` listener |
| Subscription status updated | ✅ via webhook → `user_subscriptions` |
| **Notification sent to barber on activation** | ❌ MISSING |

## 6.5 Receiving First Bookings

| Step | Status |
|---|---|
| Salon must be complete (all 11 fields) | ✅ enforced in `create()` service |
| Salon must be manually approved by admin | 🟡 `is_approved` check not documented in barber UX |
| Barber sees Realtime notification on new booking | ✅ |
| Local push notification | ✅ |
| Haptic feedback | ✅ |

### 🔴 Salon approval gate is invisible to barber
When a new barber creates their salon, it requires admin approval (`is_approved = false`). The barber gets no in-app notification when their salon is approved or rejected. They have no visibility on whether their salon is awaiting approval. The `DashboardScreen` shows an `isComplete` banner, but does not check or display `is_approved` status.

## 6.6 Onboarding Issue Summary

| # | Issue | Severity |
|---|---|---|
| 1 | No notification when salon is approved/rejected | 🔴 HIGH |
| 2 | `working_days` may cause 400 if not in DTO | 🔴 HIGH |
| 3 | Logo upload not part of setup wizard — required to receive bookings | 🟡 MEDIUM |
| 4 | No onboarding checklist showing completion status | 🟡 MEDIUM |
| 5 | No notification when subscription payment is confirmed | 🔴 HIGH |
| 6 | Admin approval status invisible to barber | 🔴 HIGH |

---

---

# PRIORITY 5 — INTEGRATION AUDIT

## 7.1 Frontend → API Chain

### ✅ `apiClient` correctly prepends `/api/v1`
`apps/mobile/src/lib/apiClient.ts` builds the base URL from `EXPO_PUBLIC_API_URL` and the path. Admin pages use `apiFetch()` with same logic.

### ✅ Auth headers passed on every call
`SupabaseAuthGuard` correctly validates JWT and populates `request.user`.

### 🔴 Type mismatch: `dto.status.toLowerCase()` breaks notification type
In `updateStatus()`:
```ts
this.notificationsService.createNotification(
  reservation.client_id, dto.status.toLowerCase(), ...
)
```
This sends `'confirmed'`, `'cancelled'`, `'completed'` — none of which are in the DB CHECK constraint. The `'confirmed'` type is also not handled in the frontend `getIcon()` switch.

### 🟡 `NotificationsScreen` — deep-link navigation is incomplete
Tapping a notification with `data.reservationId` navigates to `'Appointments'` (client tab). But for barber-role notifications, this would navigate to the wrong tab (or fail entirely since barbers don't have an `'Appointments'` tab).

### 🟡 `useNotificationSetup` deep-link handler uses stale role assumptions
```ts
if (data.type === 'new_reservation' && data.salonId) {
  navigationRef.navigate('BarberApp')
} else if (data.type === 'reservation_confirmed') {
  navigationRef.navigate('ClientApp')
}
```
The type `'new_reservation'` is never sent by the backend (it sends `'new_booking'`). The deep-link handler will never fire for barber push notifications.

## 7.2 Missing API Endpoints

| Missing | Impact |
|---|---|
| No `DELETE /notifications/:id` | Cannot delete individual notifications |
| No `GET /admin/notifications` | Admin has no notification management |
| No `POST /admin/notify-user` | Admin cannot send manual notifications |

## 7.3 Webhook Integration

- ✅ Signature verification (HMAC)
- ✅ Salon existence check before processing
- ✅ Dynamic plan duration from DB
- ✅ `rawBody` correctly preserved for HMAC
- ❌ No notification to barber on successful payment

---

---

# PRIORITY 6 — ROLE AUDIT

## 8.1 CLIENT ROLE

| Screen | Status | Issues |
|---|---|---|
| HomeScreen | ✅ | Wilaya filter, salon list, map working |
| ExploreScreen | ✅ | Search, wilaya filter, sort working |
| SalonDetailScreen | ✅ | Services, staff, reviews visible |
| BookingScreen | ✅ | Slot picker, barber select, confirmation |
| BookingConfirmScreen | ✅ | Animated confirmation, reservation fetch |
| MyAppointmentsScreen | ✅ | Upcoming/Past tabs, cancel, review |
| FavoritesScreen | ✅ | Add/remove favorites via API |
| NotificationsScreen | ✅ (but broken) | Types mismatch; icons always default |
| SettingsScreen | ✅ | Profile edit, logout |

### 🔴 Client cannot see real-time booking status update
After a barber confirms a booking, the client's `MyAppointmentsScreen` polls every 2 minutes. There is no push from Supabase Realtime to the client side for reservation updates.

## 8.2 BARBER ROLE

| Screen | Status | Issues |
|---|---|---|
| DashboardScreen | ✅ | Day/month/all views, walk-in, block time |
| CalendarScreen | ✅ | Timeline view, overlap resolution |
| ClientsScreen | ✅ | App members vs walk-ins, CRM |
| MySalonScreen | ✅ | Services, staff, portfolio, reviews |
| SubscriptionScreen | ✅ | Plans, trial status, Chargily checkout |
| SalonSetupScreen | ✅ | Multi-step form with map |
| Notifications | 🟡 | Bell works, no dedicated tab screen |

### 🔴 Barber Notifications tab missing
The `BarberTabNavigator` has: Dashboard, Calendar, Clients, Mon Salon, Subscription, Settings. No Notifications tab. The bell on Dashboard navigates to the global modal — but there is no way to access notifications from Calendar, Clients, etc.

## 8.3 ADMIN ROLE

| Feature | Status | Issues |
|---|---|---|
| Mobile AdminDashboardScreen | 🟡 | Basic: salons, users, reservations |
| Web admin portal — salon approval | ✅ | apiFetch with /api/v1 prefix fixed |
| Web admin portal — users | ✅ | |
| Web admin portal — subscriptions | ✅ | |
| Web admin portal — reservations | ✅ | |
| Admin notifications | ❌ | Completely missing |
| Analytics/reports | 🟡 | Only basic counts, no charts |
| Moderation (content/review removal) | 🟡 | Delete only, no moderation queue |

---

---

# PRIORITY 7 — MAP AUDIT

## 9.1 Map Implementation
The map uses a **WebView with MapLibre GL** (primary) with a **Leaflet fallback**. This is consistent across Home, Explore, and Salon detail.

## 9.2 Feature Matrix

| Feature | Status | Notes |
|---|---|---|
| Salon markers | ✅ | Custom amber circle markers |
| Marker tap → popup | ✅ | Name, rating, wilaya shown |
| Popup close button | ✅ | Leaflet and MapLibre both handle it |
| Route drawing (OSRM) | ✅ | Free OSRM router via HTTP |
| GPS user location | ✅ | Blue dot, auto-center on first location |
| Zoom in/out controls | ✅ | Injected via `injectJavaScript` |
| Reset to user location | ✅ | Button outside WebView |
| Marker clustering | ❌ | **NOT IMPLEMENTED** |
| Map search (address search) | ❌ | Not in map component |
| Salon list ↔ map sync | ✅ | `selectedSalonId` prop highlights correct marker |

### 🟡 No marker clustering
With many salons in Algiers, markers overlap and are difficult to tap at city-level zoom. Leaflet Markercluster and MapLibre clustering are both available but not implemented.

### 🟡 OSRM free tier reliability
Routes use `router.project-osrm.org` (free, public). This service has rate limits and occasional downtime. A "directions" tap may silently fail if OSRM is down. There is no error feedback to the user.

### 🟡 Map state not preserved on tab switch
`selectedSalonId` resets when navigating away and back. Map re-renders from scratch on every tab focus because `SalonMapView` is inside a component tree that gets unmounted.

---

---

# SECTION A — HIGH PRIORITY ISSUES

| # | Issue | Component | Severity |
|---|---|---|---|
| H1 | `notifications` table migration NOT in `supabase/migrations/` — table may not exist in production | DB | 🔴 CRITICAL |
| H2 | `notifications.type` CHECK constraint rejects 4/6 backend types (`new_booking`, `confirmed`, `cancelled`, `completed`) | DB | 🔴 CRITICAL |
| H3 | `useNotificationSetup` deep-link handler listens for `'new_reservation'` but backend sends `'new_booking'` — barber push-tap never deep-links | Mobile | 🔴 HIGH |
| H4 | `cancelAppointmentReminder()` exported but never called — stale local reminders fire after cancellation | Mobile | 🔴 HIGH |
| H5 | Salon approval/rejection sends no notification to barber — approval state invisible | Backend + Mobile | 🔴 HIGH |
| H6 | New review submitted sends no notification to barber | Backend | 🔴 HIGH |
| H7 | Subscription expiry/downgrade cron sends no notification to barber | Backend | 🔴 HIGH |
| H8 | Payment webhook confirmed sends no notification to barber | Backend | 🔴 HIGH |
| H9 | Barber has no Notifications tab — only accessible from Dashboard bell | Mobile | 🔴 HIGH |
| H10 | Client reservation status (confirmed/cancelled) has no Realtime subscription — 2-min polling only | Mobile | 🟠 HIGH |
| H11 | Notification type/icon switch in `NotificationsScreen` uses wrong type names — all notifications show default icon | Mobile | 🟠 HIGH |
| H12 | `working_days` may trigger 400 Bad Request on salon creation if DTO does not declare it | Backend | 🔴 HIGH |

---

# SECTION B — MEDIUM PRIORITY ISSUES

| # | Issue | Component | Severity |
|---|---|---|---|
| M1 | Two parallel Realtime channels open when Dashboard + Calendar both mounted (duplicate cache invalidations) | Mobile | 🟡 MEDIUM |
| M2 | `notifications` table missing general index on `(user_id, created_at DESC)` for full list queries | DB | 🟡 MEDIUM |
| M3 | OSRM free-tier routing: no error feedback to user when route fetch fails | Mobile/Map | 🟡 MEDIUM |
| M4 | No marker clustering on map — usability issue with many salons in same area | Mobile/Map | 🟡 MEDIUM |
| M5 | Admin has no notification system (no bell, no screen, no push registration) | Mobile/Admin | 🟡 MEDIUM |
| M6 | Barber Dashboard "month/all" mode fetches all reservations without pagination — payload scales with salon age | Mobile | 🟡 MEDIUM |
| M7 | Salon approval status (`is_approved`) not shown to barber on Dashboard — they can't tell if they're awaiting review | Mobile | 🟡 MEDIUM |
| M8 | No onboarding checklist or progress indicator guiding barber through all required steps | Mobile | 🟡 MEDIUM |
| M9 | `NotificationsScreen` `staleTime: 60s` + 30s bell poll = up to 90s notification delay for in-app list | Mobile | 🟡 MEDIUM |
| M10 | `create_notifications_table.sql` in `services/api/migrations/` — organizational: not guaranteed applied via CI | DB | 🟡 MEDIUM |
| M11 | Logo upload not part of `SalonSetupScreen` wizard — required field for bookings but discovered only later | UX | 🟡 MEDIUM |
| M12 | Admin portal (Next.js) has no realtime — admin must manually refresh to see new salon submissions | Admin | 🟡 MEDIUM |

---

# SECTION C — LOW PRIORITY ISSUES

| # | Issue | Component | Severity |
|---|---|---|---|
| L1 | Map state resets on tab switch — map re-renders from scratch | Mobile/Map | 🟢 LOW |
| L2 | `MyAppointmentsScreen` polls every 2 min — redundant if Realtime added | Mobile | 🟢 LOW |
| L3 | `CalendarScreen` polls every 2 min — redundant given `useRealtimeBookings` | Mobile | 🟢 LOW |
| L4 | No `DELETE /notifications/:id` endpoint for individual notification deletion | Backend | 🟢 LOW |
| L5 | Admin mobile screen has only 3 tabs (Dashboard, Settings) — full admin power requires web portal | Mobile | 🟢 LOW |
| L6 | `Swagger` disabled in production — reduces developer API discoverability | Backend | 🟢 LOW |
| L7 | No `GET /admin/notifications` endpoint for admin notification management | Backend | 🟢 LOW |
| L8 | `getRevenue()` loads ALL completed payments into memory for summation — should use SQL `SUM()` | Backend | 🟢 LOW |
| L9 | `@ts-nocheck` on all major screens suppresses TypeScript errors that may hide real bugs | Mobile | 🟢 LOW |

---

---

# SPECIAL SECTION — NEW BARBER ACCOUNT AUDIT (FULL)

## Flow Summary

```
Signup (phone OTP)
  → role = 'Coiffeur' set in metadata
  → Profile created via /auth/verify
  → BarberTabNavigator loads
  → No salon → SalonSetupScreen shown
  → Fill basic info + map location + hours
  → POST /salons → salon created (Trial subscription auto-created)
  → Redirected to DashboardScreen
  → ⚠️ SALON NOT APPROVED — invisible to barber
  → Navigate to MySalonScreen
  → Upload logo photo ← NOT guided, required for bookings
  → Add services ← guided by empty state
  → Add staff ← guided by empty state
  → SubscriptionScreen → choose plan → Chargily → pay
  → Payment webhook activates subscription
  → ⚠️ No notification confirming activation
  → Ready to receive bookings? ← BLOCKED by is_approved
```

## Critical Gaps in New Barber Onboarding

1. **Approval opacity** — Barber has no way to know their salon is waiting for admin approval after creation. The dashboard shows the completeness banner but not approval status. This is a dead-end UX.

2. **Logo upload not in wizard** — The `SalonSetupScreen` doesn't include image upload. The backend `create()` method enforces `hasLogo` before allowing any bookings. Barbers who don't discover `MySalonScreen` → logo upload cannot receive clients.

3. **No payment confirmation push** — After Chargily redirect, the app triggers a refetch on foreground via `AppState`. But a push notification saying "✅ Abonnement Pro activé" would greatly improve perceived reliability.

4. **No approval notification** — When admin approves (or rejects), the barber should receive a push. Currently they must check back manually.

5. **`working_days` DTO gap (needs verification)** — The setup form sends `working_days` in the create payload. If `create-salon.dto.ts` does not declare this field and `forbidNonWhitelisted: true` is active globally, the entire salon creation POST returns `400`.

---

---

# SPECIAL SECTION — NOTIFICATION AUDIT SUMMARY

## Root Cause Chain

```
services/api/migrations/create_notifications_table.sql
  ├─ NOT in supabase/migrations/ → may not be applied → table may not exist
  └─ IF applied, CHECK constraint blocks 4/6 types sent by backend
       ↓
  Every notification insert fails silently (error swallowed by .catch(() => {}))
       ↓
  NotificationsScreen always shows "Aucune notification"
       ↓
  Users think notifications are broken (they are)
```

## Fix Priority Order

1. Move `create_notifications_table.sql` to `supabase/migrations/` with a timestamp prefix.
2. Fix the `CHECK` constraint to match what the backend actually sends:
   ```sql
   CHECK (type IN (
     'new_booking', 'booking_confirmed', 'booking_cancelled',
     'booking_reminder', 'new_review', 'system',
     'confirmed', 'cancelled', 'completed',
     'subscription_expiring', 'subscription_activated',
     'salon_approved', 'salon_rejected'
   ))
   ```
   Or simply remove the CHECK constraint and enforce valid types at the application layer.
3. Fix `dto.status.toLowerCase()` type mapping in `updateStatus()`.
4. Fix `getIcon()` and `getIconColor()` in `NotificationsScreen` to match backend types.
5. Fix `useNotificationSetup` deep-link handler type from `'new_reservation'` → `'new_booking'`.
6. Call `cancelAppointmentReminder()` when a booking is cancelled.
7. Add `NotificationsService` to `ReviewsService`, `SubscriptionsService`, and `AdminService`.
8. Add a Notifications tab to `BarberTabNavigator`.
9. Add Supabase Realtime listener on `notifications` table to replace the 30s polling on the bell.

---

*End of FULL_SYSTEM_AUDIT.md — Audit only. No files were modified.*
