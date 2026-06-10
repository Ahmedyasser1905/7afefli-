-- 20260610080000_sort_salons_by_plan_tier.sql
-- Add plan_price to salons for easy sorting by subscription tier (Premium > Pro > Free)

ALTER TABLE salons ADD COLUMN IF NOT EXISTS plan_price integer DEFAULT 0;

-- Update the sync function to also sync plan_price
CREATE OR REPLACE FUNCTION public.sync_all_subscription_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_free_plan_id uuid;
BEGIN
  -- 1. Find the Free Plan ID
  SELECT id INTO v_free_plan_id
  FROM plans
  WHERE price = 0 AND is_active = true
  ORDER BY sort_order ASC
  LIMIT 1;

  IF v_free_plan_id IS NOT NULL THEN
    -- 2. Downgrade expired Trial or Active subscriptions to Free Plan
    UPDATE user_subscriptions
    SET status = 'Active',
        plan = v_free_plan_id,
        ends_at = NULL,
        trial_ends_at = NULL
    WHERE status IN ('Active', 'Trial')
      AND (
        (ends_at IS NOT NULL AND ends_at < NOW()) OR
        (trial_ends_at IS NOT NULL AND trial_ends_at < NOW())
      );
      
    -- Also fix any currently 'Expired' subscriptions and restore them to Free Plan
    UPDATE user_subscriptions
    SET status = 'Active',
        plan = v_free_plan_id,
        ends_at = NULL,
        trial_ends_at = NULL
    WHERE status = 'Expired';
  END IF;

  -- 3. Sync salons table status and Premium Plan features
  UPDATE salons s
  SET 
    subscription_status = us.status,
    is_sponsored = COALESCE(p.sponsored_listing, false),
    is_featured = COALESCE(p.featured_listing, false),
    has_premium_badge = COALESCE(p.premium_badge, false),
    marketing_included = COALESCE(p.marketing_included, false),
    priority_support = COALESCE(p.priority_support, false),
    plan_price = COALESCE(p.price, 0)
  FROM user_subscriptions us
  JOIN plans p ON us.plan = p.id
  WHERE us.salon_id = s.id
    AND (
      s.subscription_status IS DISTINCT FROM us.status OR
      s.is_sponsored IS DISTINCT FROM p.sponsored_listing OR
      s.is_featured IS DISTINCT FROM p.featured_listing OR
      s.has_premium_badge IS DISTINCT FROM p.premium_badge OR
      s.marketing_included IS DISTINCT FROM p.marketing_included OR
      s.priority_support IS DISTINCT FROM p.priority_support OR
      s.plan_price IS DISTINCT FROM p.price
    );
END;
$function$;

-- Drop and recreate the nearby search RPC to include plan_price and sort by it
DROP FUNCTION IF EXISTS public.find_nearby_salons(double precision, double precision, integer, integer);

CREATE OR REPLACE FUNCTION public.find_nearby_salons(
  p_latitude double precision, 
  p_longitude double precision, 
  p_radius_m integer DEFAULT 50000, 
  p_limit integer DEFAULT 20
)
 RETURNS TABLE(
   id uuid, 
   name text, 
   description text, 
   address text, 
   wilaya text, 
   commune text, 
   phone text, 
   image_url text, 
   rating numeric, 
   is_approved boolean, 
   is_sponsored boolean, 
   is_manually_closed boolean, 
   latitude double precision, 
   longitude double precision, 
   subscription_status text, 
   open_time time without time zone, 
   close_time time without time zone, 
   plan_price integer,
   distance_meters double precision
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
    s.subscription_status::text,
    s.open_time,
    s.close_time,
    s.plan_price,
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
    s.plan_price DESC,
    distance_meters ASC
  LIMIT p_limit;
END;
$function$;
