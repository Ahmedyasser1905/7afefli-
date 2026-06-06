-- Migration: Auto-expire reservations via PostgreSQL functions
-- This replaces the 4-6 sequential UPDATE calls in findBySalon() and findByClient()
-- that were executed on every GET request, causing ~150-300ms added latency.

-- Function: expire a single reservation if its time has passed
CREATE OR REPLACE FUNCTION expire_reservation(p_reservation_id UUID)
RETURNS void AS $$
DECLARE
  v_now_algeria TIMESTAMPTZ := NOW() AT TIME ZONE 'Africa/Algiers';
  v_today DATE := (v_now_algeria)::DATE;
  v_now_time TIME := (v_now_algeria)::TIME;
  v_status TEXT;
  v_appt_date DATE;
  v_end_time TIME;
  v_notes TEXT;
BEGIN
  SELECT status, appointment_date, end_time::TIME, notes
  INTO v_status, v_appt_date, v_end_time, v_notes
  FROM reservations
  WHERE id = p_reservation_id;

  -- Skip blocked slots
  IF v_notes ILIKE '%NEAU BLOQU%' THEN RETURN; END IF;

  IF v_status = 'Pending' THEN
    IF v_appt_date < v_today OR (v_appt_date = v_today AND v_end_time < v_now_time) THEN
      UPDATE reservations SET status = 'Cancelled' WHERE id = p_reservation_id;
    END IF;
  ELSIF v_status = 'Confirmed' THEN
    IF v_appt_date < v_today OR (v_appt_date = v_today AND v_end_time < v_now_time) THEN
      UPDATE reservations SET status = 'Completed' WHERE id = p_reservation_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: batch expire all reservations for a salon (called by cron)
CREATE OR REPLACE FUNCTION expire_salon_reservations(p_salon_id UUID)
RETURNS void AS $$
DECLARE
  v_now_algeria TIMESTAMPTZ := NOW() AT TIME ZONE 'Africa/Algiers';
  v_today DATE := (v_now_algeria)::DATE;
  v_now_time TIME := (v_now_algeria)::TIME;
BEGIN
  -- Pending past → Cancelled
  UPDATE reservations
  SET status = 'Cancelled'
  WHERE salon_id = p_salon_id
    AND status = 'Pending'
    AND notes NOT ILIKE '%NEAU BLOQU%'
    AND (
      appointment_date < v_today
      OR (appointment_date = v_today AND end_time::TIME < v_now_time)
    );

  -- Confirmed past → Completed
  UPDATE reservations
  SET status = 'Completed'
  WHERE salon_id = p_salon_id
    AND status = 'Confirmed'
    AND notes NOT ILIKE '%NEAU BLOQU%'
    AND (
      appointment_date < v_today
      OR (appointment_date = v_today AND end_time::TIME < v_now_time)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: batch expire for a specific client
CREATE OR REPLACE FUNCTION expire_client_reservations(p_client_id UUID)
RETURNS void AS $$
DECLARE
  v_now_algeria TIMESTAMPTZ := NOW() AT TIME ZONE 'Africa/Algiers';
  v_today DATE := (v_now_algeria)::DATE;
  v_now_time TIME := (v_now_algeria)::TIME;
BEGIN
  UPDATE reservations
  SET status = 'Cancelled'
  WHERE client_id = p_client_id
    AND status = 'Pending'
    AND notes NOT ILIKE '%NEAU BLOQU%'
    AND (appointment_date < v_today OR (appointment_date = v_today AND end_time::TIME < v_now_time));

  UPDATE reservations
  SET status = 'Completed'
  WHERE client_id = p_client_id
    AND status = 'Confirmed'
    AND notes NOT ILIKE '%NEAU BLOQU%'
    AND (appointment_date < v_today OR (appointment_date = v_today AND end_time::TIME < v_now_time));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to service role
GRANT EXECUTE ON FUNCTION expire_salon_reservations(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION expire_client_reservations(UUID) TO service_role;
