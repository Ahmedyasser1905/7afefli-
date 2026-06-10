-- 20260610050000_subscription_fallback_to_free.sql
-- Downgrade expired subscriptions to the Free Plan instead of Expired state

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

  -- 3. Sync salons table status
  UPDATE salons s
  SET subscription_status = us.status
  FROM user_subscriptions us
  WHERE us.salon_id = s.id
    AND s.subscription_status IS DISTINCT FROM us.status;
END;
$function$;
