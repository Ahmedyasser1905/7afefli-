-- Migration: Push notification performance improvements
-- Adds index on profiles.push_token for fast broadcast lookups
-- and ensures notifications.type constraint includes all types

-- 1. Index on push_token for efficient push token lookups during broadcasts
--    (partial index excludes NULL tokens to keep it small)
CREATE INDEX IF NOT EXISTS idx_profiles_push_token
  ON public.profiles(push_token)
  WHERE push_token IS NOT NULL;

-- 2. Ensure notifications type constraint includes all current types
--    (idempotent: drop + recreate to handle any prior state)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'new_booking',
  'booking_confirmed',
  'booking_cancelled',
  'booking_reminder',
  'new_review',
  'system',
  'confirmed',
  'cancelled',
  'completed',
  'subscription_expiring',
  'subscription_activated',
  'salon_approved',
  'salon_rejected',
  'loyalty_points',
  'broadcast'
));
