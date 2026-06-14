-- 20260614010000_audit_fixes_v2.sql
-- Enterprise Audit Fix Batch 2
-- Resolves:
--   RPC: Fix poorly defined get_salon_features (was limiting to 1 arbitrarily instead of newest/active)
--   DB: Add updated_at trigger for client_subscriptions
--   DB: Emit notification on increment_loyalty_points trigger

-- 1. Fix get_salon_features RPC
CREATE OR REPLACE FUNCTION public.get_salon_features(p_salon_id uuid)
RETURNS TABLE(feature_key text, display_name text, feature_type text, value text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan_id uuid;
    v_status text;
BEGIN
    -- Get current subscription plan
    SELECT plan, status INTO v_plan_id, v_status
    FROM public.user_subscriptions
    WHERE salon_id = p_salon_id
    ORDER BY 
      CASE status 
        WHEN 'Active' THEN 1
        WHEN 'Trial' THEN 2
        ELSE 3
      END ASC, 
      created_at DESC
    LIMIT 1;

    -- If no subscription found or status is Expired, default to 'Basic' plan
    IF v_plan_id IS NULL OR v_status = 'Expired' THEN
        SELECT id INTO v_plan_id FROM public.plans WHERE slug = 'basic' LIMIT 1;
    END IF;

    RETURN QUERY
    SELECT 
        sf.feature_key::text,
        sf.display_name::text,
        sf.feature_type::text,
        COALESCE(pf.value, 'false')::text
    FROM public.subscription_features sf
    LEFT JOIN public.plan_features pf ON pf.feature_id = sf.id AND pf.plan_id = v_plan_id;
END;
$$;

-- 2. Add updated_at and trigger to client_subscriptions
ALTER TABLE public.client_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_client_subscriptions_updated_at ON public.client_subscriptions;
CREATE TRIGGER set_client_subscriptions_updated_at
BEFORE UPDATE ON public.client_subscriptions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 3. Emit notification on loyalty points increment
CREATE OR REPLACE FUNCTION increment_loyalty_points()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'Completed' AND OLD.status != 'Completed'
     AND (NEW.is_walk_in IS NULL OR NEW.is_walk_in = false)
  THEN
    UPDATE profiles SET loyalty_points = loyalty_points + 10 WHERE id = NEW.client_id;
    
    -- Insert a notification for the client
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.client_id, 
      'loyalty_points', 
      'Points de fidélité gagnés !', 
      'Vous avez gagné 10 points de fidélité suite à votre rendez-vous.',
      jsonb_build_object('reservation_id', NEW.id, 'points', 10)
    );
  END IF;
  RETURN NEW;
END;
$$;
