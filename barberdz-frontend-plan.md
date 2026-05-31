# 💈 BarberDZ — Frontend Execution Plan (A-to-Z)

> **Role:** Senior Frontend Architect & React Native Expert
> **Scope:** Client App · Barber App · Super Admin Portal
> **Backend Status:** ✅ Fully built (Supabase PostgreSQL + RLS + Realtime + Storage)
> **Frontend Stack:** React Native + Expo · Next.js (Admin) · React Query · Zustand

---

## Table of Contents

1. [Design System & Visual Language](#1-design-system--visual-language)
2. [Frontend Folder Structure](#2-frontend-folder-structure)
3. [State Management & Data Fetching Strategy](#3-state-management--data-fetching-strategy)
4. [Navigation Architecture](#4-navigation-architecture)
5. [Custom Hooks — Deep Breakdown](#5-custom-hooks--deep-breakdown)
6. [Client App — Screen-by-Screen Plan](#6-client-app--screen-by-screen-plan)
7. [Barber App — Screen-by-Screen Plan](#7-barber-app--screen-by-screen-plan)
8. [Super Admin Portal — Page-by-Page Plan](#8-super-admin-portal--page-by-page-plan)
9. [Push Notification Architecture](#9-push-notification-architecture)
10. [Implementation Roadmap](#10-implementation-roadmap)
11. [Performance & Quality Checklist](#11-performance--quality-checklist)

---

## 1. Design System & Visual Language

### Brand Identity

BarberDZ targets Algerian men aged 18–45. The visual direction is **dark, confident, and precision-crafted** — inspired by the atmosphere of a premium barbershop: leather, steel, warm amber light. This is **refined industrial**.

### Color Palette

```typescript
// apps/mobile/src/theme/colors.ts

export const colors = {
  // Core brand
  ink:       '#0F0F0F',      // Near-black. Primary background.
  carbon:    '#1A1A1A',      // Card backgrounds, surfaces.
  graphite:  '#2C2C2C',      // Input fields, elevated cards.
  steel:     '#3E3E3E',      // Dividers, inactive icons.

  // Accent — warm amber (barbershop light)
  amber:     '#E8A020',      // Primary CTA, stars, highlights.
  amberSoft: '#F5C86A',      // Hover/pressed states.
  amberDim:  '#7A5010',      // Subtle amber tints, badges.

  // Semantic
  success:   '#2ECC71',      // Confirmed bookings, available slots.
  warning:   '#F1C40F',      // Locked slots (5-min UX lock), trial badge.
  error:     '#E74C3C',      // Cancelled, rejected, errors.
  pending:   '#3498DB',      // Pending reservation badge.

  // Text
  textPrimary:   '#F5F5F5',  // Headlines, main body.
  textSecondary: '#9A9A9A',  // Subtitles, placeholders.
  textMuted:     '#5A5A5A',  // Disabled, metadata.

  // Slot states (SlotPicker)
  slotAvailable: '#1E3A2A',  // Dark green tint.
  slotBooked:    '#242424',  // Greyed out, no interaction.
  slotSelected:  '#E8A020',  // Amber = selected by current user.
  slotLocked:    '#3A2F00',  // Dark amber = locked by 5-min UX lock.
  slotLockedBorder: '#F1C40F',
} as const;
```

### Typography

```typescript
// apps/mobile/src/theme/typography.ts
// Fonts: "Syne" (display/headings) + "DM Sans" (body) — loaded via expo-google-fonts

export const typography = {
  // Display — Syne Bold
  h1: { fontFamily: 'Syne_700Bold',    fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  h2: { fontFamily: 'Syne_700Bold',    fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  h3: { fontFamily: 'Syne_600SemiBold',fontSize: 18, lineHeight: 24 },

  // Body — DM Sans
  bodyLg: { fontFamily: 'DMSans_400Regular', fontSize: 16, lineHeight: 24 },
  bodyMd: { fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20 },
  bodySm: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 16 },
  label:  { fontFamily: 'DMSans_500Medium',  fontSize: 13, lineHeight: 18, letterSpacing: 0.4 },
  caption:{ fontFamily: 'DMSans_400Regular', fontSize: 11, lineHeight: 14, letterSpacing: 0.3 },
} as const;
```

### Spacing & Border Radius

```typescript
// apps/mobile/src/theme/spacing.ts

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48,
} as const;

export const radius = {
  sm: 6, md: 10, lg: 16, xl: 24, full: 9999,
} as const;
```

### Reusable Base Components

Every UI element is built from these atoms:

```
components/ui/
  Button.tsx        → Primary (amber fill), Secondary (border), Ghost, Destructive
  Card.tsx          → carbon background, subtle shadow, radius.lg
  Badge.tsx         → Pending/Confirmed/Cancelled/Trial/Active/Expired
  Avatar.tsx        → Circular image, fallback initials, online indicator dot
  Input.tsx         → Dark graphite bg, amber focus ring, icon prefix/suffix
  Skeleton.tsx      → Shimmer loading placeholder (Moti animation)
  BottomSheet.tsx   → Gorhom Bottom Sheet, dark bg, drag handle
  Rating.tsx        → Amber star row, numeric display
  ProgressBar.tsx   → Animated loyalty progress bar
  EmptyState.tsx    → Illustration + message + CTA button
  Toast.tsx         → Top-slide notification overlay
```

---

## 2. Frontend Folder Structure

```
barberdz/
├── apps/
│   │
│   ├── mobile/                              ← React Native (Expo)
│   │   ├── app.json
│   │   ├── babel.config.js
│   │   ├── tsconfig.json
│   │   ├── .env                             ← EXPO_PUBLIC_* vars
│   │   └── src/
│   │       │
│   │       ├── theme/                       ← Design tokens
│   │       │   ├── colors.ts
│   │       │   ├── typography.ts
│   │       │   ├── spacing.ts
│   │       │   └── index.ts
│   │       │
│   │       ├── lib/                         ← External service clients
│   │       │   ├── supabase.ts              ← Supabase client (SecureStore adapter)
│   │       │   ├── queryClient.ts           ← React Query client config
│   │       │   ├── mapbox.ts                ← Mapbox config & helpers
│   │       │   └── notifications.ts         ← Expo push notification setup
│   │       │
│   │       ├── store/                       ← Zustand global stores
│   │       │   ├── authStore.ts             ← session, user, role
│   │       │   ├── bookingStore.ts          ← in-progress booking state
│   │       │   └── notificationStore.ts     ← push token, local notif queue
│   │       │
│   │       ├── hooks/                       ← Custom React hooks
│   │       │   ├── auth/
│   │       │   │   ├── useSession.ts
│   │       │   │   └── useProfile.ts
│   │       │   ├── salons/
│   │       │   │   ├── useNearbySalons.ts
│   │       │   │   ├── useSalonDetail.ts
│   │       │   │   └── useSalonServices.ts
│   │       │   ├── booking/
│   │       │   │   ├── useAvailableSlots.ts  ← COMPLEX: slot generation + booked overlay
│   │       │   │   ├── useSlotLock.ts        ← COMPLEX: 5-min UX lock
│   │       │   │   └── useCreateReservation.ts
│   │       │   ├── barber/
│   │       │   │   ├── useRealtimeBookings.ts ← COMPLEX: Supabase Realtime
│   │       │   │   ├── useBarberCalendar.ts
│   │       │   │   └── useClientCRM.ts
│   │       │   └── shared/
│   │       │       ├── useDebounce.ts
│   │       │       └── useImagePicker.ts
│   │       │
│   │       ├── navigation/                   ← React Navigation setup
│   │       │   ├── AppNavigator.tsx          ← Root: auth gate
│   │       │   ├── ClientTabNavigator.tsx    ← Bottom tabs for clients
│   │       │   ├── BarberTabNavigator.tsx    ← Bottom tabs for barbers
│   │       │   └── types.ts                 ← Typed route params
│   │       │
│   │       ├── screens/
│   │       │   ├── auth/
│   │       │   │   ├── PhoneInputScreen.tsx
│   │       │   │   ├── OTPVerifyScreen.tsx
│   │       │   │   └── RoleSelectScreen.tsx
│   │       │   │
│   │       │   ├── client/
│   │       │   │   ├── HomeScreen.tsx        ← Map + nearby salons
│   │       │   │   ├── SearchScreen.tsx      ← Filter drawer, results list
│   │       │   │   ├── SalonDetailScreen.tsx ← Info, gallery, reviews
│   │       │   │   ├── BookingScreen.tsx     ← Service + date + slot picker
│   │       │   │   ├── BookingConfirmScreen.tsx
│   │       │   │   ├── MyAppointmentsScreen.tsx
│   │       │   │   ├── LoyaltyScreen.tsx
│   │       │   │   └── ProfileScreen.tsx
│   │       │   │
│   │       │   └── barber/
│   │       │       ├── DashboardScreen.tsx   ← Today's bookings + live feed
│   │       │       ├── CalendarScreen.tsx    ← Full calendar, realtime
│   │       │       ├── ClientCRMScreen.tsx
│   │       │       ├── ClientDetailScreen.tsx
│   │       │       ├── RevenueScreen.tsx     ← Charts & analytics
│   │       │       ├── ShopSettingsScreen.tsx
│   │       │       ├── PortfolioScreen.tsx
│   │       │       └── StaffManageScreen.tsx
│   │       │
│   │       └── components/
│   │           ├── ui/                       ← Base atoms (Button, Card, etc.)
│   │           ├── map/
│   │           │   ├── SalonMapView.tsx
│   │           │   ├── SalonMarker.tsx
│   │           │   └── NearbyCarousel.tsx
│   │           ├── booking/
│   │           │   ├── SlotPicker.tsx         ← Core booking component
│   │           │   ├── SlotCell.tsx
│   │           │   ├── ServiceCard.tsx
│   │           │   └── DateStrip.tsx
│   │           ├── salon/
│   │           │   ├── SalonCard.tsx
│   │           │   ├── GalleryGrid.tsx
│   │           │   ├── ReviewCard.tsx
│   │           │   └── StaffAvatarRow.tsx
│   │           ├── barber/
│   │           │   ├── CalendarDayColumn.tsx
│   │           │   ├── ReservationBlock.tsx
│   │           │   ├── LiveFeedItem.tsx
│   │           │   └── RevenueChart.tsx
│   │           └── shared/
│   │               ├── FilterDrawer.tsx
│   │               ├── SearchBar.tsx
│   │               └── ScreenHeader.tsx
│   │
│   └── admin/                               ← Next.js 14 (App Router) Web Portal
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx                     ← Dashboard overview
│       │   ├── salons/
│       │   │   ├── page.tsx                 ← Salon approvals table
│       │   │   └── [id]/page.tsx            ← Salon detail review
│       │   ├── subscriptions/
│       │   │   └── page.tsx
│       │   └── sponsored/
│       │       └── page.tsx
│       ├── components/
│       │   ├── SalonApprovalTable.tsx
│       │   ├── SubscriptionBadge.tsx
│       │   └── StatCard.tsx
│       └── lib/
│           └── supabase.ts
│
└── packages/
    └── shared/                              ← Shared TypeScript types
        ├── types/
        │   ├── salon.ts
        │   ├── reservation.ts
        │   ├── profile.ts
        │   └── index.ts
        └── utils/
            ├── timeSlots.ts                 ← Shared slot generation pure function
            └── formatters.ts               ← DZD price, date, duration formatting
```

---

## 3. State Management & Data Fetching Strategy

### Architecture Decision: React Query + Zustand + Supabase Realtime

```
┌────────────────────────────────────────────────────────────────┐
│                     State Architecture                         │
│                                                                │
│  ┌──────────────────────┐   ┌──────────────────────────────┐  │
│  │    React Query        │   │         Zustand               │  │
│  │  (Server state)       │   │   (Client/UI global state)    │  │
│  │                       │   │                               │  │
│  │  • Salon lists        │   │  • Auth session + JWT         │  │
│  │  • Services           │   │  • Active booking wizard      │  │
│  │  • Reservations       │   │    (salonId, serviceId,       │  │
│  │  • Reviews            │   │     selectedDate, slot)       │  │
│  │  • User profile       │   │  • Expo push token            │  │
│  │                       │   │  • Slot locks Map<time, Date> │  │
│  │  Auto: caching,       │   │                               │  │
│  │  background refetch,  │   │  Persisted to SecureStore:    │  │
│  │  optimistic updates,  │   │  • session only               │  │
│  │  pagination           │   │                               │  │
│  └──────────────────────┘   └──────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Supabase Realtime                         │  │
│  │  (Live subscription — NOT managed by React Query)        │  │
│  │                                                           │  │
│  │  • Barber calendar: postgres_changes on reservations     │  │
│  │  • On INSERT → optimistic prepend to local list          │  │
│  │  • On UPDATE → patch in place (status change)            │  │
│  │  • Triggers React Query invalidation after sync          │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### React Query Client Configuration

```typescript
// apps/mobile/src/lib/queryClient.ts

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Treat data as fresh for 2 minutes — avoids unnecessary refetches
      staleTime:      2 * 60 * 1000,
      // Keep unused cached data for 10 minutes
      gcTime:         10 * 60 * 1000,
      // Retry failed queries twice with exponential backoff
      retry:          2,
      retryDelay:     (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      // Don't refetch on window focus in mobile (irrelevant)
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});
```

### Zustand Auth Store

```typescript
// apps/mobile/src/store/authStore.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import type { Session, User } from '@supabase/supabase-js';
import type { UserRole } from '@barberdz/shared/types';

interface AuthState {
  session:    Session | null;
  user:       User   | null;
  role:       UserRole | null;
  isLoading:  boolean;

  setSession: (session: Session | null) => void;
  setRole:    (role: UserRole) => void;
  clearAuth:  () => void;
}

// SecureStore adapter for zustand/persist
const secureStorage = {
  getItem: async (name: string) => await SecureStore.getItemAsync(name),
  setItem: async (name: string, value: string) =>
    await SecureStore.setItemAsync(name, value),
  removeItem: async (name: string) => await SecureStore.deleteItemAsync(name),
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session:   null,
      user:      null,
      role:      null,
      isLoading: true,

      setSession: (session) =>
        set({ session, user: session?.user ?? null }),

      setRole: (role) => set({ role }),

      clearAuth: () =>
        set({ session: null, user: null, role: null }),
    }),
    {
      name:    'barberdz-auth',
      storage: createJSONStorage(() => secureStorage),
      // Only persist what's needed — don't persist isLoading
      partialize: (state) => ({
        session: state.session,
        role:    state.role,
      }),
    }
  )
);
```

### Zustand Booking Wizard Store

```typescript
// apps/mobile/src/store/bookingStore.ts

import { create } from 'zustand';
import type { Salon, Service, TimeSlot } from '@barberdz/shared/types';

interface BookingState {
  // Step 1: Salon
  selectedSalon:   Salon   | null;
  // Step 2: Service
  selectedService: Service | null;
  // Step 3: Date
  selectedDate:    string  | null;  // ISO: "2025-07-15"
  // Step 4: Barber (optional)
  selectedBarberId: string | null;
  // Step 5: Slot
  selectedSlot:    TimeSlot | null;

  setSalon:    (salon: Salon)     => void;
  setService:  (service: Service) => void;
  setDate:     (date: string)     => void;
  setBarber:   (id: string | null)=> void;
  setSlot:     (slot: TimeSlot)   => void;
  resetBooking: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  selectedSalon:    null,
  selectedService:  null,
  selectedDate:     null,
  selectedBarberId: null,
  selectedSlot:     null,

  setSalon:    (salon)    => set({ selectedSalon: salon }),
  setService:  (service)  => set({ selectedService: service }),
  setDate:     (date)     => set({ selectedDate: date }),
  setBarber:   (id)       => set({ selectedBarberId: id }),
  setSlot:     (slot)     => set({ selectedSlot: slot }),

  resetBooking: () => set({
    selectedSalon: null, selectedService: null,
    selectedDate:  null, selectedBarberId: null, selectedSlot: null,
  }),
}));
```

---

## 4. Navigation Architecture

### Root Navigator — Role-Based Routing

```typescript
// apps/mobile/src/navigation/AppNavigator.tsx

import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

import { AuthStack }   from './AuthStack';
import { ClientTabNavigator } from './ClientTabNavigator';
import { BarberTabNavigator } from './BarberTabNavigator';

const Stack = createNativeStackNavigator();

// Custom dark theme aligned with brand colors
const BarberDZTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0F0F0F',
    card:        '#1A1A1A',
    text:        '#F5F5F5',
    border:      '#2C2C2C',
    primary:     '#E8A020',
  },
};

export function AppNavigator() {
  const { session, role, setSession, clearAuth } = useAuthStore();

  useEffect(() => {
    // Listen for Supabase auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        if (event === 'SIGNED_OUT') clearAuth();
      }
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <NavigationContainer theme={BarberDZTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          // Not authenticated → Auth flow
          <Stack.Screen name="Auth" component={AuthStack} />
        ) : role === 'Coiffeur' ? (
          // Barber tab navigator
          <Stack.Screen name="BarberApp" component={BarberTabNavigator} />
        ) : (
          // Client tab navigator (default)
          <Stack.Screen name="ClientApp" component={ClientTabNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

### Client Tab Navigator

```typescript
// apps/mobile/src/navigation/ClientTabNavigator.tsx

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen }           from '../screens/client/HomeScreen';
import { SearchScreen }         from '../screens/client/SearchScreen';
import { MyAppointmentsScreen } from '../screens/client/MyAppointmentsScreen';
import { ProfileScreen }        from '../screens/client/ProfileScreen';
import { TabBar }               from '../components/ui/TabBar'; // custom animated tab bar

const Tab = createBottomTabNavigator();

export function ClientTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"         component={HomeScreen}           />
      <Tab.Screen name="Explore"      component={SearchScreen}         />
      <Tab.Screen name="Appointments" component={MyAppointmentsScreen} />
      <Tab.Screen name="Profile"      component={ProfileScreen}        />
    </Tab.Navigator>
  );
}
```

### Route Param Types

```typescript
// apps/mobile/src/navigation/types.ts

export type ClientStackParamList = {
  Home:              undefined;
  Search:            { initialWilaya?: string };
  SalonDetail:       { salonId: string };
  Booking:           { salonId: string; serviceId?: string };
  BookingConfirm:    { reservationId: string };
  MyAppointments:    undefined;
  Loyalty:           undefined;
  Profile:           undefined;
};

export type BarberStackParamList = {
  Dashboard:     undefined;
  Calendar:      undefined;
  ClientCRM:     undefined;
  ClientDetail:  { clientId: string };
  Revenue:       undefined;
  ShopSettings:  undefined;
  Portfolio:     undefined;
  StaffManage:   undefined;
};
```

---

## 5. Custom Hooks — Deep Breakdown

### Hook 1: `useAvailableSlots` — Dynamic Slot Generation

This is the most compute-heavy client-side logic. It fetches booked reservations for a given date + salon, then generates all theoretically possible slots based on the service duration and salon hours, and finally marks each slot as available or not.

```typescript
// apps/mobile/src/hooks/booking/useAvailableSlots.ts

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { generateTimeSlots, isSlotBooked } from '@barberdz/shared/utils/timeSlots';

interface UseSlotsParams {
  salonId:     string | null;
  serviceId:   string | null;
  date:        string | null;   // "2025-07-15"
  barberId?:   string | null;
  openTime:    string;          // "09:00"
  closeTime:   string;          // "21:00"
  durationMin: number;          // e.g., 30
}

export interface TimeSlot {
  startTime:   string;    // "09:00"
  endTime:     string;    // "09:30"
  isAvailable: boolean;
}

export function useAvailableSlots({
  salonId, serviceId, date, barberId,
  openTime, closeTime, durationMin,
}: UseSlotsParams) {

  return useQuery<TimeSlot[]>({
    // Key includes all parameters → cache is per (salon, service, date, barber)
    queryKey: ['slots', salonId, serviceId, date, barberId],

    queryFn: async (): Promise<TimeSlot[]> => {
      // ── Step 1: Fetch all booked/pending slots for this date ──────────
      let query = supabase
        .from('reservations')
        .select('start_time, end_time, status')
        .eq('salon_id', salonId!)
        .eq('appointment_date', date!)
        .in('status', ['Confirmed', 'Pending']);

      if (barberId) {
        query = query.eq('barber_id', barberId);
      }

      const { data: bookedSlots, error } = await query;
      if (error) throw new Error(error.message);

      // ── Step 2: Generate all possible slots (pure function) ───────────
      // Slots are generated in `durationMin` increments
      // e.g., 30min service from 09:00→21:00 = [09:00,09:30,10:00,...,20:30]
      const allSlots = generateTimeSlots(openTime, closeTime, durationMin);

      // ── Step 3: Overlay booked data onto generated slots ──────────────
      return allSlots.map(slot => ({
        ...slot,
        isAvailable: !isSlotBooked(slot, bookedSlots ?? []),
      }));
    },

    // Only run if all required params are present
    enabled: Boolean(salonId && serviceId && date && durationMin > 0),

    // Refetch every 60 seconds to catch bookings by other users
    refetchInterval: 60 * 1000,

    // Keep stale data visible while refetching (no flash of empty state)
    placeholderData: (prev) => prev,
  });
}

// ─────────────────────────────────────────────────────────────────
// packages/shared/utils/timeSlots.ts  (shared between mobile & web)
// ─────────────────────────────────────────────────────────────────

export interface RawSlot {
  startTime: string;
  endTime:   string;
}

export function generateTimeSlots(
  openTime:    string,   // "09:00"
  closeTime:   string,   // "21:00"
  durationMin: number,   // 30
): RawSlot[] {
  const slots: RawSlot[] = [];
  const open  = timeToMinutes(openTime);
  const close = timeToMinutes(closeTime);

  let cursor = open;
  while (cursor + durationMin <= close) {
    slots.push({
      startTime: minutesToTime(cursor),
      endTime:   minutesToTime(cursor + durationMin),
    });
    cursor += durationMin;   // Move by service duration, not fixed 30min
  }
  return slots;
}

export function isSlotBooked(
  slot:  RawSlot,
  booked: { start_time: string; end_time: string }[],
): boolean {
  const slotStart = timeToMinutes(slot.startTime);
  const slotEnd   = timeToMinutes(slot.endTime);

  return booked.some(b => {
    const bStart = timeToMinutes(b.start_time);
    const bEnd   = timeToMinutes(b.end_time);
    // Standard half-open interval overlap: A.start < B.end && A.end > B.start
    return slotStart < bEnd && slotEnd > bStart;
  });
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
```

---

### Hook 2: `useSlotLock` — 5-Minute UX Lock

Prevents the user from accidentally navigating away from a tapped slot. Does NOT block other users (that's the DB trigger's job). Provides a countdown display and auto-expires.

```typescript
// apps/mobile/src/hooks/booking/useSlotLock.ts

import { useState, useCallback, useRef, useEffect } from 'react';

const LOCK_DURATION_MS = 5 * 60 * 1000;   // 5 minutes

interface Lock {
  startTime:  string;
  lockedAt:   number;   // Date.now() when locked
  timerId:    ReturnType<typeof setTimeout>;
}

interface UseSlotLockReturn {
  lockSlot:             (startTime: string) => void;
  releaseLock:          (startTime: string) => void;
  isSlotLocked:         (startTime: string) => boolean;
  isSlotLockedByMe:     (startTime: string) => boolean;
  getLockSecondsLeft:   (startTime: string) => number;
  activeLockedSlot:     string | null;  // The slot the current user has locked
}

export function useSlotLock(): UseSlotLockReturn {
  // Map<startTime, Lock>
  const [locks, setLocks] = useState<Map<string, Lock>>(new Map());
  const locksRef = useRef(locks);
  locksRef.current = locks;

  // Force re-render every second for countdown display
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const lockSlot = useCallback((startTime: string) => {
    // Clear any existing lock on this slot
    const existing = locksRef.current.get(startTime);
    if (existing) clearTimeout(existing.timerId);

    const timerId = setTimeout(() => {
      // Auto-release after 5 minutes
      setLocks(prev => {
        const next = new Map(prev);
        next.delete(startTime);
        return next;
      });
    }, LOCK_DURATION_MS);

    setLocks(prev =>
      new Map(prev).set(startTime, {
        startTime,
        lockedAt: Date.now(),
        timerId,
      })
    );
  }, []);

  const releaseLock = useCallback((startTime: string) => {
    const lock = locksRef.current.get(startTime);
    if (lock) clearTimeout(lock.timerId);
    setLocks(prev => {
      const next = new Map(prev);
      next.delete(startTime);
      return next;
    });
  }, []);

  const isSlotLocked = useCallback((startTime: string): boolean => {
    const lock = locksRef.current.get(startTime);
    if (!lock) return false;
    return (Date.now() - lock.lockedAt) < LOCK_DURATION_MS;
  }, []);

  // For this component, "locked by me" = any lock (single-user device)
  const isSlotLockedByMe = isSlotLocked;

  const getLockSecondsLeft = useCallback((startTime: string): number => {
    const lock = locksRef.current.get(startTime);
    if (!lock) return 0;
    const elapsed = Date.now() - lock.lockedAt;
    return Math.max(0, Math.ceil((LOCK_DURATION_MS - elapsed) / 1000));
  }, []);

  // Find the slot the current user has actively locked
  const activeLockedSlot = (() => {
    for (const [startTime, lock] of locksRef.current.entries()) {
      if ((Date.now() - lock.lockedAt) < LOCK_DURATION_MS) return startTime;
    }
    return null;
  })();

  return {
    lockSlot,
    releaseLock,
    isSlotLocked,
    isSlotLockedByMe,
    getLockSecondsLeft,
    activeLockedSlot,
  };
}
```

---

### Hook 3: `useRealtimeBookings` — Supabase Realtime for Barbers

The most architecturally significant hook. Subscribes to PostgreSQL row-level changes and updates local React Query cache without any page refresh.

```typescript
// apps/mobile/src/hooks/barber/useRealtimeBookings.ts

import { useEffect, useRef } from 'react';
import { useQueryClient }   from '@tanstack/react-query';
import { supabase }         from '../../lib/supabase';
import { triggerLocalNotification } from '../../lib/notifications';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Reservation } from '@barberdz/shared/types';

interface UseRealtimeBookingsOptions {
  salonId:          string | null;
  onNewBooking?:    (r: Reservation) => void;
  onStatusChange?:  (r: Reservation) => void;
  onCancellation?:  (r: Reservation) => void;
}

export function useRealtimeBookings({
  salonId,
  onNewBooking,
  onStatusChange,
  onCancellation,
}: UseRealtimeBookingsOptions) {
  const queryClient = useQueryClient();
  const channelRef  = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!salonId) return;

    // Unsubscribe from any previous channel
    channelRef.current?.unsubscribe();

    channelRef.current = supabase
      .channel(`salon-reservations:${salonId}`, {
        config: { broadcast: { self: false } },
      })

      // ── INSERT: New booking arrived ──────────────────────────────────
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'reservations',
          filter: `salon_id=eq.${salonId}`,
        },
        async (payload) => {
          const reservation = payload.new as Reservation;

          // 1. Optimistically prepend to the calendar cache
          queryClient.setQueryData<Reservation[]>(
            ['barber-reservations', salonId],
            (old) => [reservation, ...(old ?? [])],
          );

          // 2. Invalidate to get fresh server data shortly after
          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ['barber-reservations', salonId],
            });
          }, 2000);

          // 3. Fire a local device notification (app is open)
          await triggerLocalNotification({
            title: '💈 New Booking!',
            body:  `Client booked ${reservation.start_time} – ${reservation.end_time}`,
            data:  { screen: 'Calendar', reservationId: reservation.id },
          });

          onNewBooking?.(reservation);
        }
      )

      // ── UPDATE: Status changed (confirmed, cancelled, completed) ─────
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'reservations',
          filter: `salon_id=eq.${salonId}`,
        },
        (payload) => {
          const reservation = payload.new as Reservation;

          // Patch in place — no full refetch needed
          queryClient.setQueryData<Reservation[]>(
            ['barber-reservations', salonId],
            (old) =>
              (old ?? []).map(r => r.id === reservation.id ? reservation : r),
          );

          if (reservation.status === 'Cancelled') {
            onCancellation?.(reservation);
          } else {
            onStatusChange?.(reservation);
          }
        }
      )

      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] ✅ Subscribed: salon ${salonId}`);
        }
        if (status === 'CHANNEL_ERROR') {
          console.error(`[Realtime] ❌ Channel error:`, err);
          // Attempt reconnect after 5 seconds
          setTimeout(() => channelRef.current?.subscribe(), 5000);
        }
      });

    // Cleanup on unmount or salonId change
    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [salonId]);
}
```

---

## 6. Client App — Screen-by-Screen Plan

### Screen 1: Home (Map & Discovery)

**Purpose:** First impression. Users see nearby salons on a Mapbox map with a bottom sheet carousel.

**Component Tree:**
```
HomeScreen
├── SalonMapView                    ← Mapbox MapView
│   ├── UserLocationDot             ← Blue pulsing dot (expo-location)
│   └── SalonMarker[]               ← Custom amber pin per salon
│       └── Callout (tap = preview)
├── SearchBar                       ← Top sticky input, opens SearchScreen
├── FilterPills                     ← Horizontal scroll: Nearby · ⭐4+ · Beard · Keratin
└── NearbyBottomSheet               ← Gorhom BottomSheet (snap: 20% / 50% / 90%)
    └── FlatList of SalonCard[]
        ├── SalonCard
        │   ├── CoverImage (Supabase Storage)
        │   ├── SalonName + WilayaBadge
        │   ├── RatingRow (stars + count)
        │   ├── DistanceBadge (e.g., "1.2 km")
        │   └── SponsoredBadge (conditional ⭐)
        └── SkeletonCard[]          ← Loading state
```

**Logic:**

```typescript
// apps/mobile/src/screens/client/HomeScreen.tsx  (pseudocode flow)

function HomeScreen() {
  // 1. Get user's current location
  const [location, setLocation] = useState<Coords | null>(null);

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        Location.getCurrentPositionAsync({}).then(loc =>
          setLocation(loc.coords)
        );
      }
    });
  }, []);

  // 2. Fetch nearby salons (using PostGIS ST_DWithin in Supabase RPC)
  const { data: salons, isLoading } = useQuery({
    queryKey:  ['nearby-salons', location?.latitude, location?.longitude],
    queryFn:   () => fetchNearbySalons(location!, radiusKm: 10),
    enabled:   !!location,
  });

  // 3. Active filter state (multi-select)
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const filteredSalons = useMemo(
    () => applyClientFilters(salons, activeFilters),
    [salons, activeFilters]
  );

  // 4. Sync map camera to user location on first load
  const mapRef = useRef<MapboxGL.MapView>(null);
  useEffect(() => {
    if (location) {
      mapRef.current?.setCamera({ centerCoordinate: [location.longitude, location.latitude] });
    }
  }, [location]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <SalonMapView
        ref={mapRef}
        salons={filteredSalons}
        userLocation={location}
        onMarkerPress={(salon) => navigate('SalonDetail', { salonId: salon.id })}
      />
      <SearchBar onPress={() => navigate('Search')} />
      <FilterPills filters={FILTER_OPTIONS} active={activeFilters} onToggle={...} />
      <NearbyBottomSheet salons={filteredSalons} isLoading={isLoading} />
    </View>
  );
}

