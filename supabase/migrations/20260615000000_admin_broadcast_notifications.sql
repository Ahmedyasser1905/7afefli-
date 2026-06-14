-- Migration: Add broadcast type constraint and create broadcast_notifications table

-- 1. Drop the old notifications type check constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- 2. Re-create the constraint with 'broadcast' type
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

-- 3. Create broadcast_notifications table to log all broadcasts
CREATE TABLE IF NOT EXISTS broadcast_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB,
  sent_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Enable RLS on broadcast_notifications
ALTER TABLE broadcast_notifications ENABLE ROW LEVEL SECURITY;

-- 5. Allow read for Admins
DROP POLICY IF EXISTS "Admins can view broadcast notifications" ON broadcast_notifications;
CREATE POLICY "Admins can view broadcast notifications" 
  ON broadcast_notifications FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'Admin'
    )
  );

-- 6. Allow insert for Admins
DROP POLICY IF EXISTS "Admins can insert broadcast notifications" ON broadcast_notifications;
CREATE POLICY "Admins can insert broadcast notifications" 
  ON broadcast_notifications FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'Admin'
    )
  );
