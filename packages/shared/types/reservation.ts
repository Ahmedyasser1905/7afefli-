// packages/shared/types/reservation.ts

export type ReservationStatus = 'Pending' | 'Confirmed' | 'Cancelled' | 'Completed';

export interface Reservation {
  id: string;
  client_id: string;
  salon_id: string;
  service_id: string;
  barber_id: string | null;
  appointment_date: string;  // "2025-07-15"
  start_time: string;        // "09:00"
  end_time: string;          // "09:30"
  status: ReservationStatus;
  notes: string | null;
  client_phone: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields (optional)
  profiles?: { full_name: string; avatar_url: string | null };
  salons?: { name: string; address: string; wilaya: string };
  services?: { service_name: string; price: number; duration_minutes: number };
}

export interface TimeSlot {
  startTime: string;   // "09:00"
  endTime: string;     // "09:30"
  isAvailable: boolean;
}

export interface LoyaltyTransaction {
  id: string;
  client_id: string;
  reservation_id: string | null;
  points_delta: number;
  reason: string | null;
  created_at: string;
}