// Supabase RPC call for geolocation (calls PostGIS-powered function)
async function fetchNearbySalons(coords: Coords, radiusKm: number) {
  const { data, error } = await supabase.rpc('get_nearby_salons', {
    user_lat:  coords.latitude,
    user_lng:  coords.longitude,
    radius_km: radiusKm,
  });
  if (error) throw error;
  return data;
}
```

**UX Details:**
- Map markers use a custom amber scissor icon SVG; tapping shows a mini card callout.
- Bottom sheet snaps at 25% (map focus), 55% (half), 90% (full list).
- Sponsored salons appear first in both the list and with a gold ring on their map pin.
- Pull-to-refresh on the bottom sheet list refetches `nearby-salons`.

---

### Screen 2: Search & Filter

**Purpose:** Power users searching by wilaya, service type, price range.

**Component Tree:**
```
SearchScreen
├── SearchBar (autofocused)
├── FilterDrawer (bottom sheet)
│   ├── WilayaPicker          ← 58 wilayas searchable FlatList
│   ├── PriceRangeSlider      ← @miblanchard/react-native-range-slider
│   ├── ServiceCheckboxes     ← Coupe, Barbe, Kératine, Lissage, etc.
│   └── ApplyButton
└── ResultsList               ← Animated FlatList with stagger entry
    └── SalonCard[] (same as Home)
