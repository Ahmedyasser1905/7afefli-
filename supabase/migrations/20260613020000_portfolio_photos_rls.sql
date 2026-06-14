-- 20260613020000_portfolio_photos_rls.sql
-- PHASE 2-C: Ensure RLS is enabled and correct on portfolio_photos.
-- Without this, any authenticated user could delete any photo by knowing the photo_id.

-- Enable RLS (idempotent)
ALTER TABLE portfolio_photos ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can view portfolio photos of approved salons
DO $$ BEGIN
  CREATE POLICY "portfolio_photos_public_read"
  ON portfolio_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM salons s
      WHERE s.id = portfolio_photos.salon_id AND s.is_approved = true
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Owner write: only the salon owner can insert/update/delete their photos
DO $$ BEGIN
  CREATE POLICY "portfolio_photos_owner_write"
  ON portfolio_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM salons s
      WHERE s.id = portfolio_photos.salon_id AND s.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM salons s
      WHERE s.id = portfolio_photos.salon_id AND s.owner_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role bypass for admin operations
DO $$ BEGIN
  CREATE POLICY "portfolio_photos_service_role_all"
  ON portfolio_photos FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
