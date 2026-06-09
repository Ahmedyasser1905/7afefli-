-- Fix trigger to allow service_role to bypass salon escalation check (so backend NestJS can approve/reject salons)
CREATE OR REPLACE FUNCTION public.prevent_salon_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Allow SECURITY DEFINER functions or service_role client to bypass
  IF current_setting('role', true) = 'rls_definer' OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  
  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved AND (NOT is_admin()) THEN
    NEW.is_approved = OLD.is_approved;
  END IF;
  IF NEW.is_sponsored IS DISTINCT FROM OLD.is_sponsored AND (NOT is_admin()) THEN
    NEW.is_sponsored = OLD.is_sponsored;
  END IF;
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status AND (NOT is_admin()) THEN
    NEW.subscription_status = OLD.subscription_status;
  END IF;
  RETURN NEW;
END;
$function$;