```

**Filter logic (client-side after fetch):**
```typescript
function applyFilters(salons: Salon[], filters: FilterState): Salon[] {
  return salons
    .filter(s => !filters.wilaya || s.wilaya === filters.wilaya)
    .filter(s => !filters.maxPrice || s.services.some(sv => sv.price <= filters.maxPrice))
    .filter(s =>
      filters.services.length === 0 ||
      s.services.some(sv =>
        filters.services.some(f =>
          sv.service_name.toLowerCase().includes(f.toLowerCase())
        )
      )
    )
    .sort((a, b) => {
      // Sponsored always first, then by rating
      if (a.is_sponsored !== b.is_sponsored) return a.is_sponsored ? -1 : 1;
      return b.average_rating - a.average_rating;
    });
}
```

---

### Screen 3: Salon Detail

**Component Tree:**
```
SalonDetailScreen
├── ScrollView
│   ├── HeroImage (cover photo from Supabase Storage)
│   │   └── GradientOverlay (name + wilaya + distance)
│   ├── SalonInfoSection
│   │   ├── OpenStatusBadge   ("Open until 21:00" / "Closed")
│   │   ├── AddressRow        (icon + full address + "Navigate" button)
│   │   └── WorkingHoursRow
│   ├── StaffAvatarRow        (if multi-staff: horizontal avatars)
│   ├── ServicesSection
│   │   └── ServiceCard[]     (name, price in DZD, duration badge)
│   ├── PortfolioSection
│   │   └── GalleryGrid       (3-column image grid, fullscreen on tap)
│   └── ReviewsSection
│       ├── AggregateRating   (big number + star bar breakdown)
│       └── ReviewCard[]      (client avatar, text, date, stars)
│
└── StickyBookButton          ("Book Now" → amber, bottom fixed)
```

**Gallery fetch:**
```typescript
// Fetch portfolio photos from Supabase Storage
async function fetchPortfolioPhotos(salonId: string) {
  const { data, error } = await supabase
    .from('portfolio_photos')
    .select('id, storage_path, caption')
    .eq('salon_id', salonId)
    .order('created_at', { ascending: false });

  // Generate public URLs from storage paths
  return (data ?? []).map(photo => ({
    ...photo,
    url: supabase.storage
      .from('portfolios')
      .getPublicUrl(photo.storage_path).data.publicUrl,
  }));
}
```

---

### Screen 4: Booking Flow (Multi-Step)

This is the most complex client screen. It is broken into **4 sub-steps** rendered inside a single `BookingScreen` with animated step transitions.

```
BookingScreen
├── StepIndicator        (Step 1 of 4, animated progress bar)
│
├── Step 1: SelectService
│   └── ServiceList      (radio selection of salon services)
│       └── ServiceCard  (name, price, duration badge)
│
├── Step 2: SelectDate
│   └── DateStrip        (horizontal scroll of next 14 days)
│       └── DateCell[]   (day name, day number, today indicator)
│
├── Step 3: SelectBarber (optional, shown if salon has multi-staff)
│   └── BarberAvatarSelector
│       └── StaffCard[]  (avatar, name, "Any barber" option)
│
└── Step 4: SelectSlot
    └── SlotPicker       ← CORE COMPONENT (detailed below)
        ├── SlotGrid     (FlatList numColumns=3)
        │   └── SlotCell[] (time label, state-aware styling)
        └── SelectedSlotBar
            ├── TimeDisplay   ("09:00 → 09:30")
            ├── LockCountdown (if locked: "Locked for 4:32")
            └── ConfirmButton → BookingConfirmScreen
