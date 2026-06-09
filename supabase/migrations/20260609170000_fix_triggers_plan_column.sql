-- Fix database triggers and functions to reference the new 'plan' column (UUID) in user_subscriptions

CREATE OR REPLACE FUNCTION public.auto_create_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_basic_plan_id uuid;
BEGIN
    SELECT id INTO v_basic_plan_id FROM public.plans WHERE slug = 'basic' LIMIT 1;
    
    INSERT INTO public.user_subscriptions (salon_id, plan, status, starts_at, trial_ends_at)
    VALUES (NEW.id, v_basic_plan_id, 'Trial', now(), NEW.trial_ends_at)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_salon_features(p_salon_id uuid)
 RETURNS TABLE(feature_key text, display_name text, feature_type text, value text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_plan_id uuid;
    v_status text;
BEGIN
    -- Get current subscription plan (using the new column name "plan")
    SELECT plan, status INTO v_plan_id, v_status
    FROM public.user_subscriptions
    WHERE salon_id = p_salon_id
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
$function$;
