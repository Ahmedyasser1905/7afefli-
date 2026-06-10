-- 20260610060000_lock_active_premium_subscriptions.sql
-- Prevent modification of plan, starts_at, and ends_at while a Premium subscription is Active

CREATE OR REPLACE FUNCTION public.fn_lock_active_premium_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_old_price numeric;
BEGIN
  -- Only protect Active subscriptions that have not yet expired
  IF OLD.status = 'Active' AND OLD.ends_at IS NOT NULL AND OLD.ends_at > NOW() THEN
    
    -- Check if the OLD plan was a premium plan (price > 0)
    SELECT price INTO v_old_price
    FROM plans
    WHERE id = OLD.plan;

    IF v_old_price > 0 THEN
      -- Rule 1: Cannot change the plan
      IF NEW.plan IS DISTINCT FROM OLD.plan THEN
        RAISE EXCEPTION 'Cannot change plan while a Premium subscription is still active. Please wait until it expires on %', OLD.ends_at;
      END IF;

      -- Rule 2: Cannot change starts_at or ends_at
      IF NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.ends_at IS DISTINCT FROM OLD.ends_at THEN
        RAISE EXCEPTION 'Cannot modify the start or end dates of an active Premium subscription.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trg_lock_active_premium_subscription ON user_subscriptions;

-- Create the trigger
CREATE TRIGGER trg_lock_active_premium_subscription
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION fn_lock_active_premium_subscription();
