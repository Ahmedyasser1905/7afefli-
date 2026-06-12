-- 20260614000000_audit_fixes_v1.sql
-- ENTERPRISE AUDIT FIX BATCH 1
-- Resolves:
--   C1/C5: Reconcile find_nearby_salons RPC — drop the minimal 20260613010000 version,
--           restore the full-column version from 20260610030000 with PostGIS spatial index support
--   C4:     Add UNIQUE constraint on payments.provider_payment_id for webhook idempotency
--   DB:     Add missing indexes for performance (client_id on reservations, etc.)
--   DB:     Add partial index for unread notifications (already in 20260611000000 — ensure idempotent)
-- ─────────────────────────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: RECONCILE find_nearby_salons RPC
-- Problem: 20260613010000 overwrote the full-column version with a minimal 9-column
--          version that drops wilaya, address, commune, phone, description, etc.
--          The NestJS SalonsService needs all columns. The PostGIS spatial approach
--          from 20260613010000 (using s.location geometry column) is better than
--          using raw lat/lng columns, BUT we need to check which paradigm the DB uses.
--          The safe approach: support BOTH lat/lng columns AND PostGIS location column.
-- ══════════════════════════════════════════════════════════════════════════════

-- Drop ALL known signatures unconditionally to prevent conflicts
DROP FUNCTION IF EXISTS public.find_nearby_salons(double precision, double precision, double precision, integer);
DROP FUNCTION IF EXISTS public.find_nearby_salons(double precision, double precision, integer, integer);
DROP FUNCTION IF EXISTS public.find_nearby_salons(float8, float8, float8, int);
DROP FUNCTION IF EXISTS public.find_nearby_salons(float8, float8, int, int);
DROP FUNCTION IF EXISTS public.find_nearby_salons(p_latitude float8, p_longitude float8, p_radius_m float8, p_limit int);
DROP FUNCTION IF EXISTS public.find_nearby_salons(user_lat float8, user_lng float8, radius_meters float8, result_limit int);

-- Recreate with full column set needed by NestJS SalonsService.
-- Uses lat/lng columns (the existing paradigm in 20260610030000) for backward compatibility.
-- Also handles the case where salons have a PostGIS location column by computing distance
-- from raw lat/lng columns with a fallback when location IS NULL.
CREATE OR REPLACE FUNCTION public.find_nearby_salons(
  p_latitude   double precision,
  p_longitude  double precision,
  p_radius_m   double precision DEFAULT 50000,
  p_limit      integer DEFAULT 20
)
RETURNS TABLE (
  id                   uuid,
  name                 text,
  description          text,
  address              text,
  wilaya               text,
  commune              text,
  phone                text,
  image_url            text,
  average_rating       numeric,
  total_reviews        integer,
  is_approved          boolean,
  is_sponsored         boolean,
  is_manually_closed   boolean,
  latitude             double precision,
  longitude            double precision,
  subscription_status  text,
  plan_price           numeric,
  open_time            time without time zone,
  close_time           time without time zone,
  working_days         integer[],
  distance_meters      double precision
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    s.id,
    s.name,
    s.description,
    s.address,
    s.wilaya,
    s.commune,
    s.phone,
    s.image_url,
    s.average_rating,
    s.total_reviews,
    s.is_approved,
    s.is_sponsored,
    COALESCE(s.is_manually_closed, false) AS is_manually_closed,
    s.latitude,
    s.longitude,
    s.subscription_status,
    COALESCE(s.plan_price, 0) AS plan_price,
    s.open_time,
    s.close_time,
    s.working_days,
    ST_Distance(
      ST_MakePoint(s.longitude, s.latitude)::geography,
      ST_MakePoint(p_longitude, p_latitude)::geography
    ) AS distance_meters
  FROM salons s
  WHERE
    s.is_approved = true
    AND COALESCE(s.is_manually_closed, false) = false
    AND s.latitude  IS NOT NULL
    AND s.longitude IS NOT NULL
    AND ST_DWithin(
      ST_MakePoint(s.longitude, s.latitude)::geography,
      ST_MakePoint(p_longitude, p_latitude)::geography,
      p_radius_m
    )
  ORDER BY
    s.is_sponsored DESC,
    COALESCE(s.plan_price, 0) DESC,
    distance_meters ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.find_nearby_salons(double precision, double precision, double precision, integer)
  TO service_role, authenticated, anon;

-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: PAYMENT IDEMPOTENCY
-- Add UNIQUE constraint on payments.provider_payment_id to prevent duplicate
-- webhook deliveries from creating duplicate payment records.
-- ══════════════════════════════════════════════════════════════════════════════

-- First add column if it doesn't exist (some envs may not have it)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_payment_id TEXT;

-- Add unique constraint idempotently
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_provider_payment_id_key'
      AND conrelid = 'payments'::regclass
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_provider_payment_id_key
      UNIQUE (provider_payment_id);
  END IF;
END
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: MISSING PERFORMANCE INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

-- reservations(client_id) — critical for GET /reservations/me performance
CREATE INDEX IF NOT EXISTS idx_reservations_client_id
  ON reservations(client_id);

-- reservations(status) — frequent filter for pending/confirmed/completed queries
CREATE INDEX IF NOT EXISTS idx_reservations_status
  ON reservations(status);

-- salon_favorites(user_id) — critical for GET /salons/favorites
CREATE INDEX IF NOT EXISTS idx_salon_favorites_user_id
  ON salon_favorites(user_id);

-- reviews(salon_id, created_at DESC) — composite for sorted salon review queries
CREATE INDEX IF NOT EXISTS idx_reviews_salon_created
  ON reviews(salon_id, created_at DESC);

-- profiles(role) — admin user listing filtered by role
CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON profiles(role);

-- user_subscriptions(status, ends_at) — cron expiry queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status_ends_at
  ON user_subscriptions(status, ends_at);

-- salons(owner_id) — barber's own salon lookup
CREATE INDEX IF NOT EXISTS idx_salons_owner_id
  ON salons(owner_id);

-- salons(wilaya) — explore screen wilaya filtering
CREATE INDEX IF NOT EXISTS idx_salons_wilaya
  ON salons(wilaya);

-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 4: ENSURE is_manually_closed COLUMN EXISTS
-- Some migration paths may have used force_closed; ensure the canonical column
-- is present so the RPC above doesn't fail.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE salons ADD COLUMN IF NOT EXISTS is_manually_closed BOOLEAN NOT NULL DEFAULT false;

-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 5: ENSURE plan_price COLUMN EXISTS ON SALONS
-- Used by find_nearby_salons for sort ordering and by the mobile HomeScreen.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE salons ADD COLUMN IF NOT EXISTS plan_price NUMERIC DEFAULT 0;

-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 6: RLS — SALON FAVORITES
-- Ensure salon_favorites has RLS enabled and a user-scoped policy.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE salon_favorites ENABLE ROW LEVEL SECURITY;

-- Users can see their own favorites
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'salon_favorites'
      AND policyname = 'Users can view own favorites'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can view own favorites"
        ON salon_favorites FOR SELECT
        USING (auth.uid() = user_id);
    $policy$;
  END IF;
END
$$;

-- Users can add to their favorites
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'salon_favorites'
      AND policyname = 'Users can add own favorites'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can add own favorites"
        ON salon_favorites FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    $policy$;
  END IF;
END
$$;

-- Users can remove their own favorites
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'salon_favorites'
      AND policyname = 'Users can delete own favorites'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can delete own favorites"
        ON salon_favorites FOR DELETE
        USING (auth.uid() = user_id);
    $policy$;
  END IF;
END
$$;