```

**SlotPicker Component (full implementation):**

```typescript
// apps/mobile/src/components/booking/SlotPicker.tsx

import React, { useMemo } from 'react';
import { FlatList, TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useAvailableSlots } from '../../hooks/booking/useAvailableSlots';
import { useSlotLock }       from '../../hooks/booking/useSlotLock';
import { colors, typography, spacing, radius } from '../../theme';

interface SlotPickerProps {
  salonId:      string;
  serviceId:    string;
  date:         string;
  barberId?:    string;
  openTime:     string;
  closeTime:    string;
  durationMin:  number;
  onConfirm:    (slot: { startTime: string; endTime: string }) => void;
}

export function SlotPicker({
  salonId, serviceId, date, barberId,
  openTime, closeTime, durationMin, onConfirm,
}: SlotPickerProps) {

  const { data: slots = [], isLoading, isRefetching } = useAvailableSlots({
    salonId, serviceId, date, barberId, openTime, closeTime, durationMin,
  });

  const {
    lockSlot, releaseLock, isSlotLocked,
    isSlotLockedByMe, getLockSecondsLeft, activeLockedSlot,
  } = useSlotLock();

  const handleSlotPress = (slot: { startTime: string; endTime: string; isAvailable: boolean }) => {
    if (!slot.isAvailable) return;

    if (isSlotLockedByMe(slot.startTime)) {
      // Tapping own locked slot → release the lock (deselect)
      releaseLock(slot.startTime);
    } else {
      // Release any previously locked slot first
      if (activeLockedSlot) releaseLock(activeLockedSlot);
      // Lock the new slot for 5 minutes
      lockSlot(slot.startTime);
    }
  };

  const selectedSlot = useMemo(
    () => slots.find(s => isSlotLockedByMe(s.startTime)),
    [slots, activeLockedSlot]
  );

  const getSlotState = (slot: { startTime: string; isAvailable: boolean }) => {
    if (!slot.isAvailable)            return 'booked';
    if (isSlotLockedByMe(slot.startTime)) return 'selected';
    if (isSlotLocked(slot.startTime))  return 'locked';  // Locked by another user (future)
    return 'available';
  };

  const slotStateStyles = {
    available: styles.slotAvailable,
    booked:    styles.slotBooked,
    selected:  styles.slotSelected,
    locked:    styles.slotLocked,
  };

  if (isLoading) return <SlotSkeleton />;

  return (
    <View>
      {isRefetching && <RefetchIndicator />}

      <FlatList
        data={slots}
        numColumns={3}
        keyExtractor={(item) => item.startTime}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => {
          const state = getSlotState(item);
          return (
            <TouchableOpacity
              style={[styles.slot, slotStateStyles[state]]}
              onPress={() => handleSlotPress(item)}
              disabled={state === 'booked'}
              activeOpacity={0.75}
            >
              <Text style={[
                styles.slotTime,
                state === 'booked' && styles.slotTimeBooked,
                state === 'selected' && styles.slotTimeSelected,
              ]}>
                {item.startTime}
              </Text>
              {state === 'booked' && (
                <Text style={styles.slotBooked}>✕</Text>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* Sticky confirmation bar — appears when a slot is locked */}
      {selectedSlot && (
        <Animated.View style={styles.confirmBar}>
          <View>
            <Text style={styles.confirmTime}>
              {selectedSlot.startTime} → {selectedSlot.endTime}
            </Text>
            <Text style={styles.confirmLock}>
              🔒 Reserved for {getLockSecondsLeft(selectedSlot.startTime)}s
            </Text>
          </View>
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => onConfirm(selectedSlot)}
          >
            <Text style={styles.confirmBtnText}>Confirm →</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid:              { padding: spacing.md },
  slot:              {
    flex: 1, margin: spacing.xs, paddingVertical: spacing.sm,
    borderRadius: radius.md, alignItems: 'center', borderWidth: 1,
    borderColor: 'transparent',
  },
  slotAvailable:     { backgroundColor: colors.slotAvailable },
  slotBooked:        { backgroundColor: colors.slotBooked, opacity: 0.5 },
  slotSelected:      { backgroundColor: colors.slotSelected, borderColor: colors.amber },
  slotLocked:        { backgroundColor: colors.slotLocked, borderColor: colors.slotLockedBorder },
  slotTime:          { ...typography.label, color: colors.textPrimary },
  slotTimeBooked:    { color: colors.textMuted },
  slotTimeSelected:  { color: colors.ink, fontFamily: 'DMSans_700Bold' },
  confirmBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.graphite, borderRadius: radius.lg,
    padding: spacing.lg, margin: spacing.md,
    borderWidth: 1, borderColor: colors.amber,
  },
  confirmTime:     { ...typography.h3, color: colors.textPrimary },
  confirmLock:     { ...typography.caption, color: colors.warning, marginTop: 2 },
  confirmBtn:      { backgroundColor: colors.amber, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  confirmBtnText:  { ...typography.label, color: colors.ink, fontFamily: 'DMSans_700Bold' },
});
```

---

### Screen 5: My Appointments

**Component Tree:**
```
MyAppointmentsScreen
├── SegmentedControl         ["Upcoming" | "Completed" | "Cancelled"]
└── AnimatedFlatList
    └── AppointmentCard[]
        ├── SalonAvatar + Name
        ├── DateTimeRow       (formatted: "Lundi 15 Juillet · 09:30")
        ├── ServiceBadge      ("Coupe + Barbe · 45 min")
        ├── StatusBadge       (color-coded pill)
        └── ActionRow
            ├── CancelButton  (only on Pending status)
            └── RebookButton  (quick re-book with same salon)
```

---

### Screen 6: Loyalty Points

**Component Tree:**
```
LoyaltyScreen
├── LoyaltyHeader
│   ├── BigPointsDisplay     (e.g., "340 pts" in amber)
│   └── LevelBadge           ("Silver Member")
├── ProgressCard
│   ├── ProgressBar          (animated fill toward next free cut)
│   ├── ProgressLabel        ("340 / 500 pts — 2 more cuts to go!")
│   └── RewardPreview        ("🎁 Free Haircut at 500 pts")
└── TransactionsList
    └── LoyaltyTransactionRow[]
        ├── Icon (+ green / - red)
        ├── Description       ("Coupe at BarberDZ Alger")
        ├── Date
        └── PointsDelta       ("+50 pts" / "-200 pts")
```

---

## 7. Barber App — Screen-by-Screen Plan

### Screen 1: Dashboard (Live Booking Feed)

**Purpose:** First screen barbers see when they open the app. Shows today's schedule + live feed of incoming bookings.

**Component Tree:**
```
DashboardScreen
├── GreetingHeader           ("Bonjour, Karim 👋")
├── TodaySummaryRow
│   ├── StatBox ("8", "Today's Bookings")
│   ├── StatBox ("12,400 DZD", "Today's Revenue")
│   └── StatBox ("2", "Pending Confirm")
├── NextAppointmentCard      (countdown timer to next booking)
├── SectionLabel             "Live Bookings Feed"
└── LiveFeedList             ← Driven by useRealtimeBookings
    └── LiveFeedItem[]
        ├── PulsingDot       (green = new, blue = upcoming)
        ├── ClientName + Service
        ├── TimeRange
        └── QuickActions     [Confirm] [Cancel]
```

**Realtime integration:**
```typescript
// apps/mobile/src/screens/barber/DashboardScreen.tsx

function DashboardScreen() {
  const { salonId } = useBarberProfile();
  const [liveItems, setLiveItems] = useState<Reservation[]>([]);

  // Initial fetch
  const { data: todaysBookings } = useQuery({
    queryKey: ['barber-reservations', salonId, today()],
    queryFn:  () => fetchTodaysReservations(salonId),
  });

  // Realtime layer — updates liveItems in place
  useRealtimeBookings({
    salonId,
    onNewBooking: (reservation) => {
      setLiveItems(prev => [reservation, ...prev]);
      // Haptic feedback for new booking
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onStatusChange: (reservation) => {
      setLiveItems(prev =>
        prev.map(r => r.id === reservation.id ? reservation : r)
      );
    },
  });

  const allItems = useMemo(
    () => mergeAndDedup([...(todaysBookings ?? []), ...liveItems]),
    [todaysBookings, liveItems]
  );

  return (
    <FlatList
      data={allItems}
      renderItem={({ item }) => <LiveFeedItem reservation={item} />}
      // Animate new items sliding in from top
      itemLayoutAnimation={LinearTransition}
    />
  );
}
```

---

### Screen 2: Realtime Calendar

**Purpose:** Full-day/week agenda view. Slots fill in real-time. No refresh button — it just updates.

**Component Tree:**
```
CalendarScreen
├── WeekStrip                ← Tap to select day
│   └── DayCell[]            (date + booking count dot indicator)
├── TimelineView             ← Vertical scrollable timeline
│   ├── HourLabels[]         (09:00, 10:00 ... 21:00)
│   └── DayColumn
│       ├── EmptySlots[]     (lightly ruled background)
│       └── ReservationBlock[]  ← Positioned by start_time + height by duration
│           ├── ClientName
│           ├── ServiceName
│           └── StatusIndicator
└── AddBreakFAB              (barber can block a time slot manually)
```

**Positioning logic for timeline blocks:**
```typescript
// Convert start_time to pixel top offset
function timeToPixelOffset(time: string, hourHeight: number = 80): number {
  const [h, m] = time.split(':').map(Number);
  const minutesSinceMidnight = h * 60 + m;
  const minutesSinceOpen = minutesSinceMidnight - 9 * 60;  // 09:00 open
  return (minutesSinceOpen / 60) * hourHeight;
}

// Convert duration_minutes to block height
function durationToHeight(durationMin: number, hourHeight: number = 80): number {
  return (durationMin / 60) * hourHeight;
}
```

---

### Screen 3: Client CRM

**Component Tree:**
```
ClientCRMScreen
├── SearchBar                ("Search clients...")
├── SortOptions              [Recent | Most Visits | Alphabetical]
└── ClientList
    └── ClientRow[]
        ├── ClientAvatar
        ├── ClientName + Phone
        ├── LastVisitDate
        ├── VisitCount badge
        └── ChevronRight → ClientDetailScreen
```

```
ClientDetailScreen
├── ClientHeader             (avatar, name, total visits, total spent)
├── VisitHistoryTimeline
│   └── VisitCard[]
│       ├── Date
│       ├── Services received
│       ├── Price paid
│       └── BarberNote       (barber can add/edit notes per visit)
└── AddNoteButton            → NoteEditorSheet
```

---

### Screen 4: Revenue & Statistics

**Component Tree:**
```
RevenueScreen
├── PeriodSelector           [Today | Week | Month | Custom]
├── TotalRevenueCard         (large amber number, % change vs previous)
├── RevenueChart             ← recharts (web) / Victory Native (mobile)
│   └── BarChart or LineChart (earnings by day/hour)
├── TopServicesSection
│   └── ServiceRow[]         (service name, count, revenue, %)
├── PeakHoursHeatmap         (7-day × 12-hour grid, amber intensity = bookings)
└── ClientRetentionCard      (new vs returning clients %)
```

**Chart data preparation:**
```typescript
// Group reservations by date for bar chart
function buildChartData(
  reservations: Reservation[],
  period: 'day' | 'week' | 'month'
): ChartPoint[] {
  const grouped = groupBy(
    reservations.filter(r => r.status === 'Completed'),
    r => formatDateForPeriod(r.appointment_date, period)
  );
  return Object.entries(grouped).map(([label, items]) => ({
    label,
    revenue: items.reduce((sum, r) => sum + (r.service?.price ?? 0), 0),
    count:   items.length,
  }));
}
```

---

### Screen 5: Shop Management

**Component Tree:**
```
ShopSettingsScreen
├── SalonProfileSection
│   ├── CoverPhotoUploader   ← ImagePicker → Supabase Storage 'salon-covers'
│   ├── SalonNameInput
│   ├── AddressInput
│   └── DescriptionInput
├── WorkingHoursSection
│   ├── OpenTimeInput        (time picker)
│   ├── CloseTimeInput       (time picker)
│   └── WorkingDaysSelector  (Su Mo Tu We Th Fr Sa toggle row)
├── PortfolioSection         → navigates to PortfolioScreen
└── StaffSection             → navigates to StaffManageScreen
```

**Portfolio upload flow:**
```typescript
async function uploadPortfolioPhoto(salonId: string, localUri: string) {
  // 1. Read file as blob
  const response = await fetch(localUri);
  const blob     = await response.blob();

  // 2. Generate unique storage path
  const filename    = `${Date.now()}.jpg`;
  const storagePath = `${salonId}/${filename}`;

  // 3. Upload to Supabase Storage 'portfolios' bucket
  const { error: uploadError } = await supabase.storage
    .from('portfolios')
    .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) throw uploadError;

  // 4. Insert record in portfolio_photos table
  const { error: dbError } = await supabase
    .from('portfolio_photos')
    .insert({ salon_id: salonId, uploader_id: currentUserId, storage_path: storagePath });
  if (dbError) throw dbError;
}
```

---

## 8. Super Admin Portal — Page-by-Page Plan

**Stack:** Next.js 14 (App Router) + Supabase JS + shadcn/ui + Recharts

**Layout:**
```
AdminLayout
├── Sidebar                  (logo, nav links, sign out)
│   ├── Dashboard
│   ├── Salon Approvals
│   ├── Subscriptions
│   └── Sponsored Profiles
└── <Outlet />               (page content area)
```

---

### Page 1: Salon Approvals

```tsx
// apps/admin/app/salons/page.tsx

export default function SalonApprovalsPage() {
  // Fetch salons awaiting approval
  const { data: pending } = useSuspenseQuery({
    queryKey: ['admin-pending-salons'],
    queryFn:  () => supabase
      .from('salons')
      .select('*, profiles!owner_id(full_name, phone_number)')
      .eq('is_approved', false)
      .order('created_at', { ascending: false })
      .then(r => r.data),
  });

  return (
    <DataTable
      data={pending}
      columns={[
        { key: 'name',           header: 'Salon Name' },
        { key: 'owner_name',     header: 'Owner',      render: r => r.profiles.full_name },
        { key: 'wilaya',         header: 'Wilaya' },
        { key: 'created_at',     header: 'Applied',    render: r => formatDate(r.created_at) },
        {
          key:    'actions',
          header: 'Actions',
          render: (row) => (
            <ActionCell>
              <ApproveButton salonId={row.id} />
              <RejectButton  salonId={row.id} />
              <ViewDetailButton salonId={row.id} />
            </ActionCell>
          ),
        },
      ]}
    />
  );
}

// Approve mutation
async function approveSalon(salonId: string) {
  await supabase
    .from('salons')
    .update({
      is_approved:         true,
      subscription_status: 'Trial',
      trial_ends_at:       new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),  // 3 months
    })
    .eq('id', salonId);
}
```

---

### Page 2: Subscription Management

```
SubscriptionsPage
├── StatusFilterTabs         [All | Trial | Active | Expired]
├── SummaryCards
│   ├── StatCard ("42 Active")
│   ├── StatCard ("17 Trial — Expiring in 30 days")
│   └── StatCard ("8 Expired")
└── SubscriptionTable
    └── SubscriptionRow[]
        ├── SalonName
        ├── WilayaBadge
        ├── SubscriptionBadge   (Trial/Active/Expired — color coded)
        ├── ExpiresAt
        └── QuickActions        [Renew | Suspend | Upgrade]
```

---

### Page 3: Sponsored Profiles

```
SponsoredPage
├── ActiveSponsoredList      (salons with is_sponsored=true)
│   └── SponsoredRow[]
│       ├── SalonName + Wilaya
│       ├── SponsoredUntil date
│       └── ToggleOff button
└── EligibleForBoostList     (active subscription, not sponsored)
    └── EligibleRow[]
        ├── SalonName
        └── ActivateSponsorButton → DatePickerModal
```

**Toggle sponsor mutation:**
```typescript
async function toggleSponsor(salonId: string, active: boolean, until?: Date) {
  await supabase
    .from('salons')
    .update({
      is_sponsored:    active,
      sponsored_until: active ? until?.toISOString() : null,
    })
    .eq('id', salonId);
}
```

---

## 9. Push Notification Architecture

### Client-Side Notifications (Appointment Reminders)

```typescript
// apps/mobile/src/lib/notifications.ts

import * as Notifications from 'expo-notifications';
import * as Device        from 'expo-device';
import { supabase }       from './supabase';

// Configure notification appearance
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// Register device and save token to Supabase
export async function registerForPushNotifications(userId: string): Promise<void> {
  if (!Device.isDevice) return;  // Skip simulators

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  const finalStatus = existingStatus !== 'granted'
    ? (await Notifications.requestPermissionsAsync()).status
    : existingStatus;

  if (finalStatus !== 'granted') {
    console.warn('[Push] Permission denied');
    return;
  }

  const token = (await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID!,
  })).data;

  // Upsert token in profiles table
  await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', userId);
}

// Schedule a local reminder 1 hour before appointment
export async function scheduleAppointmentReminder(
  reservation: { id: string; appointment_date: string; start_time: string; salon_name: string }
): Promise<string> {
  const appointmentDt = new Date(`${reservation.appointment_date}T${reservation.start_time}`);
  const reminderDt    = new Date(appointmentDt.getTime() - 60 * 60 * 1000);  // 1 hour before

  const triggerId = await Notifications.scheduleNotificationAsync({
    identifier: `reminder-${reservation.id}`,
    content: {
      title: '💈 Appointment in 1 Hour',
      body:  `Your appointment at ${reservation.salon_name} is at ${reservation.start_time}`,
      data:  { screen: 'MyAppointments', reservationId: reservation.id },
      sound: true,
    },
    trigger: { date: reminderDt },
  });

  return triggerId;
}

// Cancel a scheduled reminder (when appointment is cancelled)
export async function cancelAppointmentReminder(reservationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(`reminder-${reservationId}`);
}

// Trigger an immediate local notification (for barbers on new booking)
export async function triggerLocalNotification(payload: {
  title: string; body: string; data?: Record<string, string>;
}): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: payload.title,
      body:  payload.body,
      data:  payload.data ?? {},
      sound: true,
    },
    trigger: null,  // null = show immediately
  });
}
```

### Notification Flow Diagram

```
CLIENT BOOKS APPOINTMENT
        │
        ▼
