-- 20260610040000_auto_cancel_pending_reservations.sql
-- Automatically cancel other pending reservations when one is confirmed

CREATE OR REPLACE FUNCTION public.fn_auto_cancel_pending_reservations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- If the status changed to Confirmed
  IF NEW.status = 'Confirmed' AND OLD.status = 'Pending' THEN
    -- Cancel all other pending reservations for the same client
    UPDATE reservations
    SET status = 'Cancelled',
        cancel_reason = 'Annulation automatique (une autre réservation a été confirmée)'
    WHERE client_id = NEW.client_id
      AND id != NEW.id
      AND status = 'Pending';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Drop trigger if exists to allow safe re-runs
DROP TRIGGER IF EXISTS trg_auto_cancel_pending ON reservations;

CREATE TRIGGER trg_auto_cancel_pending
  AFTER UPDATE OF status
  ON reservations
  FOR EACH ROW
  WHEN (NEW.status = 'Confirmed' AND OLD.status = 'Pending')
  EXECUTE FUNCTION fn_auto_cancel_pending_reservations();
