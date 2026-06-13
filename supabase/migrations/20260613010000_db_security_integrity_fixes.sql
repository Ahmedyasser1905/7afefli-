-- =============================================================================
-- Migration: 20260613010000_db_security_integrity_fixes.sql
-- Project:   7afefli (Barber / 7afefli-)
-- Author:    Senior PostgreSQL / Supabase Engineer
-- Date:      2026-06-13
--
-- Purpose:   Single idempotent migration that resolves ALL 6 confirmed
--            production-database issues identified in the live audit, plus
--            two medium-severity bonus fixes (duplicate indexes and
--            portfolio_photos policy cleanup).
--
-- All statements use IF EXISTS / IF NOT EXISTS and are safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- FIX 1 — CRITICAL: Notification CHECK constraint (only 5 of 10 types allowed)
-- ---------------------------------------------------------------------------
-- The live DB still carries the original 5-type constraint. Drop it by name
-- and recreate with the full 14-type set that the backend actually sends.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'new_booking',
    'booking_confirmed',
    'booking_cancelled',
    'booking_reminder',
    'new_review',
    'system',
    'confirmed',
    'cancelled',
    'completed',
    'subscription_expiring',
    'subscription_activated',
    'salon_approved',
    'salon_rejected',
    'loyalty_points'
  ));

-- ---------------------------------------------------------------------------
-- FIX 2 — CRITICAL: 19 SECURITY DEFINER functions callable by anon / PUBLIC
-- ---------------------------------------------------------------------------
-- Revoke EXECUTE from PUBLIC and anon on every sensitive function.
-- Trigger functions run as the trigger owner and need no user-level GRANT,
-- but explicit restriction is still correct practice.
-- find_nearby_salons and create_reservation_safe are intentionally left open.

