-- Migration: Enable RLS on the payments table
-- HIGH-1: No RLS migration was found for payments in the post-modification audit.
-- This migration closes that gap.

-- Enable Row Level Security
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ── Policy 1: Salon owners can SELECT their own salon's payments ─────────────
-- Joins through salons.owner_id to identify the authenticated user's salon.
DROP POLICY IF EXISTS "salon_owner_select_own_payments" ON public.payments;
CREATE POLICY "salon_owner_select_own_payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    salon_id IN (
      SELECT id FROM public.salons WHERE owner_id = auth.uid()
    )
  );

-- ── Policy 2: service_role bypass — can do everything ───────────────────────
-- service_role is used by the NestJS backend (admin client) for all server-side ops.
-- Supabase grants service_role BYPASSRLS by default, so this is belt-and-suspenders.
DROP POLICY IF EXISTS "service_role_full_access_payments" ON public.payments;
CREATE POLICY "service_role_full_access_payments"
  ON public.payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Policy 3: Admin users can SELECT all payments ──────────────────────────
DROP POLICY IF EXISTS "admin_select_all_payments" ON public.payments;
CREATE POLICY "admin_select_all_payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'Admin'
    )
  );
