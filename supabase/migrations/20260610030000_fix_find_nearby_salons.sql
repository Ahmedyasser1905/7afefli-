-- Migration: Fix find_nearby_salons RPC
-- H-NEW-1: Remove dropped 'force_closed' column reference
-- M-NEW-4: Add 'commune' and 'phone' which are required for completeness validation
-- Also adds 'open_time', 'close_time', 'is_manually_closed' for full salon data
-- CRITICAL-2: Drop BOTH old signatures to ensure idempotency regardless of migration order
--   Old signature 1 (critical_fixes.sql): (double precision, double precision, double precision, integer)
--   Old signature 2 (this file v1):       (double precision, double precision, integer, integer)

DROP FUNCTION IF EXISTS public.find_nearby_salons(double precision, double precision, double precision, integer);
DROP FUNCTION IF EXISTS public.find_nearby_salons(double precision, double precision, integer, integer);

CREATE OR REPLACE FUNCTION public.find_nearby_salons(
  p_latitude   double precision,
  p_longitude  double precision,
  p_radius_m   integer DEFAULT 50000,
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
  rating               numeric,
  is_approved          boolean,
  is_sponsored         boolean,
  is_manually_closed   boolean,
  latitude             double precision,
  longitude            double precision,
  subscription_status  text,
  open_time            time without time zone,
  close_time           time without time zone,
  distance_meters      double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.description,
    s.address,
    s.wilaya,
    s.commune,
    s.phone,
    s.image_url,
    s.rating,
    s.is_approved,
    s.is_sponsored,
    s.is_manually_closed,
    s.latitude,
    s.longitude,
    s.subscription_status,
    s.open_time,
    s.close_time,
    ST_Distance(
      ST_MakePoint(s.longitude, s.latitude)::geography,
      ST_MakePoint(p_longitude, p_latitude)::geography
    ) AS distance_meters
  FROM salons s
  WHERE
    s.is_approved = true
    AND s.subscription_status != 'Expired'
    AND s.latitude  IS NOT NULL
    AND s.longitude IS NOT NULL
    AND ST_DWithin(
      ST_MakePoint(s.longitude, s.latitude)::geography,
      ST_MakePoint(p_longitude, p_latitude)::geography,
      p_radius_m
    )
  ORDER BY
    s.is_sponsored DESC,   -- sponsored salons appear first
    distance_meters ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_nearby_salons(double precision, double precision, integer, integer)
  TO service_role, authenticated, anon;
