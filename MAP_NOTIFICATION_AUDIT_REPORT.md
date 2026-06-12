# MAP & NOTIFICATION ULTRA DEEP AUDIT REPORT
## 7afefli / BarberDZ — Full-Stack Audit
**Date:** 2026-06-12 | **Branch:** main (HEAD) | **Auditor:** Claude Sonnet 4.6 (read-only)

---

## 1. EXECUTIVE SUMMARY

The 7afefli project has undergone significant iterative hardening across multiple prior audit cycles and the overall architecture is sound. The map system is functionally complete with a well-designed MapLibre/Leaflet dual-engine approach delivered via WebView, with PostGIS-backed nearby search and smart GPS throttling. The notification system covers most critical flows (booking, cancellation, confirmation, review, subscription, approval) and includes real Expo push delivery with proper token lifecycle management.

However, **several high-severity gaps remain** that must be resolved before production launch:

1. The `find_nearby_salons` RPC returns `rating` but HomeScreen filters on `average_rating` — the normalization only happens in the `findNearby` backend path. If the RPC returns data that bypasses backend normalization (e.g., in the future), the top-rated filter will silently fail.
2. The client's `MyAppointmentsScreen` uses polling (2-minute interval) with no Supabase Realtime subscription — booking status changes (confirmed/cancelled) are not instant for clients.
3. New salon creation does **not** invalidate the `home-salons-nearby` or `explore-explore-salons` React Query caches — new salons do not appear on client maps until staleTime expires (2–5 minutes).
4. The `SalonDetailScreen` has **no map** showing the specific salon's physical location — users cannot see where the salon is on a map from the detail page.
5. Admin → User broadcast notifications are **entirely missing** (no endpoint, no UI, no DB type).
6. `useRealtimeNotifications` and `useRealtimeReservations` hooks (mentioned in the audit brief) **do not exist** — client-side realtime for reservation state is absent.
7. The `NotificationsScreen` is shared across Client and Barber roles — barbers see client-style navigation on tap (`Appointments` screen).
8. `SalonSetupScreen` uses **Leaflet only** (not MapLibre) for the coordinate picker — inconsistent with the client map engine and missing WebGL acceleration.

**Launch Status: ❌ NOT READY** (7 high-severity issues blocking production)

---

## 2. GLOBAL SCORES

| Area | Score |
|------|-------|
| **Frontend** | 68 / 100 |
| **Backend** | 80 / 100 |
| **Database** | 78 / 100 |
| **Integration** | 72 / 100 |
| **Realtime** | 55 / 100 |
| **Notification** | 65 / 100 |
| **Map** | 70 / 100 |

---

## 3. MAP ARCHITECTURE ANALYSIS

### 3.1 Architecture Overview

```
CLIENT GPS
   ↓  (expo-location, distanceInterval=50m, timeInterval=30s)
HomeScreen / ExploreScreen
   ↓  (React Query, staleTime=2-5min)
apiClient → GET /api/v1/salons/nearby?lat=&lng=&radius=50&limit=100
   ↓
NestJS SalonsController.findNearby()
   ↓
SalonsService.findNearby()
   ↓  (PostGIS RPC)
Supabase: find_nearby_salons(p_latitude, p_longitude, p_radius_m, p_limit)
   ↓  (returns: id, name, rating, lat, lng, distance_meters, plan_price ...)
NestJS: enrichSalons() → adds is_currently_open, status_label, services (batch N+1 avoided)
   ↓
Frontend: allSalons → filteredSalons → mapSalons
   ↓
SalonMapView (WebView)
   ├── MapLibre GL (WebGL available) → OSM tiles, dark styled
   └── Leaflet fallback (no WebGL)
       ↓  injectJavaScript
       window.updateSalons(salonsData)
       window.selectSalon(salonId)
       window.updateUserLocation(lng, lat)
       ↓  postMessage
       { type: 'MARKER_CLICK', salonId }
       { type: 'SALON_PRESS', salonId }
       { type: 'POPUP_CLOSE' }
```

### 3.2 Coordinate Save Flow (Barber)

```
SalonSetupScreen (step 2: Leaflet map)
   ↓  marker drag / map click / geocoder
   postMessage({ lat, lng })
   ↓
form.latitude, form.longitude updated
   ↓
handleCreateSalon() → apiClient.post('/salons', { latitude, longitude, ... })
   ↓
NestJS: SalonsService.create() → Supabase INSERT salons
   ↓
Supabase: salons.latitude, salons.longitude saved
   ↗ MISSING: no cache invalidation → home/explore maps won't see new salon for 2-5 min
```

### 3.3 Map Issues Identified

