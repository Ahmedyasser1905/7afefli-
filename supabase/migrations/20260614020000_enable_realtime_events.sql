-- Migration: Enable Realtime for notifications and reservations
-- Fixes issue where the mobile app doesn't receive live websocket updates

BEGIN;

-- Enable Realtime for the notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Enable Realtime for the reservations table (for Barber Calendar auto-refresh)
ALTER PUBLICATION supabase_realtime ADD TABLE reservations;

COMMIT;
