-- Migration: Create notifications table
-- Moved from services/api/migrations/create_notifications_table.sql
-- Updated CHECK constraint to match all backend notification types

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
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
    'loyalty_points'
  )),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- General index for full list queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

-- Partial index for unread badge queries (fast unread count)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE is_read = FALSE;

-- RLS: Users can only see their own notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Users can mark own notifications as read"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add push_token column to profiles if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;