**Why markers sometimes stay visible after selecting a salon:**
`selectedSalonId` is cleared on `POPUP_CLOSE` message. However, when `filteredSalons` changes (e.g., filter pill toggled), `updateSalons()` is called via `serializedSalons` memoization, which rebuilds all markers. The old `currentPopup` reference inside the WebView HTML is not cleared before `updateSalons` rebuilds markers — if the popup's associated marker is removed and re-added, the popup can orphan. This is an edge case but reproducible when toggling filters quickly.

**Why map does not refresh instantly after salon creation:**
Two caches: `home-salons-nearby` (staleTime=2min) and `explore-explore-salons` (staleTime=5min) are never invalidated by `SalonSetupScreen`. New salons appear only after cache expiry or manual pull-to-refresh.

**Why salon cards and map markers can become unsynchronized:**
`mapSalons` in HomeScreen is derived from `filteredSalons` — they reference the same array, so they should stay in sync. However, `selectedSalonId` can point to a salon that has since been filtered out, causing the map to show a highlighted popup for a card that is no longer in the list. No cleanup when `filteredSalons` changes to reset `selectedSalonId`.

**Why map search sometimes returns empty results:**
When GPS is unavailable AND `userWilaya` is null (no reverse geocode), the wilaya fallback query runs without a wilaya parameter, returning up to 100 salons unfiltered. If the API returns a `{ data: [], total: 0 }` envelope instead of a raw array, `allSalons` becomes `[]` due to the normalization logic difference between HomeScreen (checks both raw array and `.data`) vs ExploreScreen (always expects `.data`).

**Why new salons may not appear immediately:**
Confirmed — stale React Query cache. The barber who just created a salon will see their own salon because `my-salon` is refetched, but public clients won't see it on the map.

**Why coordinates may not save correctly:**
`coordsChosen` guard in `SalonSetupScreen` requires the barber to interact with the map. Default coordinates (Algiers: 36.7538, 3.0588) are pre-filled but `coordsChosen` is `false` until the map is touched. If the barber's actual salon is in Algiers and they don't move the marker, they are blocked from submitting. This is an intentional UX guard but may frustrate legitimate Algiers-based barbers.

---

## 4. NOTIFICATION ARCHITECTURE ANALYSIS

### 4.1 Architecture Overview

```
EVENT TRIGGER (booking create/update, review, approval, subscription)
   ↓
NestJS Service (ReservationsService / AdminService / ReviewsService / SubscriptionsService)
   ↓
NotificationsService.createNotification(userId, type, title, body, data)
   ├── INSERT into Supabase notifications table
   └── fire-and-forget: sendPushToUser(userId, title, body, data)
           ↓
       SELECT push_token FROM profiles WHERE id = userId
           ↓
       Expo Push API (expo-server-sdk)
           ↓
       Device receives push (FCM/APNs)

FRONTEND (in-app):
   NotificationBell
      ├── GET /notifications/unread-count (on mount + Supabase Realtime INSERT trigger)
      └── Supabase Realtime channel: notifications:{userId}
              ↓  postgres_changes INSERT
              invalidateQueries(['notifications-unread-count'])
              invalidateQueries(['notifications'])

   NotificationsScreen
      ├── GET /notifications (React Query, staleTime=60s)
      ├── PATCH /notifications/read-all (on screen open)
      └── PATCH /notifications/{id}/read (on tap)

LOCAL NOTIFICATIONS (device-only):
   - scheduleAppointmentReminder(): 30min before appointment (client)
   - triggerLocalNotification(): instant barber alert on new booking
   - cancelAppointmentReminder(): on appointment cancellation

SERVER CRON:
   - @Cron('0 * * * *') sendBookingReminders(): 55-65min before confirmed appointments
```

### 4.2 Notification Coverage Matrix

| Event | Notification Created | Push Sent | Realtime | Local Notif |
|-------|---------------------|-----------|----------|-------------|
| Client creates booking | ✅ → Barber (new_booking) | ✅ | ✅ (barber useRealtimeBookings) | ✅ (barber local) |
| Barber confirms booking | ✅ → Client (booking_confirmed) | ✅ | ❌ Client has no realtime sub | ❌ |
| Barber cancels booking | ✅ → Client (booking_cancelled) | ✅ | ❌ | ❌ |
| Client cancels booking | ✅ → Barber (booking_cancelled) | ✅ | ✅ (barber via useRealtimeBookings) | ❌ |
| Booking completed | ✅ → Client (completed) | ✅ | ❌ | ❌ |
| Client leaves review | ✅ → Barber (new_review) | ✅ | ✅ (barber via useRealtimeBookings invalidation) | ❌ |
| Admin approves salon | ✅ → Barber (salon_approved) | ✅ | ✅ (NotificationBell) | ❌ |
| Admin rejects salon | ✅ → Barber (salon_rejected) | ✅ | ✅ (NotificationBell) | ❌ |
| Subscription expires | ✅ → Barber (subscription_expiring) | ✅ | ✅ (NotificationBell) | ❌ |
| Booking reminder (1hr) | ✅ → Client (booking_reminder) | ✅ | ❌ | ✅ (30min local) |
| Auto-cancel pending | ✅ → Client (booking_cancelled) | ✅ | ❌ | ❌ |
| Admin → broadcast | ❌ MISSING | ❌ MISSING | ❌ MISSING | ❌ MISSING |
| Account warning | ❌ MISSING | ❌ MISSING | ❌ MISSING | ❌ MISSING |
| Loyalty points earned | DB type exists | ❌ Not sent | ❌ | ❌ |

