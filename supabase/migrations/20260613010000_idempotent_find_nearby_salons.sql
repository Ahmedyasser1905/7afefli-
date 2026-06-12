-- 20260613010000_idempotent_find_nearby_salons.sql
-- PHASE 1-A: Drop both possible old signatures unconditionally, then recreate
-- with canonical param names that match NestJS SalonsService.
-- This resolves the conflict between 20260610000000 and 20260610030000.

DROP FUNCTION IF EXISTS find_nearby_salons(float8, float8, float8, int);
DROP FUNCTION IF EXISTS find_nearby_salons(float8, float8, int, int);
DROP FUNCTION IF EXISTS find_nearby_salons(user_lat float8, user_lng float8, radius_meters float8, result_limit int);
DROP FUNCTION IF EXISTS find_nearby_salons(p_latitude float8, p_longitude float8, p_radius_m float8, p_limit int);

-- Recreate with canonical param names that match NestJS SalonsService
CREATE OR REPLACE FUNCTION find_nearby_salons(
  p_latitude   float8,
  p_longitude  float8,
  p_radius_m   float8 DEFAULT 50000,
  p_limit      int    DEFAULT 20
)
RETURNS TABLE (
  id               uuid,
  name             text,
  average_rating   float8,
  distance_meters  float8,
  is_open          boolean,
  is_sponsored     boolean,
  plan_price       numeric,
  latitude         float8,
  longitude        float8
)
LANGUAGE sql STABLE AS $$
  SELECT
    s.id,
    s.name,
    s.average_rating,
    ST_Distance(
      s.location::geography,
      ST_MakePoint(p_longitude, p_latitude)::geography
    ) AS distance_meters,
    s.is_open,
    s.is_sponsored,
    s.plan_price,
    ST_Y(s.location::geometry) AS latitude,
    ST_X(s.location::geometry) AS longitude
  FROM salons s
  WHERE
    s.is_approved = true
    AND s.is_manually_closed = false
    AND s.location IS NOT NULL
    AND ST_DWithin(
      s.location::geography,
      ST_MakePoint(p_longitude, p_latitude)::geography,
      p_radius_m
    )
  ORDER BY s.is_sponsored DESC, s.plan_price DESC, distance_meters ASC
  LIMIT p_limit;
$$;
