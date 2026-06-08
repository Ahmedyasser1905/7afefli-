-- Migration: Add missing performance indexes for reviews, portfolio_photos, and user_subscriptions
-- Run via Supabase SQL Editor or migration tool.

-- Salon detail page: reviews are loaded for every salon detail view
CREATE INDEX IF NOT EXISTS idx_reviews_salon_id
  ON reviews (salon_id);

-- Salon detail page: portfolio photos are loaded for every salon detail view  
CREATE INDEX IF NOT EXISTS idx_portfolio_photos_salon_id
  ON portfolio_photos (salon_id);

-- Subscription limit checks: every barber write operation joins this table
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_salon_id
  ON user_subscriptions (salon_id);

-- Pending reservations across all future dates (barber calendar pending tab)
CREATE INDEX IF NOT EXISTS idx_reservations_pending_future
  ON reservations (salon_id, appointment_date, status)
  WHERE status = 'Pending';