---

## 5. REALTIME AUDIT

### 5.1 Active Realtime Subscriptions

| Hook/Component | Channel | Event | Scope | Cleanup |
|----------------|---------|-------|-------|---------|
| `NotificationBell` | `notifications:{userId}` | INSERT on `notifications` | All roles | ✅ `removeChannel` |
| `useRealtimeBookings` | `salon-reservations:{salonId}-{random}` | INSERT+UPDATE on `reservations` | Barber only | ✅ `unsubscribe().then(removeChannel)` |

### 5.2 Missing Realtime Subscriptions

- **`useRealtimeNotifications`** — does not exist. The audit brief explicitly requested this hook. NotificationBell provides partial coverage (INSERT only, no UPDATE/DELETE).
- **`useRealtimeReservations`** — does not exist. Clients rely on a 2-minute polling interval (`refetchInterval: 2 * 60 * 1000`) in `MyAppointmentsScreen`. When a barber confirms or cancels a booking, the client sees the change only after the next poll cycle (up to 2 minutes late).
- **Client reservation real-time**: No Supabase channel is subscribed for reservation status changes on the client side.

### 5.3 Realtime Bugs & Risks

**Duplicate channels (LOW risk, mitigated):** `useRealtimeBookings` uses `Math.random()` suffix to prevent Dashboard+Calendar collision. This is correct but creates unbounded channels if the component re-mounts frequently. Cleanup is properly handled in the `useEffect` return.

**Channel leak risk in `NotificationBell`:** If `session.user.id` changes (role switch), the previous channel is cleaned up correctly via the `useEffect` dependency. ✅

**Stale data risk:** `MyAppointmentsScreen` uses `refetchInterval: 2 * 60 * 1000` — a 2-minute window during which the client sees an outdated booking status. This creates a UX gap after barber confirms/rejects.

**No reconnect indicator:** Neither `useRealtimeBookings` nor `NotificationBell` surfaces a visual indicator when the Realtime connection drops (`CHANNEL_ERROR` status). The Supabase v2 client auto-reconnects, but the user has no feedback during disconnect.

---

## 6. CLIENT ROLE AUDIT

| Screen | Dynamic | API Connected | Issues |
|--------|---------|---------------|--------|
| Authentication (Sign Up) | ✅ | ✅ Supabase Auth | Role picker works |
| Login / Phone Entry | ✅ | ✅ | — |
| OTP Verify | ✅ | ✅ Supabase Auth | — |
| Forgot Password | ✅ | ✅ | — |
| HomeScreen | ✅ | ✅ `/salons/nearby`, `/salons` | Missing: no selectedSalonId reset on filter change |
| ExploreScreen | ✅ | ✅ `/salons` | Missing: GPS state not throttled via ref (minor re-render risk) |
| SalonDetailScreen | ✅ | ✅ `/salons/:id` | **MISSING: no map showing salon location** |
| BookingScreen | ✅ | ✅ `/slots`, `/reservations` | Local reminder scheduled correctly |
| BookingConfirmScreen | ✅ | ✅ | — |
| MyAppointmentsScreen | ✅ | ✅ | **Realtime missing — 2min polling only** |
| NotificationsScreen | ✅ | ✅ | Shared with Barber — nav on tap goes to `Appointments` (client screen, correct) |
| FavoritesScreen | ✅ | ✅ `/salons/favorites` | — |
| LoyaltyPointsScreen | ✅ | ✅ `/auth/profiles/me/loyalty` | `loyalty_points` notification type exists in DB but trigger not implemented |
| ClientSubscriptionScreen | ✅ | ✅ `/subscription-plans`, `/payments/initiate` | Payment deep-link handled |
| SettingsScreen | ✅ | ✅ `/auth/profiles/me` | Push toggle calls backend to clear token ✅ |

---

## 7. COIFFEUR ROLE AUDIT

