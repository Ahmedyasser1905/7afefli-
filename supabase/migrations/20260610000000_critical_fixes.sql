-- =============================================================================
-- MIGRATION: Critical & High fixes from audit (2026-06-10)
-- Branch: fix/audit-critical-high
-- NOTE: find_nearby_salons defined here is superseded by 20260613010000.
-- Do not re-apply this definition independently.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- C1 + C3: Fix check_reservation_overlap trigger
--   - wrong column: `date` → `appointment_date`
--   - wrong case: `'cancelled','rejected'` → `'Cancelled','Completed'`
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_reservation_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM reservations
    WHERE salon_id = NEW.salon_id
      AND barber_id = NEW.barber_id
      AND status NOT IN ('Cancelled', 'Completed')
      AND appointment_date = NEW.appointment_date   -- fix: was `date`
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

DROP TRIGGER IF EXISTS trg_prevent_double_booking ON reservations;
CREATE TRIGGER trg_prevent_double_booking
BEFORE INSERT OR UPDATE ON reservations
FOR EACH ROW
EXECUTE FUNCTION check_reservation_overlap();


-- ─────────────────────────────────────────────────────────────────────────────
-- C2: Fix RLS on user_subscriptions
--   - wrong column: `user_id` → joined via salons.owner_id
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own subscriptions" ON user_subscriptions;
CREATE POLICY "Users can view their own subscriptions"
ON user_subscriptions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM salons
    WHERE salons.id = user_subscriptions.salon_id
      AND salons.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can update subscriptions" ON user_subscriptions;
CREATE POLICY "Admins can update subscriptions"
ON user_subscriptions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'Admin'
  )
);


-- ─────────────────────────────────────────────────────────────────────────────
-- C4: Consolidate all critical RPCs into supabase/migrations
--     (previously only in services/api/migrations/)
-- ─────────────────────────────────────────────────────────────────────────────

-- 4a. create_reservation_safe (final canonical version with p_is_walk_in)
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
AS $$
DECLARE
  v_overlap              boolean;
  v_reservation          reservations%ROWTYPE;
  v_is_manually_closed   boolean;
BEGIN
  SELECT is_manually_closed INTO v_is_manually_closed
  FROM salons WHERE id = p_salon_id;

  IF v_is_manually_closed = true THEN
    RAISE EXCEPTION 'Salon is temporarily closed.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_salon_id::text));

  SELECT EXISTS (
    SELECT 1 FROM reservations
    WHERE salon_id        = p_salon_id
      AND appointment_date = p_appointment_date
      AND status          IN ('Pending', 'Confirmed')
      AND start_time      < p_end_time
      AND end_time        > p_start_time
      AND (
        (p_staff_id  IS NOT NULL AND staff_id  = p_staff_id)
        OR
        (p_barber_id IS NOT NULL AND barber_id = p_barber_id)
      )
  ) INTO v_overlap;

  IF v_overlap THEN
    RAISE EXCEPTION 'Time slot is already booked.';
  END IF;

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


-- 4b. expire_reservation
CREATE OR REPLACE FUNCTION expire_reservation(p_reservation_id UUID)
RETURNS void AS $$
DECLARE
  v_now_algeria TIMESTAMPTZ := NOW() AT TIME ZONE 'Africa/Algiers';
  v_today       DATE        := (v_now_algeria)::DATE;
  v_now_time    TIME        := (v_now_algeria)::TIME;
  v_status      TEXT;
  v_appt_date   DATE;
  v_end_time    TIME;
  v_notes       TEXT;
BEGIN
  SELECT status, appointment_date, end_time::TIME, notes
  INTO v_status, v_appt_date, v_end_time, v_notes
  FROM reservations WHERE id = p_reservation_id;

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


-- 4c. expire_salon_reservations
CREATE OR REPLACE FUNCTION expire_salon_reservations(p_salon_id UUID)
RETURNS void AS $$
DECLARE
  v_now_algeria TIMESTAMPTZ := NOW() AT TIME ZONE 'Africa/Algiers';
  v_today       DATE        := (v_now_algeria)::DATE;
  v_now_time    TIME        := (v_now_algeria)::TIME;
