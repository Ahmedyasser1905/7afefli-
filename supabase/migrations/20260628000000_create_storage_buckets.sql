-- 20260628000000_create_storage_buckets.sql
-- Creates the salon-covers and avatars storage buckets that were referenced in
-- application code but never created via migrations.
-- Also formalizes the portfolio bucket (L2) which was only implied by RLS policies.
--
-- All inserts are idempotent (ON CONFLICT DO NOTHING) so this migration is safe
-- to apply on environments where buckets were already created manually.

-- ── 1. portfolio bucket (LOW L2 — formalize existing implied bucket) ──────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portfolio',
  'portfolio',
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. salon-covers bucket (CRITICAL C1) ──────────────────────────────────────
-- Public CDN bucket for salon cover photos.
-- Max 5 MB, JPEG/PNG/WebP/HEIC allowed.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'salon-covers',
  'salon-covers',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Public read — anyone can view salon cover photos
CREATE POLICY "salon_covers_public_read"
  ON storage.objects FOR SELECT USING (bucket_id = 'salon-covers');

-- RLS: Owner insert — first path segment must be a salon owned by the uploader
CREATE POLICY "salon_covers_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'salon-covers'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.salons WHERE owner_id = auth.uid()
    )
  );

-- RLS: Service role bypass — allows the backend (service role) to issue signed URLs
CREATE POLICY "salon_covers_service_role"
  ON storage.objects FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── 3. avatars bucket (CRITICAL C2) ───────────────────────────────────────────
-- Public CDN bucket for user profile avatar photos.
-- Max 2 MB, JPEG/PNG/WebP allowed (no HEIC — compressed before upload).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Public read — anyone can view avatar photos
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- RLS: User can only write their own avatar (first path segment = their user ID)
CREATE POLICY "avatars_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: User can update their own avatar
CREATE POLICY "avatars_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: Service role bypass
CREATE POLICY "avatars_service_role"
  ON storage.objects FOR ALL TO service_role
  USING (true) WITH CHECK (true);
