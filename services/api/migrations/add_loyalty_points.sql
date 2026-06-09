-- Migration: Add loyalty_points to profiles if not present
-- Referenced in ClientsScreen and reservations queries

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0;

-- Auto-increment loyalty points when a reservation is completed
CREATE OR REPLACE FUNCTION increment_loyalty_points()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'Completed' AND OLD.status != 'Completed' THEN
    UPDATE profiles 
    SET loyalty_points = loyalty_points + 10 
    WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loyalty_points ON reservations;
CREATE TRIGGER trg_loyalty_points
  AFTER UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION increment_loyalty_points();
