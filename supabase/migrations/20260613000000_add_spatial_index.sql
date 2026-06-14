-- supabase/migrations/20260613000000_add_spatial_index.sql
-- Add GiST spatial index so find_nearby_salons uses index scan instead of sequential scan
-- Without this, every nearby query does a full table scan → Vercel timeout at scale
-- Note: using CAST() instead of :: cast operator for broader SQL compatibility
CREATE INDEX IF NOT EXISTS idx_salons_geography
  ON salons
  USING GIST (CAST(ST_MakePoint(longitude, latitude) AS geography));

-- Also index for standard lat/lng range queries (fallback path)
CREATE INDEX IF NOT EXISTS idx_salons_lat_lng
  ON salons (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