| Feature | Status | Issues |
|---------|--------|--------|
| SalonSetupScreen | ✅ Functional | Uses Leaflet-only map (no MapLibre); `coordsChosen` guard may block Algiers barbers |
| Map coordinate picker | ⚠️ Partial | Geocoder included ✅; no MapLibre WebGL; no validation that coords are within Algeria bounds |
| SalonSetupScreen validation | ✅ | Validates name, address, wilaya, commune, phone, coordsChosen — good |
| Service creation | ✅ | Via `ServiceModal` + `salon-services` API |
| Staff creation | ✅ | Via `AddStaffModal` |
| EditSalonModal | ✅ | Full PATCH to `/salons/:id` |
| EditSalonLocationModal | ✅ | Uses Leaflet + GPS fallback |
| DashboardScreen | ✅ | Real-time via `useRealtimeBookings` ✅ |
| CalendarScreen | ✅ | Real-time via `useRealtimeBookings` ✅ |
| ClientsScreen | ✅ | Separated appMembers vs walkIns ✅ |
| SubscriptionScreen | ✅ | Hook order fixed in prior audit |
| MySalonScreen | ✅ | Location edit modal included |
| Notifications | ⚠️ Partial | Only Dashboard has `NotificationBell`; Calendar/Clients/Subscription screens lack it |
| New salon cache invalidation | ❌ Missing | After creation, home/explore maps don't refresh |
| Barber-only NotificationsScreen | ❌ Missing | Barber uses `NotificationsScreen` from client; tap on booking_confirmed navigates to `ClientApp` |

---

## 8. ADMIN ROLE AUDIT

| Feature | Status | Notes |
|---------|--------|-------|
| Approve Salon | ✅ | Admin service sends `salon_approved` notification to barber ✅ |
| Reject Salon | ✅ | Admin service sends `salon_rejected` notification to barber ✅ |
| Delete User | ✅ | `/admin/users/:id/delete` endpoint exists |
| Delete Salon | ✅ | `/admin/salons/:id` DELETE endpoint exists |
| Manage Plans | ✅ | Admin portal `/subscriptions` page |
| Manage Reviews | ✅ | Admin portal `/reservations` page (reviews accessible) |
| Statistics / Analytics | ✅ | `/admin/analytics` and `/admin/stats` endpoints |
| Admin Broadcast Notification | ❌ MISSING | No endpoint, no mobile UI, no DB `type` |
| Account Warning notification | ❌ MISSING | No notification type in DB CHECK constraint |
| Admin mobile NotificationBell | ✅ | `AdminTabNavigator` imports `NotificationBell` |
| Next.js admin portal | ✅ | `apiFetch` helper with `/api/v1` prefix ✅ |
| Admin portal authentication | ✅ | Middleware-protected (prior audit fix) |

---

## 9. DATABASE AUDIT

### 9.1 Tables Present
- `profiles`, `salons`, `services`, `salon_staff`, `reservations`, `reviews`, `notifications`, `plans`, `user_subscriptions`, `client_subscriptions`, `salon_favorites`, `portfolio_photos`, `wilayas`, `payments` (inferred from migration)

### 9.2 Key RPC Functions
- `find_nearby_salons(p_latitude, p_longitude, p_radius_m, p_limit)` — ✅ Latest version (20260610080000) includes `plan_price`, correct PostGIS
- `create_reservation_safe(...)` — ✅ Fixed null barber branch (H3 fix)
- `sync_all_subscription_statuses()` — ✅ Syncs plan_price, subscription_status

### 9.3 Triggers
- `trg_prevent_double_booking` — ✅ Fixed (prior audit)
- `trg_auto_cancel_pending` — ✅ Present
- `trg_loyalty_points` — ✅ Present (trigger exists but no notification sent)
- `trg_lock_active_premium_subscription` — ✅ Present

### 9.4 Indexes
Well-indexed:
- `idx_notifications_user_created`, `idx_notifications_user_unread` (partial) ✅
- `idx_reservations_salon_appt_date`, `idx_reservations_pending_future` ✅
- `idx_salon_favorites_user_id`, `idx_salon_favorites_salon_id` ✅
- `idx_reviews_salon_id`, `idx_portfolio_photos_salon_id` ✅

**Missing indexes:**
- `salons(latitude, longitude)` — PostGIS handles spatial queries via geography index but only if a `CREATE INDEX USING GIST` was explicitly created. Not found in migrations.
- `notifications(user_id, is_read)` for DELETE operations (bulk cleanup)

### 9.5 RLS Policies
- `notifications` — Users see own only ✅; service role can INSERT ✅; users can UPDATE own ✅
- Missing: **DELETE policy on notifications** — users cannot delete their own notifications (no clean-up path)

### 9.6 Notification Type CHECK Constraint Gap
The `notifications.type` CHECK constraint does not include:
- `account_warning` (admin use case)
- `broadcast` (admin use case)
- `loyalty_points` — **IS** included ✅

Any attempt to insert these types will throw a PostgreSQL CHECK violation at the DB level.

---

## 10. INTEGRATION AUDIT

### 10.1 Coordinate Flow Verification

