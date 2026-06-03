-- Migration: Add performance indexes for reservations, salons, and staff
-- Run this against your Supabase database via SQL Editor or migration tool.
-- These indexes cover the most frequent query patterns in the application.

-- Composite index for salon reservation dashboard queries:
-- GET /reservations/salon/:salonId filtered by date and status
CREATE INDEX IF NOT EXISTS idx_reservations_salon_date_status
  ON reservations (salon_id, appointment_date, status);

-- Index for client reservation history:
-- GET /reservations/me
CREATE INDEX IF NOT EXISTS idx_reservations_client_id
  ON reservations (client_id);

-- Index for looking up salons by owner (used in findByOwner + auth checks):
CREATE INDEX IF NOT EXISTS idx_salons_owner_id
  ON salons (owner_id);

-- Index for staff membership lookups (used in authorization checks):
CREATE INDEX IF NOT EXISTS idx_salon_staff_profile_id
  ON salon_staff (profile_id);

-- Composite index for slot availability queries (salon + date):
CREATE INDEX IF NOT EXISTS idx_reservations_salon_date
  ON reservations (salon_id, appointment_date);

-- Optional: index for barber-specific slot queries:
CREATE INDEX IF NOT EXISTS idx_reservations_barber_date
  ON reservations (barber_id, appointment_date)
  WHERE barber_id IS NOT NULL;
