-- H3 Fix: create_reservation_safe — double-booking when both staff_id and barber_id are NULL
-- When a client books "any barber" (no specific staff selection), both p_staff_id and p_barber_id
-- are NULL. The original overlap check required at least one to be non-null, meaning the entire
-- salon-wide overlap block was skipped → two clients could book the same time slot simultaneously.
--
-- Fix: add a third branch that fires when BOTH are NULL, checking for ANY overlap at that
-- salon+date+time regardless of which barber is assigned (salon-wide slot conflict).

DROP FUNCTION IF EXISTS public.create_reservation_safe(uuid, uuid, uuid, uuid, uuid, date, time without time zone, time without time zone, text, text);
DROP FUNCTION IF EXISTS public.create_reservation_safe(uuid, uuid, uuid, uuid, uuid, date, time without time zone, time without time zone, text, text, boolean);

CREATE OR REPLACE FUNCTION public.create_reservation_safe(
  p_client_id         uuid,
  p_salon_id          uuid,
  p_service_id        uuid,
  p_barber_id         uuid,
  p_staff_id          uuid,
  p_appointment_date  date,
  p_start_time        time without time zone,
  p_end_time          time without time zone,
  p_notes             text    DEFAULT NULL,
  p_client_phone      text    DEFAULT NULL,
  p_is_walk_in        boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_overlap              boolean;
  v_reservation          reservations%ROWTYPE;
  v_is_manually_closed   boolean;
BEGIN
  -- 1. Check salon is not manually closed
  SELECT is_manually_closed INTO v_is_manually_closed
  FROM salons WHERE id = p_salon_id;

  IF v_is_manually_closed = true THEN
    RAISE EXCEPTION 'Salon is temporarily closed.';
  END IF;

  -- 2. Advisory lock prevents concurrent bookings for the same salon
  PERFORM pg_advisory_xact_lock(hashtext(p_salon_id::text));

  -- 3. Overlap check
  --    Branch A: specific staff or barber selected → check only their schedule
  --    Branch B: no staff/barber selected (any-barber booking) → check ALL staff for that slot
  --              to prevent two "any-barber" bookings landing on the same physical time window
  IF p_staff_id IS NOT NULL OR p_barber_id IS NOT NULL THEN
    -- Branch A: targeted barber/staff slot
    SELECT EXISTS (
      SELECT 1 FROM reservations
      WHERE salon_id         = p_salon_id
        AND appointment_date = p_appointment_date
        AND status           IN ('Pending', 'Confirmed')
        AND start_time       < p_end_time
        AND end_time         > p_start_time
        AND (
          (p_staff_id  IS NOT NULL AND staff_id  = p_staff_id)
          OR
          (p_barber_id IS NOT NULL AND barber_id = p_barber_id)
        )
    ) INTO v_overlap;
  ELSE
    -- Branch B: any-barber booking — check if the salon has ANY free slot in this window.
    -- We count how many staff exist and how many slots are already filled.
    -- If all staff are booked for this window, reject.
    DECLARE
      v_staff_count    integer;
      v_booked_count   integer;
    BEGIN
      SELECT COUNT(*) INTO v_staff_count
      FROM salon_staff WHERE salon_id = p_salon_id;

      SELECT COUNT(*) INTO v_booked_count
      FROM reservations
      WHERE salon_id         = p_salon_id
        AND appointment_date = p_appointment_date
        AND status           IN ('Pending', 'Confirmed')
        AND start_time       < p_end_time
        AND end_time         > p_start_time;

      -- If no staff defined, treat as 1 slot available
      IF v_staff_count = 0 THEN v_staff_count := 1; END IF;
      v_overlap := (v_booked_count >= v_staff_count);
    END;
  END IF;

  IF v_overlap THEN
    RAISE EXCEPTION 'Time slot is already booked.';
  END IF;

  -- 4. Insert the reservation
  INSERT INTO reservations (
    client_id, salon_id, service_id, barber_id, staff_id,
    appointment_date, start_time, end_time, status,
    notes, client_phone, is_walk_in
  ) VALUES (
    p_client_id, p_salon_id, p_service_id, p_barber_id, p_staff_id,
    p_appointment_date, p_start_time, p_end_time, 'Pending',
    p_notes, p_client_phone, p_is_walk_in
  ) RETURNING * INTO v_reservation;

  RETURN row_to_json(v_reservation);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_reservation_safe(uuid, uuid, uuid, uuid, uuid, date, time without time zone, time without time zone, text, text, boolean)
  TO service_role, authenticated;
