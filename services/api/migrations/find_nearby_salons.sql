-- Migration: Create find_nearby_salons RPC function
-- Purpose: Find approved salons near user coordinates sorted by sponsorship status and distance.

DROP FUNCTION IF EXISTS find_nearby_salons(double precision, double precision, double precision, integer);

CREATE OR REPLACE FUNCTION find_nearby_salons(
  user_lat double precision,
  user_lng double precision,
  radius_meters double precision,
  result_limit integer
)
RETURNS TABLE (
  id UUID,
  owner_id UUID,
  name TEXT,
  description TEXT,
  wilaya TEXT,
  address TEXT,
  latitude double precision,
  longitude double precision,
  location geography(Point, 4326),
  subscription_status subscription_status,
  trial_ends_at timestamp with time zone,
  subscription_ends_at timestamp with time zone,
  is_approved boolean,
  is_sponsored boolean,
  sponsored_until timestamp with time zone,
  open_time time without time zone,
  close_time time without time zone,
  working_days integer[],
  average_rating numeric,
  total_reviews integer,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  force_closed boolean,
  is_manually_closed boolean,
  image_url TEXT,
  distance_meters double precision
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.owner_id,
    s.name,
    s.description,
    s.wilaya,
    s.address,
    s.latitude,
    s.longitude,
    s.location::geography(Point, 4326),
    s.subscription_status,
    s.trial_ends_at,
    s.subscription_ends_at,
    s.is_approved,
    s.is_sponsored,
    s.sponsored_until,
    s.open_time,
    s.close_time,
    s.working_days,
    s.average_rating,
    s.total_reviews,
    s.created_at,
    s.updated_at,
    s.force_closed,
    s.is_manually_closed,
    s.image_url,
    ST_Distance(
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326)::geography
    ) AS distance_meters
  FROM salons s
  WHERE s.is_approved = true
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326)::geography,
      radius_meters
    )
  ORDER BY s.is_sponsored DESC, distance_meters ASC
  LIMIT result_limit;
END;
$$;