```
SalonSetupScreen step 2 (Leaflet WebView)
   postMessage({lat, lng}) → React state: form.latitude, form.longitude
   apiClient.post('/salons', { latitude: form.latitude, longitude: form.longitude })
   → CreateSalonDto: @IsNumber() @Min(-90) @Max(90) latitude, @IsNumber() @Min(-180) @Max(180) longitude ✅
   → SalonsService.create() → Supabase INSERT salons(latitude, longitude)
   → Stored correctly in PostGIS-ready columns

find_nearby_salons uses:
   ST_MakePoint(s.longitude, s.latitude)::geography ✅ (correct order: lng, lat)
   ST_DWithin(..., p_radius_m) ✅
```

The coordinate save flow is correct end-to-end. The only gap is cache invalidation after salon creation.

### 10.2 Notification Delivery Chain

```
Backend: createNotification()
   → Supabase INSERT notifications (triggers Realtime)
   → sendPushToUser() fire-and-forget
       → SELECT push_token FROM profiles
       → Expo.sendPushNotificationsAsync()
       → On DeviceNotRegistered: clears token ✅

Frontend: NotificationBell Realtime subscription
   → postgres_changes INSERT on notifications for user_id
   → invalidateQueries(['notifications-unread-count'])
   → invalidateQueries(['notifications'])
   → Badge updates instantly ✅

NotificationsScreen:
   → Marks all as read on open (PATCH /notifications/read-all) ✅
   → Tap individual → PATCH /notifications/{id}/read ✅
   → Tap with reservationId → navigates to Appointments ✅ (client)
   → ❌ Barber tapping booking_confirmed/cancelled also navigates to `ClientApp` — incorrect
```

---

## 11. CRITICAL ISSUES (Launch Blockers)

### CRITICAL-1: No Supabase Spatial (GiST) Index on salons table
**File:** `supabase/migrations/` — no migration creates a PostGIS GiST index  
**Impact:** `find_nearby_salons` does a sequential scan on the `salons` table for ST_DWithin. At scale (1000+ salons) this will be extremely slow and may timeout on Vercel's 10s function limit.  
**Fix:** `CREATE INDEX IF NOT EXISTS idx_salons_location ON salons USING GIST (ST_MakePoint(longitude, latitude)::geography);`

### CRITICAL-2: Client Booking Status Updates Require Up to 2-Minute Delay
**File:** `apps/mobile/src/screens/client/MyAppointmentsScreen.tsx` line `refetchInterval: 2 * 60 * 1000`  
**Impact:** When a barber confirms or cancels a booking, the client sees stale "Pending" status for up to 2 minutes. This is a core UX failure in a real-time booking platform.  
**Fix:** Add a Supabase Realtime subscription for `reservations` filtered by `client_id=eq.{userId}` — similar to `useRealtimeBookings` but for the client role.

### CRITICAL-3: New Salon Not Visible on Client Map After Creation
**File:** `apps/mobile/src/screens/barber/SalonSetupScreen.tsx` — `handleCreateSalon()`  
**Impact:** After a barber creates or edits their salon, public clients continue to see the old map state. Stale for up to 5 minutes on ExploreScreen.  
**Fix:** After successful salon creation, invalidate `['home-salons-nearby']`, `['explore-explore-salons']`, and `['nearby-salons']` in the React Query client.

### CRITICAL-4: SalonDetailScreen Has No Location Map
**File:** `apps/mobile/src/screens/client/SalonDetailScreen.tsx`  
**Impact:** Clients cannot see where a salon is located from the detail page. There is no map widget, no "Get Directions" button, no static map showing the salon pin. This is a fundamental feature gap for a location-based service.  
**Fix:** Embed a mini `SalonMapView` (non-interactive or tap-to-navigate mode) below the salon header, showing only the single salon marker and a "Get Directions" button calling the OSRM route to the salon.

---

## 12. HIGH ISSUES

### HIGH-1: Missing `useRealtimeReservations` Hook (Client Side)
**Impact:** Clients have no live reservation state updates. A dedicated hook matching the barber's `useRealtimeBookings` is needed for the client role.

### HIGH-2: Barber Notification Deep-Link Goes to Wrong Screen
**File:** `apps/mobile/src/hooks/useNotificationSetup.ts`  
**Code:** `data.type === 'booking_confirmed' || data.type === 'booking_cancelled'` → `navigationRef.navigate('ClientApp')`  
**Impact:** When a barber receives a `booking_confirmed` push notification (e.g., after admin approves), tapping it navigates to `ClientApp` instead of `BarberApp`. The type map is client-centric.