BEGIN
  UPDATE reservations SET status = 'Cancelled'
  WHERE salon_id = p_salon_id AND status = 'Pending'
    AND notes NOT ILIKE '%NEAU BLOQU%'
    AND (appointment_date < v_today OR (appointment_date = v_today AND end_time::TIME < v_now_time));

  UPDATE reservations SET status = 'Completed'
  WHERE salon_id = p_salon_id AND status = 'Confirmed'
    AND notes NOT ILIKE '%NEAU BLOQU%'
    AND (appointment_date < v_today OR (appointment_date = v_today AND end_time::TIME < v_now_time));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4d. expire_client_reservations
CREATE OR REPLACE FUNCTION expire_client_reservations(p_client_id UUID)
RETURNS void AS $$
DECLARE
  v_now_algeria TIMESTAMPTZ := NOW() AT TIME ZONE 'Africa/Algiers';
  v_today       DATE        := (v_now_algeria)::DATE;
  v_now_time    TIME        := (v_now_algeria)::TIME;
BEGIN
  UPDATE reservations SET status = 'Cancelled'
  WHERE client_id = p_client_id AND status = 'Pending'
    AND notes NOT ILIKE '%NEAU BLOQU%'
    AND (appointment_date < v_today OR (appointment_date = v_today AND end_time::TIME < v_now_time));

  UPDATE reservations SET status = 'Completed'
  WHERE client_id = p_client_id AND status = 'Confirmed'
    AND notes NOT ILIKE '%NEAU BLOQU%'
    AND (appointment_date < v_today OR (appointment_date = v_today AND end_time::TIME < v_now_time));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4e. sync_all_subscription_statuses (used by cron)
CREATE OR REPLACE FUNCTION sync_all_subscription_statuses()
RETURNS void AS $$
BEGIN
  -- Expire active subscriptions past their end date
  UPDATE user_subscriptions
  SET status = 'Expired'
  WHERE status IN ('Active', 'Trial')
    AND ends_at IS NOT NULL
    AND ends_at < NOW();

  -- Sync salon subscription_status to match
  UPDATE salons s
  SET subscription_status = us.status
  FROM user_subscriptions us
  WHERE us.salon_id = s.id
    AND s.subscription_status != us.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION expire_salon_reservations(UUID)    TO service_role;
GRANT EXECUTE ON FUNCTION expire_client_reservations(UUID)   TO service_role;
GRANT EXECUTE ON FUNCTION expire_reservation(UUID)           TO service_role;
GRANT EXECUTE ON FUNCTION sync_all_subscription_statuses()   TO service_role;
GRANT EXECUTE ON FUNCTION create_reservation_safe(uuid,uuid,uuid,uuid,uuid,date,time,time,text,text,boolean) TO service_role, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- C6 / H7: find_nearby_salons — add Expired filter + move to supabase/migrations
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS find_nearby_salons(double precision, double precision, double precision, integer);

CREATE OR REPLACE FUNCTION find_nearby_salons(
  user_lat      double precision,
  user_lng      double precision,
  radius_meters double precision,
  result_limit  integer
)
RETURNS TABLE (
  id                    UUID,
  owner_id              UUID,
  name                  TEXT,
  description           TEXT,
  wilaya                TEXT,
  address               TEXT,
  latitude              double precision,
  longitude             double precision,
  location              geography(Point, 4326),
  subscription_status   subscription_status,
  trial_ends_at         timestamp with time zone,
  subscription_ends_at  timestamp with time zone,
  is_approved           boolean,
  is_sponsored          boolean,
  sponsored_until       timestamp with time zone,
  open_time             time without time zone,
  close_time            time without time zone,
  working_days          integer[],
  average_rating        numeric,
  total_reviews         integer,
  created_at            timestamp with time zone,
  updated_at            timestamp with time zone,
  force_closed          boolean,
  is_manually_closed    boolean,
  image_url             TEXT,
  distance_meters       double precision
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id, s.owner_id, s.name, s.description, s.wilaya, s.address,
    s.latitude, s.longitude,
    s.location::geography(Point, 4326),
    s.subscription_status, s.trial_ends_at, s.subscription_ends_at,
    s.is_approved, s.is_sponsored, s.sponsored_until,
    s.open_time, s.close_time, s.working_days,
    s.average_rating, s.total_reviews, s.created_at, s.updated_at,
    s.force_closed, s.is_manually_closed, s.image_url,
    ST_Distance(
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326)::geography
    ) AS distance_meters
  FROM salons s
  WHERE s.is_approved = true
    AND s.subscription_status != 'Expired'          -- fix: was missing
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(s.longitude, s.latitude), 4326)::geography,
      radius_meters
    )
  ORDER BY s.is_sponsored DESC, distance_meters ASC
  LIMIT result_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION find_nearby_salons(double precision, double precision, double precision, integer) TO service_role, authenticated, anon;