[BookingConfirmScreen] ────▶ scheduleAppointmentReminder()
                                    │
                                    ▼
                           Expo Scheduled Notification
                           (fires 1hr before appointment)
                                    │
                                    ▼
                           Client phone shows:
                           "💈 Appointment in 1 Hour
                            Your appointment at Salon Ahmed
                            is at 09:30"


NEW BOOKING INSERTED TO DB
        │
        ▼
[Supabase Realtime] ──▶ useRealtimeBookings.onNewBooking()
                                │
                                ▼
                        triggerLocalNotification()
                                │
                                ▼
                        Barber phone shows (app open):
                        "💈 New Booking!
                         Client booked 09:00 – 09:30"
```

---

## 10. Implementation Roadmap

### Sprint 1 (Week 1–2): Foundation & Auth

```
Priority  │ Task                                                    │ Screen/File
──────────┼─────────────────────────────────────────────────────────┼──────────────────────
🔴 P0     │ Setup Expo project + install all deps                   │ package.json
🔴 P0     │ Configure Supabase client (SecureStore adapter)         │ lib/supabase.ts
🔴 P0     │ Setup React Query client + QueryClientProvider          │ lib/queryClient.ts
🔴 P0     │ Setup Zustand auth store + persist                      │ store/authStore.ts
🔴 P0     │ Load fonts (Syne + DM Sans via expo-google-fonts)       │ App.tsx
🔴 P0     │ Build theme tokens (colors, typography, spacing)        │ theme/
🔴 P0     │ PhoneInputScreen + OTPVerifyScreen                      │ screens/auth/
🔴 P0     │ RoleSelectScreen (Client vs Coiffeur)                   │ screens/auth/
🔴 P0     │ AppNavigator (role-based routing)                       │ navigation/
🟡 P1     │ Base UI atoms: Button, Card, Badge, Input, Skeleton     │ components/ui/
🟡 P1     │ Register for push notifications on auth success         │ lib/notifications.ts
```

### Sprint 2 (Week 3–4): Client Discovery

```
Priority  │ Task                                                    │ Screen/File
──────────┼─────────────────────────────────────────────────────────┼──────────────────────
🔴 P0     │ HomeScreen: Mapbox map + user geolocation               │ screens/client/HomeScreen
🔴 P0     │ SalonMarker component (custom amber pin)                │ components/map/
🔴 P0     │ NearbyBottomSheet + SalonCard                           │ components/map/
🔴 P0     │ useNearbySalons hook (Supabase RPC)                     │ hooks/salons/
🟡 P1     │ ClientTabNavigator (bottom tabs)                        │ navigation/
🟡 P1     │ SearchScreen + FilterDrawer                             │ screens/client/
🟡 P1     │ SalonDetailScreen: info + hours + staff                 │ screens/client/
🟡 P1     │ GalleryGrid (portfolio from Storage)                    │ components/salon/
🟢 P2     │ ReviewsSection + ReviewCard                             │ components/salon/
```

### Sprint 3 (Week 5–6): Booking Flow (CRITICAL PATH)

```
Priority  │ Task                                                    │ Screen/File
──────────┼─────────────────────────────────────────────────────────┼──────────────────────
🔴 P0     │ generateTimeSlots() pure function (shared)              │ packages/shared/
🔴 P0     │ useAvailableSlots hook (fetch + generate + overlay)     │ hooks/booking/
🔴 P0     │ useSlotLock hook (5-min UX lock, countdown)             │ hooks/booking/
🔴 P0     │ SlotPicker component (full state-aware grid)            │ components/booking/
🔴 P0     │ BookingScreen (4-step wizard: service→date→barber→slot) │ screens/client/
🔴 P0     │ useCreateReservation hook (mutation + error handling)   │ hooks/booking/
🔴 P0     │ BookingConfirmScreen (summary + confirm + reminder sched)│ screens/client/
🟡 P1     │ DateStrip component (14-day horizontal selector)        │ components/booking/
🟡 P1     │ scheduleAppointmentReminder() on booking success        │ lib/notifications.ts
🟡 P1     │ BookingStore (wizard state management)                  │ store/bookingStore.ts
```

### Sprint 4 (Week 7–8): Barber App (CRITICAL PATH)

```
Priority  │ Task                                                    │ Screen/File
──────────┼─────────────────────────────────────────────────────────┼──────────────────────
🔴 P0     │ useRealtimeBookings hook (Supabase channel)             │ hooks/barber/
🔴 P0     │ BarberTabNavigator                                      │ navigation/
🔴 P0     │ DashboardScreen (live feed + today summary)             │ screens/barber/
🔴 P0     │ CalendarScreen (timeline view, realtime blocks)         │ screens/barber/
🔴 P0     │ ReservationBlock (positioned by time, height by duration)│ components/barber/
🟡 P1     │ BarberDashboardScreen (today stats cards)               │ screens/barber/
🟡 P1     │ Haptics on new booking (expo-haptics)                   │ hooks/barber/
🟡 P1     │ Quick actions: Confirm/Cancel from dashboard            │ components/barber/
```

### Sprint 5 (Week 9–10): Client & Barber Extras

```
Priority  │ Task                                                    │ Screen/File
──────────┼─────────────────────────────────────────────────────────┼──────────────────────
🟡 P1     │ MyAppointmentsScreen (segmented: upcoming/completed)    │ screens/client/
🟡 P1     │ LoyaltyScreen (progress bar, transaction history)       │ screens/client/
🟡 P1     │ ProfileScreen (edit name, phone, avatar upload)         │ screens/client/
🟡 P1     │ ClientCRMScreen + ClientDetailScreen                    │ screens/barber/
🟡 P1     │ RevenueScreen (Victory Native charts)                   │ screens/barber/
🟢 P2     │ ShopSettingsScreen (hours, photos, staff)               │ screens/barber/
🟢 P2     │ PortfolioScreen (upload + delete photos)                │ screens/barber/
🟢 P2     │ StaffManageScreen (add/remove staff)                    │ screens/barber/
```

### Sprint 6 (Week 11–12): Admin Portal + Polish

```
Priority  │ Task                                                    │ Screen/File
──────────┼─────────────────────────────────────────────────────────┼──────────────────────
🔴 P0     │ Next.js 14 admin project setup                         │ apps/admin/
🔴 P0     │ SalonApprovalsPage (DataTable + approve/reject)         │ admin/salons/
🟡 P1     │ SubscriptionManagementPage (status tabs + quick actions)│ admin/subscriptions/
🟡 P1     │ SponsoredProfilesPage (toggle + date picker)           │ admin/sponsored/
🟡 P1     │ Admin dashboard stats cards (overview)                 │ admin/page.tsx
🟢 P2     │ Empty states (every FlatList needs one)                │ components/ui/
🟢 P2     │ Error boundaries for all screens                       │ All screens
🟢 P2     │ Onboarding walkthrough (new user first-launch screens)  │ screens/auth/
🟢 P2     │ App-wide loading skeleton audit                        │ All screens
```

---

## 11. Performance & Quality Checklist

### React Native Performance

```
✅ Use FlatList instead of ScrollView + map() for all lists
✅ keyExtractor always returns stable unique key (id, not index)
✅ getItemLayout on fixed-height lists (CalendarScreen hourBlocks)
✅ windowSize={5} on large FlatLists (ReviewsList, SlotGrid)
✅ removeClippedSubviews={true} on long lists
✅ useMemo() on slot filtering, chart data calculations
✅ useCallback() on all event handlers passed as props
✅ React.memo() on SlotCell, SalonCard, ReviewCard, LiveFeedItem
✅ Image prefetching for gallery grids (expo-image with priority="high")
✅ Supabase queries use .select('specific,columns') — never .select('*')
✅ React Query staleTime tuned per query (slots: 30s, salons: 2min)
✅ Realtime channels cleaned up on component unmount
✅ Booking wizard state in Zustand (no prop drilling across 4 steps)
```

### Code Quality

```
✅ TypeScript strict mode — no any types
✅ All Supabase responses typed with Database['public']['Tables']['...']['Row']
✅ Error boundaries on every screen with fallback UI
✅ Loading skeleton for every async component (no blank screens)
✅ All network errors surfaced to user (Toast notification)
✅ Optimistic UI updates on mutations (React Query optimistic updates)
✅ Pull-to-refresh on all lists (refetch on pull)
✅ Empty state component for every empty list scenario
✅ Expo EAS Build for production (not expo start)
✅ Environment variables validated at startup (check EXPO_PUBLIC_* presence)
```

### Accessibility (a11y)

```
✅ accessibilityLabel on all TouchableOpacity and Image components
✅ accessibilityRole="button" on interactive elements
✅ accessibilityState={{ disabled: true }} on booked SlotCell
✅ Minimum touch target 44×44pt on all tappable elements
✅ Color is never the ONLY indicator of state (always pair with text/icon)
   → Booked slots: grey background AND "✕" icon
   → Selected slot: amber background AND "✓" icon
