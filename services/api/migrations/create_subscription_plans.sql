-- Migration: Create subscription_plans table
-- This table stores the available subscription plans that salon owners can purchase.
-- Plans are managed by admins and served dynamically to the mobile app.

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                         -- Display name (e.g. "Pro", "Premium")
  slug TEXT NOT NULL UNIQUE,                  -- Machine-readable ID (e.g. "pro", "premium")
  price INTEGER NOT NULL DEFAULT 0,           -- Price in DZD (centimes not used in Algeria)
  duration_days INTEGER NOT NULL DEFAULT 30,  -- How many days the plan lasts
  features JSONB NOT NULL DEFAULT '[]',       -- Array of feature strings
  icon TEXT DEFAULT 'star-outline',           -- Ionicon name for mobile display
  is_recommended BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,    -- Soft-delete / hide plans
  sort_order INTEGER NOT NULL DEFAULT 0,      -- Display order
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the two initial plans
INSERT INTO subscription_plans (name, slug, price, duration_days, features, icon, is_recommended, sort_order)
VALUES
  (
    'Pro',
    'pro',
    1000,
    30,
    '["Réservations illimitées", "Statistiques avancées", "Gestion multi-barbiers", "Support prioritaire"]'::jsonb,
    'diamond-outline',
    true,
    1
  ),
  (
    'Premium',
    'premium',
    5000,
    30,
    '["Tout du plan Pro", "Salon sponsorisé", "Salon mis en avant", "Badge Premium visible", "Marketing inclus", "Support dédié 24/7"]'::jsonb,
    'trophy-outline',
    false,
    2
  )
ON CONFLICT (slug) DO NOTHING;

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Everyone can read active plans (public catalog)
CREATE POLICY "Anyone can view active plans"
  ON subscription_plans FOR SELECT
  USING (is_active = true);

-- Only admins can manage plans (insert/update/delete handled via service role)