-- ─────────────────────────────────────────────────────────────────────────────
-- H7: wilayas table (missing from supabase/migrations)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wilayas (
  id   INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.wilayas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.wilayas;
CREATE POLICY "Enable read access for all users" ON public.wilayas FOR SELECT USING (true);

INSERT INTO public.wilayas (id, name) VALUES
(1,'Adrar'),(2,'Chlef'),(3,'Laghouat'),(4,'Oum El Bouaghi'),(5,'Batna'),
(6,'Béjaïa'),(7,'Biskra'),(8,'Béchar'),(9,'Blida'),(10,'Bouira'),
(11,'Tamanrasset'),(12,'Tébessa'),(13,'Tlemcen'),(14,'Tiaret'),(15,'Tizi Ouzou'),
(16,'Alger'),(17,'Djelfa'),(18,'Jijel'),(19,'Sétif'),(20,'Saïda'),
(21,'Skikda'),(22,'Sidi Bel Abbès'),(23,'Annaba'),(24,'Guelma'),(25,'Constantine'),
(26,'Médéa'),(27,'Mostaganem'),(28,'M''Sila'),(29,'Mascara'),(30,'Ouargla'),
(31,'Oran'),(32,'El Bayadh'),(33,'Illizi'),(34,'Bordj Bou Arréridj'),(35,'Boumerdès'),
(36,'El Tarf'),(37,'Tindouf'),(38,'Tissemsilt'),(39,'El Oued'),(40,'Khenchela'),
(41,'Souk Ahras'),(42,'Tipaza'),(43,'Mila'),(44,'Aïn Defla'),(45,'Naâma'),
(46,'Aïn Témouchent'),(47,'Ghardaïa'),(48,'Relizane'),(49,'Timimoun'),(50,'Bordj Badji Mokhtar'),
(51,'Ouled Djellal'),(52,'Béni Abbès'),(53,'In Salah'),(54,'In Guezzam'),(55,'Touggourt'),
(56,'Djanet'),(57,'El M''Ghair'),(58,'El Meniaa')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;


-- ─────────────────────────────────────────────────────────────────────────────
-- M2: Fix loyalty_points trigger — skip walk-in reservations
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_loyalty_points()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'Completed' AND OLD.status != 'Completed'
     AND (NEW.is_walk_in IS NULL OR NEW.is_walk_in = false)  -- fix: skip walk-ins
  THEN
    UPDATE profiles SET loyalty_points = loyalty_points + 10 WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loyalty_points ON reservations;
CREATE TRIGGER trg_loyalty_points
  AFTER UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION increment_loyalty_points();


-- ─────────────────────────────────────────────────────────────────────────────
-- Performance indexes (missing from supabase/migrations)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reservations_salon_appt_date   ON reservations (salon_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_reservations_appt_date         ON reservations (appointment_date);
CREATE INDEX IF NOT EXISTS idx_reservations_pending_future    ON reservations (salon_id, appointment_date, status) WHERE status = 'Pending';
CREATE INDEX IF NOT EXISTS idx_reviews_salon_id               ON reviews (salon_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_photos_salon_id      ON portfolio_photos (salon_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_salon_id    ON user_subscriptions (salon_id);
CREATE INDEX IF NOT EXISTS idx_reservations_salon_is_walk_in  ON reservations (salon_id, is_walk_in);
