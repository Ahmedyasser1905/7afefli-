-- ─────────────────────────────────────────────────────────────────────────────
-- Fix check_reservation_overlap trigger: NULL barber_id bypass
--
-- BUG: The trigger in 20260610000000_critical_fixes.sql used:
--        AND barber_id = NEW.barber_id
--      In PostgreSQL, NULL = NULL evaluates to NULL (not TRUE), so when a
--      client books "any barber" (barber_id IS NULL), the WHERE clause never
--      matches any existing row, and the overlap check always passes.
--      Two clients can simultaneously book the same salon+timeslot with no
--      specific barber and both succeed.
--
-- FIX: Replace the simple equality with an IS-NOT-DISTINCT-FROM comparison
--      so that NULL barber_id bookings are correctly detected as overlapping
--      with each other, while still isolating per-barber when one is set.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_reservation_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM reservations
    WHERE salon_id = NEW.salon_id
      -- IS NOT DISTINCT FROM treats NULL = NULL as TRUE,
      -- fixing the original AND barber_id = NEW.barber_id bug where
      -- NULL = NULL evaluates to NULL and skips the overlap check.
      AND barber_id IS NOT DISTINCT FROM NEW.barber_id
      AND status NOT IN ('Cancelled', 'Completed')
      AND appointment_date = NEW.appointment_date
      AND id != NEW.id
      AND (
        (NEW.start_time >= start_time AND NEW.start_time < end_time)
        OR (NEW.end_time > start_time AND NEW.end_time <= end_time)
        OR (NEW.start_time <= start_time AND NEW.end_time >= end_time)
      )
  ) THEN
    RAISE EXCEPTION 'Double booking detected. This time slot is already reserved.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create the trigger to pick up the updated function
DROP TRIGGER IF EXISTS trg_prevent_double_booking ON reservations;
CREATE TRIGGER trg_prevent_double_booking
BEFORE INSERT OR UPDATE ON reservations
FOR EACH ROW
EXECUTE FUNCTION check_reservation_overlap();