✅ Screen reader compatible FlatList (accessibilityLabel on each item)
```

### Key Dependencies

```json
{
  "dependencies": {
    "@supabase/supabase-js":              "^2.x",
    "@tanstack/react-query":              "^5.x",
    "zustand":                            "^4.x",
    "@react-navigation/native":           "^6.x",
    "@react-navigation/bottom-tabs":      "^6.x",
    "@react-navigation/native-stack":     "^6.x",
    "@rnmapbox/maps":                     "^10.x",
    "expo-location":                      "~17.x",
    "expo-image-picker":                  "~15.x",
    "expo-notifications":                 "~0.28.x",
    "expo-haptics":                       "~13.x",
    "expo-secure-store":                  "~13.x",
    "@gorhom/bottom-sheet":               "^4.x",
    "react-native-reanimated":            "~3.x",
    "moti":                               "^0.29.x",
    "victory-native":                     "^41.x",
    "@expo-google-fonts/syne":            "latest",
    "@expo-google-fonts/dm-sans":         "latest"
  }
}
```

---

*BarberDZ Frontend Architecture — A-to-Z Execution Plan*
*Apps: React Native (Expo) Client · React Native (Expo) Barber · Next.js Admin*
*Authored by: Senior Frontend Architect | Ready for Implementation*
