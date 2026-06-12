// apps/mobile/src/contexts/RealtimeBookingsContext.tsx
// Singleton context for barber realtime booking updates.
// Wrapping BarberTabNavigator with this provider ensures only ONE
// Supabase Realtime subscription is active regardless of how many tabs
// render DashboardScreen or CalendarScreen simultaneously.
// RT-1 fix: prevents duplicate channels that could fire double notifications.

import React, { createContext, useContext } from 'react';
import { useRealtimeBookings } from '../hooks/barber/useRealtimeBookings';
import type { Reservation } from '@barberdz/shared/types';

interface RealtimeBookingsContextValue {
  /** Noop — the hook manages its own state via React Query cache invalidation */
  salonId: string | null;
}

const RealtimeBookingsContext = createContext<RealtimeBookingsContextValue | null>(null);

interface RealtimeBookingsProviderProps {
  salonId: string | null;
  onNewBooking?: (r: Reservation) => void;
  onStatusChange?: (r: Reservation) => void;
  onCancellation?: (r: Reservation) => void;
  children: React.ReactNode;
}

/**
 * Mount this once at the root of BarberTabNavigator so the realtime channel
 * is opened once and shared by all barber screens (Dashboard, Calendar, etc.).
 */
export function RealtimeBookingsProvider({
  salonId,
  onNewBooking,
  onStatusChange,
  onCancellation,
  children,
}: RealtimeBookingsProviderProps) {
  // This hook manages the Supabase channel lifecycle. By calling it here
  // at a stable ancestor, we guarantee exactly one channel per session.
  useRealtimeBookings({ salonId, onNewBooking, onStatusChange, onCancellation });

  return (
    <RealtimeBookingsContext.Provider value={{ salonId }}>
      {children}
    </RealtimeBookingsContext.Provider>
  );
}

/**
 * Read the current salonId from the provider context.
 * Returns null if called outside a RealtimeBookingsProvider.
 */
export function useRealtimeBookingsContext(): RealtimeBookingsContextValue | null {
  return useContext(RealtimeBookingsContext);
}