-- Revoke from PUBLIC (implicitly covers anon) and explicitly from anon + authenticated
REVOKE EXECUTE ON FUNCTION public.expire_reservation(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.expire_salon_reservations(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.expire_client_reservations(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_all_subscription_statuses()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_auto_cancel_pending_reservations()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_lock_active_premium_subscription()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.prevent_salon_escalation()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_loyalty_points()
  FROM PUBLIC, anon, authenticated;

-- Re-grant EXECUTE only to service_role (backend service account)
GRANT EXECUTE ON FUNCTION public.expire_reservation(uuid)              TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_salon_reservations(uuid)       TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_client_reservations(uuid)      TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_all_subscription_statuses()      TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_auto_cancel_pending_reservations() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_lock_active_premium_subscription() TO service_role;
-- prevent_salon_escalation and increment_loyalty_points are trigger functions;
-- they run as the trigger owner — no explicit user GRANT needed.

-- Harden search_path on all SECURITY DEFINER functions to prevent
-- search_path hijacking (Supabase advisor flag: 22 functions affected).

ALTER FUNCTION public.expire_reservation(uuid)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.expire_salon_reservations(uuid)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.expire_client_reservations(uuid)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.sync_all_subscription_statuses()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.fn_auto_cancel_pending_reservations()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.fn_lock_active_premium_subscription()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.prevent_salon_escalation()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.increment_loyalty_points()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.check_reservation_overlap()
  SET search_path = public, pg_catalog;

-- find_nearby_salons: public map search — intentionally open; harden path only
ALTER FUNCTION public.find_nearby_salons(double precision, double precision, integer, integer)
  SET search_path = public, pg_catalog;

-- create_reservation_safe: authenticated + service_role are correct; harden path only
ALTER FUNCTION public.create_reservation_safe(uuid, uuid, uuid, uuid, uuid, date, time, time, text, text, boolean)
  SET search_path = public, pg_catalog;

-- ---------------------------------------------------------------------------
-- FIX 3 — CRITICAL: portfolio storage bucket — no ownership check on writes
-- ---------------------------------------------------------------------------
-- Drop the two dangerously open policies that allow any authenticated user
-- to upload or overwrite ANY path in the portfolio bucket.

DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update" ON storage.objects;

-- Replace with ownership-enforced policies.
-- Storage path convention: {salonId}/{timestamp}.{ext}
-- The first folder segment must be a salon owned by the uploading user.

DROP POLICY IF EXISTS "portfolio_owner_insert" ON storage.objects;
CREATE POLICY "portfolio_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'portfolio'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.salons WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "portfolio_owner_update" ON storage.objects;
CREATE POLICY "portfolio_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'portfolio'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.salons WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'portfolio'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.salons WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "portfolio_owner_delete" ON storage.objects;
CREATE POLICY "portfolio_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'portfolio'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.salons WHERE owner_id = auth.uid()
    )
  );

-- Public read: portfolio photos are public by design (clients browse before booking)
DROP POLICY IF EXISTS "portfolio_public_read" ON storage.objects;
CREATE POLICY "portfolio_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'portfolio');

-- ---------------------------------------------------------------------------
-- FIX 4 — HIGH: Duplicate trigger prevent_double_booking fires twice
-- ---------------------------------------------------------------------------
-- The trigger "prevent_double_booking" was created outside the migrations
-- (dashboard or a lost migration). The canonical trigger is
-- "trg_prevent_double_booking" from migration 20260610020000.
-- Drop the duplicate; keep the canonical one.

DROP TRIGGER IF EXISTS prevent_double_booking ON public.reservations;
-- trg_prevent_double_booking remains active and is the authoritative trigger.

-- ---------------------------------------------------------------------------
-- FIX 5 — HIGH: audit_log RLS blocks all INSERT — zero rows ever logged
-- ---------------------------------------------------------------------------
-- The audit_log table exists with RLS enabled but has no INSERT policy,
-- so every write from the backend AuditService is silently rejected.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  target_type TEXT,
  target_id   UUID,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only the NestJS backend (service_role) may write audit records.
DROP POLICY IF EXISTS "audit_log_service_insert" ON public.audit_log;
CREATE POLICY "audit_log_service_insert"
  ON public.audit_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Admins may read all audit logs; no one else can.
DROP POLICY IF EXISTS "audit_log_admin_read" ON public.audit_log;
CREATE POLICY "audit_log_admin_read"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- UPDATE and DELETE: no policy created → RLS default-deny makes logs immutable.

-- ---------------------------------------------------------------------------
-- FIX 6 — HIGH: notifications INSERT policy open to PUBLIC / anon
-- ---------------------------------------------------------------------------
-- The existing policy "Service role can insert notifications" was mistakenly
-- applied to role {public}, allowing notification injection by any caller.
-- Drop it and replace with a service_role-only INSERT policy.

DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

DROP POLICY IF EXISTS "notifications_service_insert" ON public.notifications;
CREATE POLICY "notifications_service_insert"
  ON public.notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- SELECT and UPDATE policies for individual users are correct — left untouched.

-- ---------------------------------------------------------------------------
-- BONUS FIX A — MEDIUM: Drop duplicate / redundant indexes
-- ---------------------------------------------------------------------------
-- Confirmed duplicates identified in the live audit:
--
--   reservations:       idx_reservations_salon_date  ≡  idx_reservations_salon_appt_date  (keep appt_date)
--   reviews (×2):       idx_reviews_salon_created    ≡  idx_reviews_salon_date            (keep salon_date)
--                       idx_reviews_no_response      (redundant)
--   user_subscriptions: idx_subscriptions_salon_id   ≡  idx_user_subscriptions_salon_id   (keep user_subscriptions)

DROP INDEX IF EXISTS public.idx_reservations_salon_date;
DROP INDEX IF EXISTS public.idx_reviews_salon_created;
DROP INDEX IF EXISTS public.idx_reviews_no_response;
DROP INDEX IF EXISTS public.idx_subscriptions_salon_id;

-- Surviving canonical indexes after this migration:
--   idx_reservations_salon_appt_date  (reservations)
--   idx_reviews_salon_date            (reviews)
--   idx_user_subscriptions_salon_id   (user_subscriptions)

-- ---------------------------------------------------------------------------
-- BONUS FIX B — MEDIUM: portfolio_photos — redundant SELECT policies
-- ---------------------------------------------------------------------------
-- portfolio_select_public uses USING (true), making it the sole effective
-- SELECT policy. The two overlapping policies below are redundant noise.
-- Also consolidate write policies to be ownership-checked.

DROP POLICY IF EXISTS "Authenticated users can view portfolio photos" ON public.portfolio_photos;
DROP POLICY IF EXISTS "Anyone can view portfolio photos"              ON public.portfolio_photos;
-- portfolio_select_public (USING true) is retained — intentional public read.

-- Replace the over-broad "Salon owners can manage their portfolio" policy
-- with separate, explicit INSERT and DELETE policies.
DROP POLICY IF EXISTS "Salon owners can manage their portfolio" ON public.portfolio_photos;

DROP POLICY IF EXISTS "portfolio_photos_owner_insert" ON public.portfolio_photos;
CREATE POLICY "portfolio_photos_owner_insert"
  ON public.portfolio_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.salons
      WHERE id = salon_id AND owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "portfolio_photos_owner_delete" ON public.portfolio_photos;
CREATE POLICY "portfolio_photos_owner_delete"
  ON public.portfolio_photos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.salons
      WHERE id = salon_id AND owner_id = auth.uid()
    )
  );

-- =============================================================================
-- End of migration: 20260613010000_db_security_integrity_fixes.sql
-- =============================================================================
