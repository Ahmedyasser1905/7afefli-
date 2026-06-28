-- 20260628180000_fix_storage_rls_policies.sql
-- Fixes broken storage RLS policies that used storage.foldername(salons.name)
-- instead of storage.foldername(name).
--
-- ROOT CAUSE:
--   Three storage policies had a typo: storage.foldername(salons.name)[1]
--   This reads the TEXT 'name' column from the salons DB table (inside the
--   EXISTS subquery) instead of the storage object's path (storage.objects.name).
--   Because salons.name is a scalar text (e.g. "Barber Palace"), not a path,
--   foldername() always returned an empty/wrong value → condition always FALSE
--   → every write operation silently blocked by RLS.
--
-- AFFECTED POLICIES (all fixed below):
--   1. salon_covers_manage_owner  — blocked all salon cover photo uploads
--   2. portfolio_delete_owner     — stale duplicate, superseded by portfolio_owner_delete
--   3. portfolios_manage_owner    — blocked writes to 'portfolios' bucket
--
-- NOTE: The salon-covers bucket, portfolio, and portfolios buckets already exist.
--   This migration only fixes/replaces the broken RLS policies.
--   The signed-URL upload pattern (used by the backend) bypasses RLS for uploads,
--   but these policies still govern any direct client-side operations.


-- ── 1. Fix salon_covers_manage_owner ─────────────────────────────────────────
-- Was: storage.foldername(salons.name)[1]  ← reads salon NAME column, always wrong
-- Now: storage.foldername(name)[1]         ← reads storage object path, correct
DROP POLICY IF EXISTS "salon_covers_manage_owner" ON storage.objects;
CREATE POLICY "salon_covers_manage_owner"
  ON storage.objects FOR ALL
  TO public
  USING (
    bucket_id = 'salon-covers'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.salons WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'salon-covers'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.salons WHERE owner_id = auth.uid()
    )
  );

-- ── 2. Drop stale portfolio_delete_owner ─────────────────────────────────────
-- This policy had the same salons.name bug and was superseded by
-- portfolio_owner_delete (added in 20260613010000) which is correct.
DROP POLICY IF EXISTS "portfolio_delete_owner" ON storage.objects;

-- ── 3. Fix portfolios_manage_owner ───────────────────────────────────────────
-- Same salons.name bug on the 'portfolios' bucket.
DROP POLICY IF EXISTS "portfolios_manage_owner" ON storage.objects;
CREATE POLICY "portfolios_manage_owner"
  ON storage.objects FOR ALL
  TO public
  USING (
    bucket_id = 'portfolios'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.salons WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'portfolios'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.salons WHERE owner_id = auth.uid()
    )
  );

