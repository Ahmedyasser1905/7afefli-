-- ============================================================
-- SUPABASE SQL MIGRATIONS — Run these in order in SQL Editor
-- ============================================================

-- ── MIGRATION 19.1 — Auto-expire reservations functions ──────
-- Execute the full content of:
-- services/api/migrations/auto_expire_reservations_trigger.sql

-- ── MIGRATION 19.2 — Verify plans table columns ──────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'plans'
ORDER BY ordinal_position;

-- Add missing columns if needed:
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_barbers INTEGER DEFAULT 1;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_portfolio_photos INTEGER DEFAULT 3;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_reservations INTEGER DEFAULT 50;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS advanced_statistics BOOLEAN DEFAULT false;

-- Update plan limits:
UPDATE plans SET
  max_barbers = 1,
  max_portfolio_photos = 3,
  max_reservations = 50,
  advanced_statistics = false
WHERE slug = 'basic';

UPDATE plans SET
  max_barbers = 5,
  max_portfolio_photos = 20,
  max_reservations = -1,
  advanced_statistics = true
WHERE slug = 'pro';

UPDATE plans SET
  max_barbers = -1,
  max_portfolio_photos = -1,
  max_reservations = -1,
  advanced_statistics = true
WHERE slug = 'premium';

-- ── MIGRATION 19.3 — Performance indexes ─────────────────────
CREATE INDEX IF NOT EXISTS idx_reservations_salon_date_status
  ON reservations (salon_id, appointment_date, status);

CREATE INDEX IF NOT EXISTS idx_reservations_client_id
  ON reservations (client_id);

CREATE INDEX IF NOT EXISTS idx_salons_owner_id
  ON salons (owner_id);

CREATE INDEX IF NOT EXISTS idx_salon_staff_profile_id
  ON salon_staff (profile_id);

CREATE INDEX IF NOT EXISTS idx_reservations_salon_date
  ON reservations (salon_id, appointment_date);

CREATE INDEX IF NOT EXISTS idx_reservations_barber_date
  ON reservations (barber_id, appointment_date)
  WHERE barber_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_status
  ON reservations (status)
  WHERE status IN ('Pending', 'Confirmed');

-- ── MIGRATION 19.4 — Storage bucket check ────────────────────
SELECT id, name, public FROM storage.buckets WHERE name = 'portfolio';
-- If missing: create via Dashboard → Storage → New Bucket → "portfolio" (private)

-- ── Health check ─────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM plans) as plan_count,
  (SELECT COUNT(*) FROM salons) as salon_count,
  (SELECT COUNT(*) FROM reservations) as reservation_count,
  pg_size_pretty(pg_database_size(current_database())) as db_size;
