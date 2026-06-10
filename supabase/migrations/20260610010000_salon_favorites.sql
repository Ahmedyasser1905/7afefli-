-- =============================================================================
-- MIGRATION: Salon Favorites feature (M3 from audit)
-- Creates salon_favorites table with RLS policies
-- =============================================================================

-- Create salon_favorites table
CREATE TABLE IF NOT EXISTS public.salon_favorites (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  salon_id   UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, salon_id)
);

-- Enable RLS
ALTER TABLE public.salon_favorites ENABLE ROW LEVEL SECURITY;

-- Users can view their own favorites
DROP POLICY IF EXISTS "Users can view their own favorites" ON public.salon_favorites;
CREATE POLICY "Users can view their own favorites"
ON public.salon_favorites FOR SELECT
USING (auth.uid() = user_id);

-- Users can add their own favorites
DROP POLICY IF EXISTS "Users can add favorites" ON public.salon_favorites;
CREATE POLICY "Users can add favorites"
ON public.salon_favorites FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own favorites
DROP POLICY IF EXISTS "Users can delete their own favorites" ON public.salon_favorites;
CREATE POLICY "Users can delete their own favorites"
ON public.salon_favorites FOR DELETE
USING (auth.uid() = user_id);

-- Performance index
CREATE INDEX IF NOT EXISTS idx_salon_favorites_user_id ON public.salon_favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_salon_favorites_salon_id ON public.salon_favorites (salon_id);

-- Grant access to service_role and authenticated
GRANT ALL ON public.salon_favorites TO service_role;
GRANT SELECT, INSERT, DELETE ON public.salon_favorites TO authenticated;