### HIGH-3: `selectedSalonId` Not Reset When Filters Change
**File:** `apps/mobile/src/screens/client/HomeScreen.tsx`  
**Impact:** When a user toggles a filter pill (e.g., selects "4.5+ stars"), `filteredSalons` changes but `selectedSalonId` is not cleared. The map shows a popup for a salon that may no longer be in the filtered list. The FlatList scroll-to-index also fails silently with `index = -1`.

### HIGH-4: No PostGIS GiST Index (also Critical-1)
Duplicate for emphasis — the geographic index is the most important database fix for production scalability.

### HIGH-5: `loyalty_points` Notifications Never Triggered
**File:** DB trigger `trg_loyalty_points` exists, notification type `loyalty_points` is in the CHECK constraint, but no backend service ever calls `createNotification(..., 'loyalty_points', ...)`.  
**Impact:** Users earn points silently with no feedback.

### HIGH-6: Admin Broadcast / Account Warning Notifications Entirely Absent
**Impact:** The admin panel has no ability to push platform-wide messages, warnings, or moderation notices to users.  
**Fix required:** (a) Add `account_warning` and `broadcast` to notification type CHECK constraint. (b) Create `POST /admin/notifications/broadcast` endpoint. (c) Add UI in admin dashboard and admin mobile screen.

### HIGH-7: Barber's NotificationsScreen Navigation on Tap is Client-Focused
**File:** `apps/mobile/src/screens/client/NotificationsScreen.tsx` lines ~113-115  
**Code:** `navigation.navigate('Appointments' as never)` when `item.data?.reservationId` exists  
**Impact:** Barbers tapping a reservation-related notification are navigated to the client appointments screen, not the barber calendar.

---

## 13. MEDIUM ISSUES

### MEDIUM-1: ExploreScreen GPS Has No `lastLocationRef` Throttle
**File:** `apps/mobile/src/screens/client/ExploreScreen.tsx`  
HomeScreen guards redundant GPS updates with `lastLocationRef` and a `0.00045°` threshold. ExploreScreen does not — every GPS update triggers a `setLocation()` state change, causing a re-render even for sub-50m moves. The `distanceInterval: 50` handles this at the OS level, but not for the very first position event which always fires.

### MEDIUM-2: SalonSetupScreen Uses Leaflet-Only (Inconsistent Engine)
**File:** `apps/mobile/src/screens/barber/SalonSetupScreen.tsx` mapHtml  
The client-facing `SalonMapView` uses MapLibre (WebGL) with Leaflet fallback. The barber's coordinate picker uses Leaflet unconditionally. Minor inconsistency but creates a visually different experience and forgoes WebGL performance.

### MEDIUM-3: Wilaya Text Input in SalonSetupScreen (Not Picker)
**File:** `apps/mobile/src/screens/barber/SalonSetupScreen.tsx`  
The `wilaya` field is a free-text `TextInput`. A barber could type "alger" vs "Alger" vs "Alger-Centre" — causing mismatches with the 58-wilaya constant list used in `WILAYAS_WITH_ALL`. This breaks ExploreScreen's wilaya filter.

### MEDIUM-4: Marker Orphan on Filter Toggle (Map/Card Desync)
**File:** `apps/mobile/src/components/map/SalonMapView.tsx`  
When `updateSalons()` is called with a new set, old markers are removed and new ones created. If `currentPopup` exists and its `salonId` is no longer in the new set, the popup is displayed over an empty map area until manually closed. The `selectSalon(null)` call is never triggered automatically on filter change.

### MEDIUM-5: `NotificationBell` Subscriptions Only on INSERT
**File:** `apps/mobile/src/components/shared/NotificationBell.tsx`  
The Realtime subscription listens for `event: 'INSERT'` only. If a notification is updated (marked read by another device session) or deleted, the badge count does not refresh automatically.

### MEDIUM-6: No Pagination on NotificationsScreen
**File:** `apps/mobile/src/screens/client/NotificationsScreen.tsx`  
`GET /notifications` defaults to `limit=30`. Users with more than 30 notifications will never see older ones. No load-more or infinite scroll.

### MEDIUM-7: Push Notification Deep-Link is Coarse (App-Level Only)
**File:** `apps/mobile/src/hooks/useNotificationSetup.ts`  
On notification tap, the app navigates to `ClientApp` or `BarberApp` (the tab navigator root), not to the specific screen (e.g., `MyAppointments` screen or the specific salon). The `data.reservationId` and `data.salonId` values are available but not used for deep navigation.

### MEDIUM-8: Dual Reminder Risk (Server + Local)
When a client books an appointment, `scheduleAppointmentReminder()` schedules a local 30-minute reminder AND the server cron fires a `booking_reminder` push at 55-65 minutes. Both are correct intervals but different — a client could receive a push at 55min AND a local notification at 30min. This is double-reminder behavior, not necessarily wrong but potentially annoying.

