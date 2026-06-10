-- 20260610070000_sync_premium_features_to_salons.sql
-- Add premium features to salons and sync them from active plans

-- 1. Add missing feature columns to salons table
ALTER TABLE salons ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS has_premium_badge boolean DEFAULT false;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS marketing_included boolean DEFAULT false;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS priority_support boolean DEFAULT false;

-- 2. Update the sync function to also sync the plan features
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
    priority_support = COALESCE(p.priority_support, false)
  FROM user_subscriptions us
  JOIN plans p ON us.plan = p.id
  WHERE us.salon_id = s.id
    AND (
      s.subscription_status IS DISTINCT FROM us.status OR
      s.is_sponsored IS DISTINCT FROM p.sponsored_listing OR
      s.is_featured IS DISTINCT FROM p.featured_listing OR
      s.has_premium_badge IS DISTINCT FROM p.premium_badge OR
      s.marketing_included IS DISTINCT FROM p.marketing_included OR
      s.priority_support IS DISTINCT FROM p.priority_support
    );
END;
$function$;
