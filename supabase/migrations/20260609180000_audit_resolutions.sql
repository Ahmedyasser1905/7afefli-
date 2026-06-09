-- 1. Create client_subscriptions table
CREATE TABLE IF NOT EXISTS public.client_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'Free',
  status TEXT NOT NULL DEFAULT 'Active',
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_user_id ON public.client_subscriptions(user_id, status);

-- Enable RLS on client_subscriptions
ALTER TABLE public.client_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own subscriptions
DROP POLICY IF EXISTS "Users can view own client subscriptions" ON public.client_subscriptions;
CREATE POLICY "Users can view own client subscriptions"
  ON public.client_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2. Drop duplicate columns in reviews
ALTER TABLE public.reviews DROP COLUMN IF EXISTS response;
ALTER TABLE public.reviews DROP COLUMN IF EXISTS response_date;

-- 3. Drop force_closed column in salons
ALTER TABLE public.salons DROP COLUMN IF EXISTS force_closed;

-- 5. Restrict reservations INSERT RLS policies
DROP POLICY IF EXISTS reservations_insert_client ON public.reservations;
CREATE POLICY reservations_insert_client ON public.reservations
  FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS reservations_insert_barber ON public.reservations;
CREATE POLICY reservations_insert_barber ON public.reservations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.salons
      WHERE salons.id = salon_id
      AND salons.owner_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.salon_staff
      WHERE salon_staff.salon_id = reservations.salon_id
      AND salon_staff.profile_id = auth.uid()
    )
  );
