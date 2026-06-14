-- 20260613040000_drop_stale_force_closed_column.sql
-- PHASE 3-B: Drop the stale force_closed column from salons table.
-- This column was referenced in an older version of find_nearby_salons
-- but was never part of the current schema. Drops cleanly if it doesn't exist.

ALTER TABLE salons DROP COLUMN IF EXISTS force_closed;
