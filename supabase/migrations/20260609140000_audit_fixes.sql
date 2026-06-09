-- Fix 1: Add Double Booking Prevention Trigger

CREATE OR REPLACE FUNCTION check_reservation_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM reservations
    WHERE salon_id = NEW.salon_id
      AND barber_id = NEW.barber_id
      AND status NOT IN ('cancelled', 'rejected')
      AND date = NEW.date
      AND id != NEW.id
      -- Check if new reservation time falls inside an existing one, or vice versa
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

-- Fix 2: Enable RLS on user_subscriptions to secure it
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Owner can read their own subscription
CREATE POLICY "Users can view their own subscriptions"
ON user_subscriptions FOR SELECT
USING (auth.uid() = user_id);

-- Only admins and service_role can update subscriptions
CREATE POLICY "Admins can update subscriptions"
ON user_subscriptions FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin'));

-- Fix 3: Standardize the plans / subscription_plans fragmented structure
-- If you need foreign keys between user_subscriptions and plans, ensure
-- the plan column type matches the primary key type of plans.

-- Note: Fixing the TEXT vs UUID issue requires a data migration if the table is already populated.
-- As this is an audit fix, we are surfacing the constraint and implementing the baseline schema locks.
