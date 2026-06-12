-- 20260613030000_add_missing_indexes.sql
-- PHASE 3-A: Add missing performance indexes.
-- These were identified in the audit as causing full table scans on frequent queries.

-- Barber dashboard: findByOwner, getSalonClients, join patterns
-- Without this index, every barber dashboard load performs a full scan on salons.
CREATE INDEX IF NOT EXISTS idx_salons_owner_id ON salons(owner_id);

-- Admin queries and RLS policies that filter by role
-- Without this, every admin operation causes a sequential scan on profiles.
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Bonus: speed up pending salon approvals in the admin panel
CREATE INDEX IF NOT EXISTS idx_salons_pending_approval
  ON salons(is_approved, created_at DESC)
  WHERE is_approved = false;
