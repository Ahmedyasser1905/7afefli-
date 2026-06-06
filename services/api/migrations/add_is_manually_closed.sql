-- Migration: Add is_manually_closed to salons and update create_reservation_safe RPC & check_reservation_overlap trigger

-- Add column
ALTER TABLE salons
ADD COLUMN IF NOT EXISTS is_manually_closed BOOLEAN DEFAULT FALSE;

-- Create index for faster lookup if useful
CREATE INDEX IF NOT EXISTS idx_salons_is_manually_closed ON salons(id, is_manually_closed);

-- Update create_reservation_safe function to check is_manually_closed
CREATE OR REPLACE FUNCTION public.create_reservation_safe(
  p_client_id uuid,
  p_salon_id uuid,
  p_service_id uuid,
  p_barber_id uuid,
  p_appointment_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_notes text,
  p_client_phone text,
  p_staff_id uuid DEFAULT NULL::uuid
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_overlap boolean;
  v_reservation reservations%ROWTYPE;
  v_is_manually_closed boolean;
BEGIN
  -- Check if salon is manually closed
  SELECT is_manually_closed INTO v_is_manually_closed
  FROM salons
  WHERE id = p_salon_id;

  IF v_is_manually_closed = true THEN
    RAISE EXCEPTION 'Salon is temporarily closed.';
  END IF;

  -- Lock the salon to serialize booking requests for this salon
  PERFORM pg_advisory_xact_lock(hashtext(p_salon_id::text));
  
  -- Check for overlaps
  SELECT EXISTS (
    SELECT 1 FROM reservations
    WHERE salon_id = p_salon_id
      AND appointment_date = p_appointment_date
      AND status IN ('Pending', 'Confirmed')
      AND start_time < p_end_time
      AND end_time > p_start_time
      AND (
        -- Overlap if specific staff is booked
        (p_staff_id IS NOT NULL AND staff_id = p_staff_id)
        OR
        -- Overlap if specific barber profile is booked
        (p_barber_id IS NOT NULL AND barber_id = p_barber_id)
      )
  ) INTO v_overlap;
  
  IF v_overlap THEN
    RAISE EXCEPTION 'Time slot is already booked.';
  END IF;
  
  -- Insert the reservation
  INSERT INTO reservations (
    client_id, salon_id, service_id, barber_id, staff_id,
    appointment_date, start_time, end_time, status, notes, client_phone
  ) VALUES (
    p_client_id, p_salon_id, p_service_id, p_barber_id, p_staff_id,
    p_appointment_date, p_start_time, p_end_time, 'Pending', p_notes, p_client_phone
  ) RETURNING * INTO v_reservation;
  
  RETURN row_to_json(v_reservation);
END;
$function$;

-- Update check_reservation_overlap trigger function to check is_manually_closed
CREATE OR REPLACE FUNCTION public.check_reservation_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  conflict_count INTEGER;
  is_block       BOOLEAN;
BEGIN
  -- Skip overlap check if reservation is being cancelled
  IF NEW.status = 'Cancelled' THEN
    RETURN NEW;
  END IF;

  -- Check if the salon is manually closed
  IF EXISTS (
    SELECT 1 FROM public.salons
    WHERE id = NEW.salon_id AND is_manually_closed = true
  ) THEN
    RAISE EXCEPTION 'booking_conflict: Ce salon est temporairement fermé.' USING ERRCODE = 'P0001';
  END IF;

  -- Detect if the new record is a barber-initiated block
  is_block := (NEW.notes IS NOT NULL AND NEW.notes ILIKE '%NEAU BLOQU%');

  IF is_block THEN
    -- For blocks: only conflict with REAL client reservations (not other blocks)
    SELECT COUNT(*)
    INTO conflict_count
    FROM public.reservations
    WHERE
      salon_id = NEW.salon_id
      AND appointment_date = NEW.appointment_date
      AND status IN ('Confirmed', 'Pending')
      AND (notes IS NULL OR notes NOT ILIKE '%NEAU BLOQU%')
      AND id != COALESCE(NEW.id, gen_random_uuid())
      AND (
        (NEW.staff_id IS NOT NULL AND staff_id = NEW.staff_id)
        OR
        (NEW.barber_id IS NOT NULL AND barber_id = NEW.barber_id)
        OR
        (NEW.staff_id IS NULL AND NEW.barber_id IS NULL AND staff_id IS NULL AND barber_id IS NULL)
      )
      AND NEW.start_time < end_time
      AND NEW.end_time > start_time;

    IF conflict_count > 0 THEN
      RAISE EXCEPTION 'booking_conflict: Ce créneau a une réservation client active. Impossible de le bloquer.' USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
  END IF;

  -- Normal client reservation: conflicts with any active reservation OR block
  SELECT COUNT(*)
  INTO conflict_count
  FROM public.reservations
  WHERE
    salon_id = NEW.salon_id
    AND appointment_date = NEW.appointment_date
    AND status IN ('Confirmed', 'Pending')
    AND id != COALESCE(NEW.id, gen_random_uuid())
    AND (
      (NEW.staff_id IS NOT NULL AND staff_id = NEW.staff_id)
      OR
      (NEW.barber_id IS NOT NULL AND barber_id = NEW.barber_id)
      OR
      (NEW.staff_id IS NULL AND NEW.barber_id IS NULL AND staff_id IS NULL AND barber_id IS NULL)
    )
    AND NEW.start_time < end_time
    AND NEW.end_time > start_time;

  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'booking_conflict: Ce créneau est déjà réservé ou bloqué.' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;