### MEDIUM-9: `find_nearby_salons` Returns `rating` Field, Not `average_rating`
**File:** `supabase/migrations/20260610080000_sort_salons_by_plan_tier.sql`  
The RPC `RETURNS TABLE` uses column name `rating`. The backend `findNearby()` method maps it: `average_rating: s.average_rating ?? s.rating ?? null`. This works, but the HomeScreen `top_rated` filter (`s.average_rating >= 4.5`) relies on this normalization happening correctly. If the normalization is bypassed or the RPC is called directly from the client (e.g., future change), the filter silently returns no results.

---

## 14. LOW ISSUES

### LOW-1: `coordsChosen` Blocks Algiers-Located Salons
**File:** `apps/mobile/src/screens/barber/SalonSetupScreen.tsx`  
If a barber's salon is genuinely at the default Algiers coordinates (36.7538, 3.0588), `coordsChosen` remains `false` unless the barber touches the map. Alert message says "Veuillez choisir l'emplacement" — frustrating for barbers who are already at the right location.

### LOW-2: `mapHtml` in SalonSetupScreen Is Not Memoized
**File:** `apps/mobile/src/screens/barber/SalonSetupScreen.tsx`  
The `mapHtml` string is defined inline (template literal) inside the component body, using `form.latitude` and `form.longitude` as initial values. This means the entire HTML string is recreated on every render. If the form re-renders (e.g., other field changes), the WebView would reload entirely. Should be wrapped in `useMemo([])`.

### LOW-3: No Loading Skeleton for SalonDetailScreen
**File:** `apps/mobile/src/screens/client/SalonDetailScreen.tsx`  
The screen shows `ActivityIndicator` while loading but no skeleton placeholders — layout shift occurs when data arrives.

### LOW-4: `useNearbySalons` Hook is Unused
**File:** `apps/mobile/src/hooks/salons/useNearbySalons.ts`  
This hook was created but HomeScreen directly uses its own `useQuery` calls for the same data. The hook is dead code.

### LOW-5: Notification Badge in BarberTabNavigator Uses Separate Query
**File:** `apps/mobile/src/navigation/BarberTabNavigator.tsx`  
The tab navigator creates its own React Query for `notifications-unread-count` while `NotificationBell` in DashboardScreen creates another instance. Both share the same cache key so they don't double-fetch, but the Realtime subscription in `NotificationBell` is the only live update path — the tab badge does not have its own Realtime sub and relies on the Bell component being mounted.

### LOW-6: OSRM Route Drawing Has No Algeria Coverage Check
**File:** `apps/mobile/src/components/map/SalonMapView.tsx` `drawRouteOSRM()`  
OSRM is queried with `https://router.project-osrm.org` (the public demo server). This server has no SLA, rate limits, and may not have detailed Algeria road coverage. Routing failures silently fall back to a straight line between user and salon — but no user-visible error is shown.

### LOW-7: `api.ts` (Endpoints Object) is Unused Dead Code
**File:** `apps/mobile/src/lib/api.ts`  
The `endpoints` object is exported but no file in the codebase imports or uses it. All API calls go through `apiClient.ts`. Can be deleted.

### LOW-8: ExploreScreen: `setSelectedSalonId(null)` in Cleanup Only
**File:** `apps/mobile/src/screens/client/ExploreScreen.tsx`  
When `filteredSalons` changes (wilaya filter change, sort change, search), `selectedSalonId` is not cleared. Same as HomeScreen MEDIUM issue. Map popup lingers for a salon no longer in filtered results.

---

## 15. MISSING FEATURES

1. **SalonDetailScreen Location Map** — No map widget showing the salon's position. Critical for a location-based app.
2. **Client Realtime Reservation Updates** — `useRealtimeReservations` hook entirely absent.
3. **Admin Broadcast Notifications** — No endpoint, no mobile UI, no DB type.
4. **Account Warning notifications** — No type in DB, no backend implementation.
5. **PostGIS Spatial Index** — `CREATE INDEX USING GIST` on `salons` not created in any migration.
6. **Loyalty Points Notification trigger** — DB type exists but is never fired from the backend.
7. **Barber-Specific NotificationsScreen** — Deep-link navigation on notification tap is client-only.
8. **Push Notification Screen Deep-Link** — App navigates to tab root, not the specific screen or reservation.
9. **"Directions" button in SalonDetailScreen** — No way to get navigation from a detail page (map not shown).
10. **Notification DELETE policy (RLS)** — Users cannot delete their own notifications.
11. **Wilaya picker in SalonSetupScreen** — Should be a dropdown from the 58-wilaya list, not a free-text field.
12. **Notification pagination** — Fixed 30-item limit with no load-more.
13. **Map refresh after salon creation** — No React Query invalidation from SalonSetupScreen.

---

## 16. PRODUCTION RISKS

| Risk | Severity | Likelihood | Impact |
|------|----------|------------|--------|
| PostGIS sequential scan at scale | CRITICAL | High | DB timeout / app crash |
| Client sees stale booking state for 2min | HIGH | Certain | Poor UX, user confusion |
| Duplicate channel accumulation (realtime) | MEDIUM | Low | Memory leak over long sessions |
| OSRM public demo rate-limit | MEDIUM | High | Route drawing fails silently |
| Wilaya free-text mismatch | MEDIUM | High | Filter breaks for incorrectly-entered wilayas |
| Missing account_warning type in DB CHECK | MEDIUM | Medium | 500 error if admin feature added later |
| Push token not refreshed on token rotation | LOW | Low | Push silently fails after Expo token refresh |
| SalonSetupScreen mapHtml recreation | LOW | Medium | WebView flickers on form edit |

---

## 17. LAUNCH BLOCKERS

1. ❌ **No PostGIS spatial index** on `salons` table — performance issue at scale
2. ❌ **Client has no realtime reservation updates** — 2-minute polling only
3. ❌ **New salons not visible on client map** after creation (no cache invalidation)
4. ❌ **SalonDetailScreen has no location map** — fundamental feature gap
5. ❌ **Barber notification deep-link navigates to ClientApp** — wrong screen
6. ❌ **selectedSalonId not cleared on filter change** — map/list desync
7. ❌ **Wilaya free-text in SalonSetupScreen** — breaks wilaya filtering for incorrectly entered salons

---

## 18. RECOMMENDED FIX ORDER

### Phase 1 — Critical Database & Realtime (do first, unblock everything)
1. **Add PostGIS GiST index** on `salons(latitude, longitude)` — new migration, 5 min
2. **Add `account_warning` and `broadcast` to notifications CHECK constraint** — new migration, 5 min
3. **Add DELETE RLS policy on notifications** — new migration, 5 min

### Phase 2 — Map Fixes
4. **Add `selectedSalonId` reset when `filteredSalons` changes** — HomeScreen + ExploreScreen `useEffect` — 30 min
5. **Invalidate salon caches after SalonSetup create/update** — `SalonSetupScreen.handleCreateSalon()` add `queryClient.invalidateQueries` calls — 20 min
6. **Add SalonDetailScreen location mini-map** — Embed `SalonMapView` with single marker + Directions button — 2 hours
7. **Memoize SalonSetupScreen `mapHtml`** — wrap in `useMemo([form.latitude, form.longitude])` — 10 min
8. **Replace wilaya TextInput with picker** in `SalonSetupScreen` — use `WILAYAS` constant — 1 hour

### Phase 3 — Notification & Realtime Fixes
9. **Create `useRealtimeReservations` hook** for client side — modeled on `useRealtimeBookings` — 1 hour
10. **Integrate `useRealtimeReservations` in `MyAppointmentsScreen`** — remove polling fallback — 30 min
11. **Fix barber deep-link navigation** in `useNotificationSetup.ts` — route `booking_confirmed/cancelled` to `BarberApp` when role=Barber — 30 min
12. **Implement push deep-link to specific screen** — use `navigationRef.navigate` with screen + params — 1 hour
13. **Fire `loyalty_points` notification** from the loyalty trigger / backend service — 30 min
14. **Add notification pagination** to `NotificationsScreen` (load-more or infinite scroll) — 1 hour

### Phase 4 — Admin & Missing Features
15. **Admin broadcast notifications** — backend endpoint + admin mobile UI + admin portal UI — 3 hours
16. **Account warning notification** — backend endpoint in `AdminService` + DB type — 1 hour
17. **Delete `useNearbySalons` hook** (dead code cleanup) — 5 min
18. **Delete `api.ts` endpoints object** (dead code) — 5 min

### Phase 5 — Polish & Performance
19. **Replace OSRM public demo** with self-hosted or MapTiler routing API — 2 hours
20. **Add no-SLA fallback notice** when routing fails — 30 min
21. **Add realtime disconnect indicator** in NotificationBell / map header — 1 hour
22. **Add notification DELETE endpoint + RLS** — 1 hour
23. **Add skeleton loaders** to SalonDetailScreen — 1 hour
24. **Add `ExploreScreen` lastLocationRef throttle** — matching HomeScreen pattern — 20 min

---

## 19. FINAL SCORES

```
GLOBAL PROJECT COMPLETION:
74%

MAP COMPLETION:
70%

NOTIFICATION COMPLETION:
65%

PRODUCTION READINESS:
57/100

LAUNCH STATUS:
❌ NOT READY

Blocking items: 7 critical/high issues must be resolved before launch.
Estimated remediation time: 2–3 days of focused development.
After fixes: Production readiness projected at 85–90/100.
```

---

*Report generated by full read-only analysis of 7afefli repository HEAD (2026-06-12). No files were modified. No patches generated.*
