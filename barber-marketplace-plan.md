# 💈 Multi-Barber Appointment Booking Marketplace — Full Project Execution Plan

> **Platform Codename:** `BarberDZ`
> **Target Market:** Algeria 🇩🇿
> **Architecture Pattern:** Marketplace SaaS (Subscription-Based, Freemium Launch)
> **Author Role:** Senior Full-Stack Architect & Database Administrator

---

## Table of Contents

1. [Business Model & Revenue Streams](#1-business-model--revenue-streams)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Tech Stack Decisions](#3-tech-stack-decisions)
4. [Project Directory Structure](#4-project-directory-structure)
5. [Supabase MCP Setup & Execution](#5-supabase-mcp-setup--execution)
   - 5.1 [MCP Initialization](#51-mcp-initialization)
   - 5.2 [Database Schema (SQL via MCP)](#52-database-schema-sql-via-mcp)
   - 5.3 [Row Level Security Policies](#53-row-level-security-policies)
   - 5.4 [Anti-Double-Booking Trigger](#54-anti-double-booking-trigger)
   - 5.5 [Supabase Storage Buckets](#55-supabase-storage-buckets)
6. [NestJS Backend — API Layer](#6-nestjs-backend--api-layer)
7. [React Native Frontend — Dynamic UI](#7-react-native-frontend--dynamic-ui)
   - 7.1 [Dynamic Time Slot Generation](#71-dynamic-time-slot-generation)
   - 7.2 [Slot Locking (5-Minute Front-End Lock)](#72-slot-locking-5-minute-front-end-lock)
   - 7.3 [Supabase Realtime Integration](#73-supabase-realtime-integration)
8. [Feature Implementation Roadmap](#8-feature-implementation-roadmap)
9. [Security Checklist](#9-security-checklist)
10. [Deployment Strategy](#10-deployment-strategy)

---

## 1. Business Model & Revenue Streams

### Subscription Tiers for Barbers

| Tier | Duration | Price (DZD) | Notes |
|------|----------|-------------|-------|
| Free Trial | 3–6 months | 0 | Onboarding / Freemium launch |
| Monthly | 1 month | ~1,500–2,500 DZD | Rolling subscription |
| Annual | 12 months | ~12,000–18,000 DZD | Discounted (~25% off) |

### Why No Per-Booking Commission?

The Algerian barbershop market is **predominantly cash-based**. Implementing a per-booking fee would require intercepting a cash transaction — logistically impossible and culturally resisted. The subscription model is clean, predictable, and has zero friction for barbers.

### Bonus Revenue: Sponsored Profiles

Barbers can pay to **boost** their salon to the top of local search results (similar to Google Ads / Yassir's promoted listings). This is:

- Billed separately from subscription (one-time or weekly boosts).
- Managed via the `is_sponsored` flag and `sponsored_until` timestamp in the `salons` table.
- Displayed in the client app with a subtle `⭐ Sponsored` badge.

---

## 2. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│                                                                     │
│   ┌──────────────────┐   ┌──────────────────┐   ┌───────────────┐  │
│   │   Client App     │   │  Barber Dashboard │   │ Admin Portal  │  │
│   │ (React Native /  │   │ (React Native /   │   │  (React Web)  │  │
│   │   Expo Go)       │   │   Expo Go)        │   │               │  │
│   └────────┬─────────┘   └────────┬──────────┘   └───────┬───────┘  │
│            │                      │                       │          │
└────────────┼──────────────────────┼───────────────────────┼──────────┘
             │                      │                       │
             ▼                      ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API / LOGIC LAYER                           │
│                                                                     │
│                   ┌───────────────────────┐                         │
│                   │    NestJS REST API     │                         │
│                   │  (Business Logic,      │                         │
│                   │   Validation,          │                         │
│                   │   Auth Guards,         │                         │
│                   │   Slot Generation)     │                         │
│                   └───────────┬───────────┘                         │
│                               │                                     │
└───────────────────────────────┼─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SUPABASE BACKEND LAYER                         │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Auth        │  │  Storage     │  │  PostgreSQL Database      │  │
│  │  (JWT/OTP)   │  │  (Buckets:   │  │  (Tables, RLS, Triggers,  │  │
│  │              │  │  avatars,    │  │   Functions, Indexes)     │  │
│  │              │  │  portfolios) │  │                           │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Realtime (WebSocket Subscriptions)                          │   │
│  │  → Barber notified instantly when a reservation is created   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL SERVICES                             │
│                                                                     │
│   Mapbox / Google Maps API    •    Expo Push Notifications          │
│   (Geolocation, Nearby Search)     (FCM / APNs via Expo)            │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow: Booking a Slot

```
Client taps slot
      │
      ▼
[React Native] → POST /reservations (NestJS API)
      │
      ▼
[NestJS] → Validates JWT, checks service duration, calls Supabase
      │
      ▼
[Supabase PostgreSQL]
  → check_overlap_trigger FIRES (prevents double-booking)
  → INSERT succeeds → Realtime event emitted on channel `salon:{salon_id}`
      │
      ▼
[Barber App] ← receives Realtime push → calendar updates live
      │
      ▼
[Expo Push] → Client receives confirmation notification
```

---

## 3. Tech Stack Decisions

| Layer | Technology | Reason |
|-------|-----------|--------|
| Mobile App | React Native + Expo Go | Cross-platform (iOS & Android), fast iteration, OTA updates |
| API Layer | NestJS (Node.js) | Strongly typed, modular, decorators for guards/pipes, great DX |
| Database | Supabase PostgreSQL | Managed Postgres, built-in Auth, Realtime, Storage — all-in-one |
| Realtime | Supabase Realtime | WebSocket channels tied to DB rows, zero extra infrastructure |
| Auth | Supabase Auth | JWT-based, supports phone OTP (critical for Algeria) |
| Storage | Supabase Storage | S3-compatible, CDN-backed, integrated with RLS |
| Maps | Mapbox (preferred) | Better offline/custom maps; Google Maps as fallback |
| Push Notifications | Expo Notifications | Unified FCM + APNs, works seamlessly with Expo Go |
| Admin Dashboard | React (Web) | Separate web portal for super admin controls |
| CI/CD | GitHub Actions | Automated testing and deployment pipelines |
| Hosting (API) | Railway / Render | Simple NestJS deployment with Dockerfile |

---

## 4. Project Directory Structure

```
barberdz/
├── apps/
│   ├── mobile/                      # React Native (Expo) — Client & Barber apps
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   │   ├── client/
│   │   │   │   │   ├── HomeScreen.tsx
│   │   │   │   │   ├── SalonDetailScreen.tsx
│   │   │   │   │   ├── BookingScreen.tsx       ← slot picker lives here
│   │   │   │   │   └── MyAppointmentsScreen.tsx
│   │   │   │   └── barber/
│   │   │   │       ├── DashboardScreen.tsx
│   │   │   │       ├── CalendarScreen.tsx
│   │   │   │       ├── ClientCRMScreen.tsx
│   │   │   │       └── ShopSettingsScreen.tsx
│   │   │   ├── components/
│   │   │   │   ├── SlotPicker.tsx             ← dynamic slot generator
│   │   │   │   ├── SalonCard.tsx
│   │   │   │   └── RatingStars.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useAvailableSlots.ts
│   │   │   │   ├── useRealtimeBookings.ts     ← Supabase Realtime hook
│   │   │   │   └── useSlotLock.ts             ← 5-min lock logic
│   │   │   ├── lib/
│   │   │   │   └── supabase.ts                ← Supabase client init
│   │   │   └── navigation/
│   │   │       └── AppNavigator.tsx
│   │   ├── app.json
│   │   └── package.json
│   │
│   └── admin/                       # React Web — Super Admin Portal
│       ├── src/
│       │   ├── pages/
│       │   │   ├── SalonApprovals.tsx
│       │   │   ├── GlobalStats.tsx
│       │   │   └── SubscriptionManager.tsx
│       │   └── lib/
│       │       └── supabase.ts
│       └── package.json
│
├── services/
│   └── api/                         # NestJS Backend
│       ├── src/
│       │   ├── auth/
│       │   │   ├── auth.module.ts
│       │   │   ├── auth.guard.ts
│       │   │   └── supabase.strategy.ts
│       │   ├── salons/
│       │   │   ├── salons.module.ts
│       │   │   ├── salons.controller.ts
│       │   │   └── salons.service.ts
│       │   ├── reservations/
│       │   │   ├── reservations.module.ts
│       │   │   ├── reservations.controller.ts
│       │   │   ├── reservations.service.ts
│       │   │   └── dto/
│       │   │       └── create-reservation.dto.ts
│       │   ├── slots/
│       │   │   ├── slots.module.ts
│       │   │   ├── slots.service.ts            ← slot generation logic
│       │   │   └── slots.controller.ts
│       │   └── main.ts
│       ├── Dockerfile
│       └── package.json
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_create_profiles.sql
│   │   ├── 002_create_salons.sql
│   │   ├── 003_create_services.sql
│   │   ├── 004_create_reservations.sql
│   │   ├── 005_rls_policies.sql
│   │   └── 006_overlap_trigger.sql
│   └── seed.sql
│
└── README.md
```

---

## 5. Supabase MCP Setup & Execution

This section contains **every MCP tool call** and SQL command needed to build the entire backend. These are executed sequentially via the Supabase MCP.

### 5.1 MCP Initialization

Before executing any SQL, initialize the Supabase MCP connection:

```typescript
// MCP Tool Call: Connect to Supabase Project
mcp_supabase_connect({
  project_ref: "YOUR_SUPABASE_PROJECT_REF",   // e.g., "abcxyzproject"
  service_role_key: "YOUR_SERVICE_ROLE_KEY"   // From Supabase Dashboard → Settings → API
})
```

Verify the connection:

```typescript
// MCP Tool Call: List existing tables (should be empty at start)
mcp_supabase_execute_sql({
  query: `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `
})
```

---

### 5.2 Database Schema (SQL via MCP)

Execute each migration block in order using `mcp_supabase_execute_sql`.

#### Migration 001 — Enable Extensions

```typescript
// MCP Tool Call
mcp_supabase_execute_sql({
  query: `
    -- Enable UUID generation
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    
    -- Enable PostGIS for geolocation queries (find nearby salons)
    CREATE EXTENSION IF NOT EXISTS "postgis";
  `
})
```

#### Migration 002 — Create ENUM Types

```typescript
// MCP Tool Call
mcp_supabase_execute_sql({
  query: `
    -- User role enum
    CREATE TYPE user_role AS ENUM ('Client', 'Coiffeur', 'Admin');

    -- Salon subscription status enum
    CREATE TYPE subscription_status AS ENUM ('Trial', 'Active', 'Expired');

    -- Reservation status enum
    CREATE TYPE reservation_status AS ENUM (
      'Pending', 
      'Confirmed', 
      'Cancelled', 
      'Completed'
    );
  `
})
```

#### Migration 003 — Create `profiles` Table

```typescript
// MCP Tool Call
mcp_supabase_execute_sql({
  query: `
    CREATE TABLE public.profiles (
      id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      full_name       TEXT NOT NULL,
      phone_number    TEXT UNIQUE,
      role            user_role NOT NULL DEFAULT 'Client',
      avatar_url      TEXT,
      loyalty_points  INTEGER NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Auto-update updated_at on row modification
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER profiles_updated_at
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    -- Auto-create profile when a new user signs up via Supabase Auth
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.profiles (id, full_name, phone_number, role)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
        NEW.phone,
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'Client')
      );
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

    COMMENT ON TABLE public.profiles IS 
      'User profiles extending Supabase Auth users. Covers clients, barbers, and admins.';
  `
})
```

#### Migration 004 — Create `salons` Table

```typescript
// MCP Tool Call
mcp_supabase_execute_sql({
  query: `
    CREATE TABLE public.salons (
      id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      owner_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      name                TEXT NOT NULL,
      description         TEXT,
      wilaya              TEXT NOT NULL,              -- Algerian province (48 wilayas)
      address             TEXT NOT NULL,
      latitude            DOUBLE PRECISION NOT NULL,
      longitude           DOUBLE PRECISION NOT NULL,
      location            GEOGRAPHY(POINT, 4326),    -- PostGIS point for geo queries
      subscription_status subscription_status NOT NULL DEFAULT 'Trial',
      trial_ends_at       TIMESTAMPTZ,
      subscription_ends_at TIMESTAMPTZ,
      is_approved         BOOLEAN NOT NULL DEFAULT FALSE,  -- Admin must approve
      is_sponsored        BOOLEAN NOT NULL DEFAULT FALSE,
      sponsored_until     TIMESTAMPTZ,
      open_time           TIME NOT NULL DEFAULT '09:00',
      close_time          TIME NOT NULL DEFAULT '21:00',
      working_days        INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6], -- 0=Sun,6=Sat
      average_rating      NUMERIC(3,2) DEFAULT 0,
      total_reviews       INTEGER DEFAULT 0,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Auto-set PostGIS location from lat/lng
    CREATE OR REPLACE FUNCTION sync_salon_location()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::GEOGRAPHY;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER salon_location_sync
      BEFORE INSERT OR UPDATE OF latitude, longitude ON public.salons
      FOR EACH ROW EXECUTE FUNCTION sync_salon_location();

    CREATE TRIGGER salons_updated_at
      BEFORE UPDATE ON public.salons
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    -- Index for fast geolocation queries (find salons within X km)
    CREATE INDEX idx_salons_location ON public.salons USING GIST(location);
    -- Index for wilaya filtering
    CREATE INDEX idx_salons_wilaya ON public.salons(wilaya);
    -- Index for listing active sponsored salons first
    CREATE INDEX idx_salons_sponsored ON public.salons(is_sponsored, sponsored_until);

    COMMENT ON TABLE public.salons IS 
      'Barbershop/salon profiles. Managed by Coiffeur-role users, approved by Admin.';
    COMMENT ON COLUMN public.salons.wilaya IS 
      'Algerian province (wilaya). One of 58 administrative divisions.';
  `
})
```

#### Migration 005 — Create `services` Table

```typescript
// MCP Tool Call
mcp_supabase_execute_sql({
  query: `
    CREATE TABLE public.services (
      id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      salon_id         UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
      service_name     TEXT NOT NULL,
      description      TEXT,
      price            NUMERIC(10,2) NOT NULL,  -- Price in DZD
      duration_minutes INTEGER NOT NULL,         -- Used to generate time slots
      is_active        BOOLEAN NOT NULL DEFAULT TRUE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TRIGGER services_updated_at
      BEFORE UPDATE ON public.services
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    -- Index for fast service lookup by salon
    CREATE INDEX idx_services_salon_id ON public.services(salon_id);

    COMMENT ON TABLE public.services IS 
      'Services offered by a salon (e.g., Haircut 30min 500DZD, Beard Trim 20min 300DZD).';
    COMMENT ON COLUMN public.services.duration_minutes IS 
      'Duration in minutes. Frontend uses this to generate available time slots.';
  `
})
```

#### Migration 006 — Create `reservations` Table

```typescript
// MCP Tool Call
mcp_supabase_execute_sql({
  query: `
    CREATE TABLE public.reservations (
      id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      salon_id         UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
      service_id       UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
      barber_id        UUID REFERENCES public.profiles(id),  -- Optional: specific barber
      appointment_date DATE NOT NULL,
      start_time       TIME NOT NULL,
      end_time         TIME NOT NULL,
      status           reservation_status NOT NULL DEFAULT 'Pending',
      notes            TEXT,                -- Client notes for the barber
      cancelled_by     UUID REFERENCES public.profiles(id),
      cancel_reason    TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      -- Ensure end_time is always after start_time
      CONSTRAINT valid_time_range CHECK (end_time > start_time)
    );

    CREATE TRIGGER reservations_updated_at
      BEFORE UPDATE ON public.reservations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    -- Critical indexes for the overlap check trigger (performance)
    CREATE INDEX idx_reservations_salon_date 
      ON public.reservations(salon_id, appointment_date);
    CREATE INDEX idx_reservations_client_id 
      ON public.reservations(client_id);
    CREATE INDEX idx_reservations_status 
      ON public.reservations(status);
    CREATE INDEX idx_reservations_barber_id 
      ON public.reservations(barber_id);

    COMMENT ON TABLE public.reservations IS 
      'Appointment bookings. Protected by overlap trigger and RLS policies.';
  `
})
```

#### Migration 007 — Supporting Tables (Reviews, Portfolio, Staff)

```typescript
// MCP Tool Call
mcp_supabase_execute_sql({
  query: `
    -- ─────────────────────────────────────────────────
    -- Reviews & Ratings
    -- ─────────────────────────────────────────────────
    CREATE TABLE public.reviews (
      id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      reservation_id UUID NOT NULL UNIQUE REFERENCES public.reservations(id) ON DELETE CASCADE,
      client_id      UUID NOT NULL REFERENCES public.profiles(id),
      salon_id       UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
      rating         INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment        TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Auto-update salon average rating after a review is inserted
    CREATE OR REPLACE FUNCTION update_salon_rating()
    RETURNS TRIGGER AS $$
    BEGIN
      UPDATE public.salons
      SET 
        average_rating = (
          SELECT ROUND(AVG(rating)::NUMERIC, 2) 
          FROM public.reviews 
          WHERE salon_id = NEW.salon_id
        ),
        total_reviews = (
          SELECT COUNT(*) 
          FROM public.reviews 
          WHERE salon_id = NEW.salon_id
        )
      WHERE id = NEW.salon_id;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER after_review_insert
      AFTER INSERT ON public.reviews
      FOR EACH ROW EXECUTE FUNCTION update_salon_rating();

    CREATE INDEX idx_reviews_salon_id ON public.reviews(salon_id);

    -- ─────────────────────────────────────────────────
    -- Salon Photo Portfolio
    -- ─────────────────────────────────────────────────
    CREATE TABLE public.portfolio_photos (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      salon_id    UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
      uploader_id UUID NOT NULL REFERENCES public.profiles(id),
      storage_path TEXT NOT NULL,   -- Path in Supabase Storage bucket
      caption     TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_portfolio_salon_id ON public.portfolio_photos(salon_id);

    -- ─────────────────────────────────────────────────
    -- Multi-Staff Management (Barbers within a salon)
    -- ─────────────────────────────────────────────────
    CREATE TABLE public.salon_staff (
      id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      salon_id   UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
      profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      role       TEXT NOT NULL DEFAULT 'Barber',  -- e.g., 'Barber', 'Manager'
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(salon_id, profile_id)
    );

    CREATE INDEX idx_staff_salon_id ON public.salon_staff(salon_id);

    -- ─────────────────────────────────────────────────
    -- Loyalty Points Log
    -- ─────────────────────────────────────────────────
    CREATE TABLE public.loyalty_transactions (
      id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      reservation_id UUID REFERENCES public.reservations(id),
      points_delta   INTEGER NOT NULL,   -- Positive = earned, Negative = redeemed
      reason         TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_loyalty_client_id ON public.loyalty_transactions(client_id);
  `
})
```

---

### 5.3 Row Level Security Policies

```typescript
// MCP Tool Call: Enable RLS on all tables
mcp_supabase_execute_sql({
  query: `
    ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.salons             ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.services           ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.reservations       ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.reviews            ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.portfolio_photos   ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.salon_staff        ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
  `
})
```

#### Profiles RLS

```typescript
// MCP Tool Call
mcp_supabase_execute_sql({
  query: `
    -- Users can read their own profile
    CREATE POLICY "profiles_select_own"
      ON public.profiles FOR SELECT
      USING (auth.uid() = id);

    -- Users can update their own profile
    CREATE POLICY "profiles_update_own"
      ON public.profiles FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);

    -- Admins can read all profiles
    CREATE POLICY "profiles_select_admin"
      ON public.profiles FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE id = auth.uid() AND role = 'Admin'
        )
      );
  `
})
```

#### Salons RLS

```typescript
// MCP Tool Call
mcp_supabase_execute_sql({
  query: `
    -- Anyone (authenticated) can view approved salons
    CREATE POLICY "salons_select_approved"
      ON public.salons FOR SELECT
      USING (is_approved = TRUE OR owner_id = auth.uid());

    -- Barbers can insert their own salon
    CREATE POLICY "salons_insert_own"
      ON public.salons FOR INSERT
      WITH CHECK (
        owner_id = auth.uid() AND
        EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE id = auth.uid() AND role = 'Coiffeur'
        )
      );

    -- Barbers can update only their own salon
    CREATE POLICY "salons_update_own"
      ON public.salons FOR UPDATE
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());

    -- Admins can update any salon (approvals, subscription changes)
    CREATE POLICY "salons_update_admin"
      ON public.salons FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE id = auth.uid() AND role = 'Admin'
        )
      );
  `
})
```

#### Services RLS

```typescript
// MCP Tool Call
mcp_supabase_execute_sql({
  query: `
    -- Anyone can view services of approved salons
    CREATE POLICY "services_select_public"
      ON public.services FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.salons
          WHERE salons.id = services.salon_id AND salons.is_approved = TRUE
        )
      );

    -- Salon owner can manage their services
    CREATE POLICY "services_manage_owner"
      ON public.services FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.salons
          WHERE salons.id = services.salon_id AND salons.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.salons
          WHERE salons.id = services.salon_id AND salons.owner_id = auth.uid()
        )
      );
  `
})
```

#### Reservations RLS — CRITICAL

```typescript
// MCP Tool Call
mcp_supabase_execute_sql({
  query: `
    -- ╔══════════════════════════════════════════════════╗
    -- ║         RESERVATIONS RLS POLICIES                ║
    -- ║  This is the most security-critical section.     ║
    -- ╚══════════════════════════════════════════════════╝

    -- 1. Clients can SELECT only their own reservations
    CREATE POLICY "reservations_select_client_own"
      ON public.reservations FOR SELECT
      USING (client_id = auth.uid());

    -- 2. Barbers can SELECT reservations for their salon(s)
    CREATE POLICY "reservations_select_barber_salon"
      ON public.reservations FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.salons
          WHERE salons.id = reservations.salon_id 
          AND salons.owner_id = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1 FROM public.salon_staff
          WHERE salon_staff.salon_id = reservations.salon_id
          AND salon_staff.profile_id = auth.uid()
        )
      );

    -- 3. Clients can INSERT reservations for themselves
    CREATE POLICY "reservations_insert_client"
      ON public.reservations FOR INSERT
      WITH CHECK (
        client_id = auth.uid() AND
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'Client'
        )
      );

    -- 4. Clients can UPDATE (cancel) only their OWN PENDING reservations
    CREATE POLICY "reservations_update_client_cancel"
      ON public.reservations FOR UPDATE
      USING (
        client_id = auth.uid() AND 
        status = 'Pending'
      )
      WITH CHECK (
        client_id = auth.uid() AND
        status = 'Cancelled'   -- Clients can only transition to Cancelled
      );

    -- 5. Barbers can UPDATE status of reservations in their salon
    CREATE POLICY "reservations_update_barber"
      ON public.reservations FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.salons
          WHERE salons.id = reservations.salon_id
          AND salons.owner_id = auth.uid()
        )
      );

    -- 6. Admins can do anything
    CREATE POLICY "reservations_all_admin"
      ON public.reservations FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'Admin'
        )
      );
  `
})
```

---

### 5.4 Anti-Double-Booking Trigger

This is the **most critical backend safety mechanism**. It runs inside PostgreSQL before any reservation INSERT and will RAISE an exception if the time slot overlaps with an existing confirmed or pending booking.

```typescript
// MCP Tool Call: Create the overlap-check function and trigger
mcp_supabase_execute_sql({
  query: `
    -- ╔══════════════════════════════════════════════════════════════╗
    -- ║           ANTI-DOUBLE-BOOKING TRIGGER FUNCTION               ║
    -- ║                                                              ║
    -- ║  Overlap condition (standard interval logic):                ║
    -- ║  Two intervals [A_start, A_end) and [B_start, B_end) overlap ║
    -- ║  when: A_start < B_end AND A_end > B_start                  ║
    -- ╚══════════════════════════════════════════════════════════════╝

    CREATE OR REPLACE FUNCTION check_reservation_overlap()
    RETURNS TRIGGER AS $$
    DECLARE
      conflict_count INTEGER;
      conflict_id UUID;
    BEGIN
      -- Skip overlap check if reservation is being cancelled
      IF NEW.status = 'Cancelled' THEN
        RETURN NEW;
      END IF;

      -- Check for overlapping reservations
      -- A specific barber was chosen → check that barber's schedule
      -- No specific barber → check whole salon capacity (single-barber model)
      
      SELECT COUNT(*), MIN(id)
      INTO conflict_count, conflict_id
      FROM public.reservations
      WHERE
        salon_id         = NEW.salon_id
        AND appointment_date = NEW.appointment_date
        AND status        IN ('Confirmed', 'Pending')
        AND id            != COALESCE(NEW.id, uuid_generate_v4())  -- Exclude self on UPDATE
        AND (
          -- If a specific barber is requested, only check that barber's slots
          CASE
            WHEN NEW.barber_id IS NOT NULL THEN barber_id = NEW.barber_id
            ELSE TRUE  -- For salons without assigned barbers, check all slots
          END
        )
        AND (
          -- CORE OVERLAP FORMULA
          NEW.start_time < end_time 
          AND 
          NEW.end_time   > start_time
        );

      IF conflict_count > 0 THEN
        RAISE EXCEPTION
          'BOOKING_CONFLICT: Time slot % - % on % is already booked (conflicting reservation: %)',
          NEW.start_time,
          NEW.end_time,
          NEW.appointment_date,
          conflict_id
          USING ERRCODE = 'P0001';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Attach the trigger: fires BEFORE every INSERT or UPDATE on reservations
    CREATE TRIGGER prevent_double_booking
      BEFORE INSERT OR UPDATE ON public.reservations
      FOR EACH ROW
      EXECUTE FUNCTION check_reservation_overlap();

    COMMENT ON FUNCTION check_reservation_overlap() IS
      'Prevents double-booking by checking time slot overlap (start < end AND end > start).
       Applies per barber if barber_id is set, otherwise per salon.
       Raises SQLSTATE P0001 on conflict for clean error handling in NestJS.';
  `
})
```

#### How to Handle the Trigger Error in NestJS

```typescript
// services/api/src/reservations/reservations.service.ts

import { Injectable, ConflictException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class ReservationsService {
  async createReservation(dto: CreateReservationDto, userId: string) {
    const { data, error } = await this.supabase
      .from('reservations')
      .insert({
        client_id:        userId,
        salon_id:         dto.salonId,
        service_id:       dto.serviceId,
        barber_id:        dto.barberId ?? null,
        appointment_date: dto.appointmentDate,
        start_time:       dto.startTime,
        end_time:         dto.endTime,
        status:           'Pending',
      })
      .select()
      .single();

    if (error) {
      // PostgreSQL trigger raised SQLSTATE P0001 — booking conflict
      if (error.code === 'P0001' || error.message.includes('BOOKING_CONFLICT')) {
        throw new ConflictException(
          'This time slot is no longer available. Please select another.'
        );
      }
      throw new Error(`Reservation failed: ${error.message}`);
    }

    return data;
  }
}
```

---

### 5.5 Supabase Storage Buckets

```typescript
// MCP Tool Call: Create Storage Buckets
mcp_supabase_execute_sql({
  query: `
    -- Note: Storage buckets are typically created via the Supabase Dashboard
    -- or Management API, not plain SQL. Use MCP storage tool calls below.
  `
})

// MCP Tool Call: Create 'avatars' bucket (public profile pictures)
mcp_supabase_storage_create_bucket({
  name: "avatars",
  public: true,
  fileSizeLimit: 2097152,          // 2MB max
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"]
})

// MCP Tool Call: Create 'portfolios' bucket (salon haircut photos)
mcp_supabase_storage_create_bucket({
  name: "portfolios",
  public: true,
  fileSizeLimit: 5242880,          // 5MB max
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"]
})

// MCP Tool Call: Create 'salon-covers' bucket (salon hero/banner images)
mcp_supabase_storage_create_bucket({
  name: "salon-covers",
  public: true,
  fileSizeLimit: 5242880,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"]
})
```

Storage RLS (via SQL):

```typescript
// MCP Tool Call: Storage RLS Policies
mcp_supabase_execute_sql({
  query: `
    -- Avatars: users can only manage their own avatar
    CREATE POLICY "avatars_upload_own"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'avatars' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );

    CREATE POLICY "avatars_update_own"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'avatars' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );

    CREATE POLICY "avatars_delete_own"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'avatars' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );

    -- Portfolios: salon owners can manage their salon's photos
    CREATE POLICY "portfolios_manage_owner"
      ON storage.objects FOR ALL
      USING (
        bucket_id = 'portfolios' AND
        EXISTS (
          SELECT 1 FROM public.salons
          WHERE salons.owner_id = auth.uid()
          AND salons.id::text = (storage.foldername(name))[1]
        )
      );
  `
})
```

---

## 6. NestJS Backend — API Layer

### API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/auth/register` | Register new user | No |
| `POST` | `/auth/login` | Login with phone OTP | No |
| `GET` | `/salons` | List approved salons (filters: wilaya, rating, sponsored) | No |
| `GET` | `/salons/nearby` | Find salons within X km of lat/lng | No |
| `GET` | `/salons/:id` | Get salon details + services | No |
| `POST` | `/salons` | Create salon (Coiffeur only) | Yes (Coiffeur) |
| `PATCH` | `/salons/:id` | Update salon info | Yes (Owner) |
| `GET` | `/salons/:id/services` | List services for a salon | No |
| `POST` | `/salons/:id/services` | Add a service | Yes (Owner) |
| `GET` | `/slots` | Get available time slots for a date + service | Yes |
| `POST` | `/reservations` | Create a reservation | Yes (Client) |
| `GET` | `/reservations/me` | Client's own reservations | Yes (Client) |
| `GET` | `/reservations/salon/:id` | Barber sees their salon's bookings | Yes (Coiffeur) |
| `PATCH` | `/reservations/:id/status` | Update reservation status | Yes (Barber/Client) |
| `POST` | `/reviews` | Submit a review after Completed appointment | Yes (Client) |
| `GET` | `/admin/salons/pending` | List salons awaiting approval | Yes (Admin) |
| `PATCH` | `/admin/salons/:id/approve` | Approve or reject a salon | Yes (Admin) |

### Slot Generation Logic (NestJS Service)

```typescript
// services/api/src/slots/slots.service.ts

import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface TimeSlot {
  startTime: string;   // "09:00"
  endTime: string;     // "09:30"
  isAvailable: boolean;
}

@Injectable()
export class SlotsService {
  constructor(private readonly supabase: SupabaseService) {}

  async getAvailableSlots(
    salonId: string,
    serviceId: string,
    date: string,        // "2025-06-15"
    barberId?: string
  ): Promise<TimeSlot[]> {

    // 1. Get service duration and salon hours
    const [{ data: service }, { data: salon }] = await Promise.all([
      this.supabase.client
        .from('services')
        .select('duration_minutes')
        .eq('id', serviceId)
        .single(),
      this.supabase.client
        .from('salons')
        .select('open_time, close_time')
        .eq('id', salonId)
        .single(),
    ]);

    const duration = service.duration_minutes;  // e.g., 30
    const openTime  = salon.open_time;          // e.g., "09:00:00"
    const closeTime = salon.close_time;         // e.g., "21:00:00"

    // 2. Fetch all booked (Pending or Confirmed) slots for that date
    let query = this.supabase.client
      .from('reservations')
      .select('start_time, end_time')
      .eq('salon_id', salonId)
      .eq('appointment_date', date)
      .in('status', ['Pending', 'Confirmed']);

    if (barberId) {
      query = query.eq('barber_id', barberId);
    }

    const { data: bookedSlots } = await query;

    // 3. Generate all possible slots
    const allSlots = this.generateTimeSlots(openTime, closeTime, duration);

    // 4. Mark booked slots as unavailable
    return allSlots.map(slot => ({
      ...slot,
      isAvailable: !this.isSlotBooked(slot, bookedSlots ?? []),
    }));
  }

  private generateTimeSlots(
    openTime: string,
    closeTime: string,
    durationMinutes: number
  ): Omit<TimeSlot, 'isAvailable'>[] {
    const slots: Omit<TimeSlot, 'isAvailable'>[] = [];
    const open  = this.timeToMinutes(openTime);
    const close = this.timeToMinutes(closeTime);

    let current = open;
    while (current + durationMinutes <= close) {
      slots.push({
        startTime: this.minutesToTime(current),
        endTime:   this.minutesToTime(current + durationMinutes),
      });
      current += durationMinutes;  // Move by service duration (not fixed 30min)
    }

    return slots;
  }

  private isSlotBooked(
    slot: { startTime: string; endTime: string },
    bookedSlots: { start_time: string; end_time: string }[]
  ): boolean {
    const slotStart = this.timeToMinutes(slot.startTime);
    const slotEnd   = this.timeToMinutes(slot.endTime);

    return bookedSlots.some(booked => {
      const bookedStart = this.timeToMinutes(booked.start_time);
      const bookedEnd   = this.timeToMinutes(booked.end_time);
      // Standard interval overlap formula
      return slotStart < bookedEnd && slotEnd > bookedStart;
    });
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }
}
```

---

## 7. React Native Frontend — Dynamic UI

### 7.1 Dynamic Time Slot Generation

```typescript
// apps/mobile/src/components/SlotPicker.tsx

import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, FlatList } from 'react-native';
import { useSlotLock } from '../hooks/useSlotLock';

interface Slot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

interface SlotPickerProps {
  salonId: string;
  serviceId: string;
  selectedDate: string;
  barberId?: string;
  onSlotSelect: (slot: Slot) => void;
}

export const SlotPicker: React.FC<SlotPickerProps> = ({
  salonId,
  serviceId,
  selectedDate,
  barberId,
  onSlotSelect,
}) => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(false);
  const { lockedSlot, lockSlot, isLocked } = useSlotLock();

  useEffect(() => {
    if (salonId && serviceId && selectedDate) {
      fetchSlots();
    }
  }, [salonId, serviceId, selectedDate, barberId]);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        salonId, serviceId, date: selectedDate,
        ...(barberId && { barberId }),
      });
      const res = await fetch(`${API_URL}/slots?${params}`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      const data = await res.json();
      setSlots(data);
    } finally {
      setLoading(false);
    }
  };

  const handleSlotPress = (slot: Slot) => {
    if (!slot.isAvailable || isLocked(slot.startTime)) return;
    lockSlot(slot.startTime);          // Activate 5-minute front-end lock
    setSelectedSlot(slot);
    onSlotSelect(slot);
  };

  const getSlotStyle = (slot: Slot) => {
    if (!slot.isAvailable) return styles.slotBooked;
    if (selectedSlot?.startTime === slot.startTime) return styles.slotSelected;
    if (isLocked(slot.startTime)) return styles.slotLocked;
    return styles.slotAvailable;
  };

  const getSlotLabel = (slot: Slot) => {
    if (!slot.isAvailable) return `${slot.startTime} ✗`;
    if (isLocked(slot.startTime) && selectedSlot?.startTime !== slot.startTime)
      return `${slot.startTime} 🔒`;
    return slot.startTime;
  };

  return (
    <FlatList
      data={slots}
      numColumns={3}
      keyExtractor={(item) => item.startTime}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.slot, getSlotStyle(item)]}
          onPress={() => handleSlotPress(item)}
          disabled={!item.isAvailable}
        >
          <Text style={styles.slotText}>{getSlotLabel(item)}</Text>
        </TouchableOpacity>
      )}
    />
  );
};

const styles = StyleSheet.create({
  slot:           { flex: 1, margin: 4, padding: 10, borderRadius: 8, alignItems: 'center' },
  slotAvailable:  { backgroundColor: '#E8F5E9' },
  slotBooked:     { backgroundColor: '#EEEEEE' },     // Greyed out
  slotSelected:   { backgroundColor: '#2E7D32' },     // Dark green = selected
  slotLocked:     { backgroundColor: '#FFF9C4' },     // Yellow = locked by another user
  slotText:       { fontSize: 13, fontWeight: '600' },
});
```

---

### 7.2 Slot Locking (5-Minute Front-End Lock)

```typescript
// apps/mobile/src/hooks/useSlotLock.ts

import { useState, useCallback, useRef } from 'react';

const LOCK_DURATION_MS = 5 * 60 * 1000;  // 5 minutes

interface SlotLock {
  startTime: string;
  lockedAt: number;
  timerId: ReturnType<typeof setTimeout>;
}

export function useSlotLock() {
  const [lockedSlots, setLockedSlots] = useState<Map<string, SlotLock>>(new Map());
  const lockedSlotsRef = useRef(lockedSlots);
  lockedSlotsRef.current = lockedSlots;

  const lockSlot = useCallback((startTime: string) => {
    // Clear any existing lock on this slot
    const existing = lockedSlotsRef.current.get(startTime);
    if (existing) clearTimeout(existing.timerId);

    // Set a timer to auto-release after 5 minutes
    const timerId = setTimeout(() => {
      setLockedSlots(prev => {
        const next = new Map(prev);
        next.delete(startTime);
        return next;
      });
    }, LOCK_DURATION_MS);

    setLockedSlots(prev => new Map(prev).set(startTime, {
      startTime,
      lockedAt: Date.now(),
      timerId,
    }));
  }, []);

  const isLocked = useCallback((startTime: string): boolean => {
    const lock = lockedSlotsRef.current.get(startTime);
    if (!lock) return false;
    return (Date.now() - lock.lockedAt) < LOCK_DURATION_MS;
  }, []);

  const getRemainingLockTime = useCallback((startTime: string): number => {
    const lock = lockedSlotsRef.current.get(startTime);
    if (!lock) return 0;
    const elapsed = Date.now() - lock.lockedAt;
    return Math.max(0, LOCK_DURATION_MS - elapsed);
  }, []);

  const releaseLock = useCallback((startTime: string) => {
    const lock = lockedSlotsRef.current.get(startTime);
    if (lock) clearTimeout(lock.timerId);
    setLockedSlots(prev => {
      const next = new Map(prev);
      next.delete(startTime);
      return next;
    });
  }, []);

  return {
    lockSlot,
    isLocked,
    getRemainingLockTime,
    releaseLock,
    lockedSlot: lockedSlots.size > 0 ? [...lockedSlots.values()][0] : null,
  };
}
```

> **Note on Locking Strategy:** The 5-minute lock is purely front-end UX. It does not block other users from booking the same slot during the lock. The definitive race condition prevention is handled by the PostgreSQL trigger. A full distributed lock (e.g., using a Redis-backed lock table in Supabase) can be added in v2 if needed.

---

### 7.3 Supabase Realtime Integration

This enables barbers to receive instant notifications when a client books, cancels, or modifies an appointment — no polling required.

```typescript
// apps/mobile/src/lib/supabase.ts

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const ExpoSecureStoreAdapter = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
```

```typescript
// apps/mobile/src/hooks/useRealtimeBookings.ts

import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeOptions {
  salonId: string;
  onNewBooking?: (reservation: any) => void;
  onStatusChange?: (reservation: any) => void;
  onCancellation?: (reservation: any) => void;
}

export function useRealtimeBookings({
  salonId,
  onNewBooking,
  onStatusChange,
  onCancellation,
}: RealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!salonId) return;

    // Subscribe to all changes on reservations for this salon
    channelRef.current = supabase
      .channel(`salon-reservations:${salonId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'reservations',
          filter: `salon_id=eq.${salonId}`,
        },
        (payload) => {
          console.log('[Realtime] New booking:', payload.new);
          onNewBooking?.(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'reservations',
          filter: `salon_id=eq.${salonId}`,
        },
        (payload) => {
          const reservation = payload.new;
          if (reservation.status === 'Cancelled') {
            onCancellation?.(reservation);
          } else {
            onStatusChange?.(reservation);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to salon ${salonId} reservations`);
        }
      });

    // Cleanup on unmount or salonId change
    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [salonId]);
}
```

Usage in the Barber Dashboard screen:

```typescript
// apps/mobile/src/screens/barber/CalendarScreen.tsx

import { useRealtimeBookings } from '../../hooks/useRealtimeBookings';
import { scheduleLocalNotification } from '../../lib/notifications';

export const CalendarScreen = ({ salonId }: { salonId: string }) => {
  const [reservations, setReservations] = useState([]);

  useRealtimeBookings({
    salonId,
    onNewBooking: async (reservation) => {
      // 1. Add to local state (calendar updates instantly)
      setReservations(prev => [...prev, reservation]);

      // 2. Trigger a local push notification to the barber
      await scheduleLocalNotification({
        title: '💈 New Booking!',
        body:  `New appointment at ${reservation.start_time}`,
        data:  { reservationId: reservation.id },
      });
    },
    onCancellation: (reservation) => {
      setReservations(prev =>
        prev.map(r => r.id === reservation.id ? reservation : r)
      );
    },
  });

  // ... render calendar
};
```

---

## 8. Feature Implementation Roadmap

### Phase 1 — MVP (Months 1–2): Core Booking Loop

```
✅ Supabase schema + RLS + overlap trigger
✅ NestJS: Auth, Salons, Services, Slots, Reservations
✅ React Native: Salon list, Service selection, SlotPicker, Booking confirmation
✅ Barber Dashboard: Calendar view with Realtime updates
✅ Admin: Salon approval flow
```

### Phase 2 — Growth Features (Months 3–4)

```
☐ Geolocation: Mapbox "salons near me" screen
☐ Reviews & Ratings (auto-triggers salon rating update)
☐ Portfolio / Gallery upload to Supabase Storage
☐ Expo Push Notifications (appointment reminders 1hr before)
☐ Multi-staff selection (choose your barber)
☐ Subscription billing tracker in Admin dashboard
```

### Phase 3 — Retention & Monetization (Months 5–6)

```
☐ Loyalty Points System (earn on completion, redeem for discount)
☐ Client CRM for barbers (visit history, preferred services)
☐ Sponsored/Boosted profiles (Admin can activate, appear at top)
☐ Revenue & Statistics dashboard for barbers
☐ Analytics: booking trends, peak hours heatmap
```

---

## 9. Security Checklist

| Item | Status | Details |
|------|--------|---------|
| RLS on all tables | ✅ Required | Every table has RLS enabled with explicit policies |
| JWT verification | ✅ Required | All protected NestJS routes use Supabase JWT guard |
| Overlap trigger | ✅ Critical | Database-level enforcement, cannot be bypassed by client |
| Input validation | ✅ Required | NestJS DTOs with `class-validator` decorators |
| Rate limiting | ⚠️ Recommended | Implement on `/reservations` and `/auth` endpoints |
| HTTPS only | ✅ Required | Enforce on NestJS + Supabase (default on Supabase Cloud) |
| Phone OTP auth | ✅ Recommended | Supabase Auth supports SMS OTP for Algerian phone numbers |
| Service role key | ✅ Critical | NEVER expose service role key in mobile app — backend only |
| Anon key | ✅ Safe | Expo app can use anon key; RLS enforces data access |
| Storage policies | ✅ Required | Only salon owners can write to their storage paths |
| Admin role guard | ✅ Required | All `/admin/*` routes check for `role = 'Admin'` in DB |

---

## 10. Deployment Strategy

### Development

```bash
# Start Supabase locally (for schema development)
npx supabase start

# Start NestJS API
cd services/api && npm run start:dev

# Start Expo app
cd apps/mobile && npx expo start
```

### Staging / Production

```
┌─────────────────┐     ┌──────────────────────┐     ┌────────────────────┐
│  Expo EAS Build │     │   Railway / Render    │     │  Supabase Cloud    │
│  (iOS + Android)│────▶│   (NestJS Docker)     │────▶│  (Prod Project)    │
└─────────────────┘     └──────────────────────┘     └────────────────────┘
                                  │
                         GitHub Actions CI/CD
                         (test → build → deploy)
```

### Environment Variables

```bash
# NestJS API (.env)
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # Backend only — NEVER in mobile app
JWT_SECRET=your-jwt-secret

# Expo Mobile (.env)
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...      # Safe for client (RLS enforces access)
EXPO_PUBLIC_MAPBOX_TOKEN=pk.eyJ...
EXPO_PUBLIC_API_URL=https://your-api.railway.app
```

### NestJS Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/main"]
```

---

## Appendix — MCP Execution Order Summary

Execute these MCP tool calls in this exact sequence:

```
 1. mcp_supabase_connect(...)
 2. mcp_supabase_execute_sql → Enable extensions (uuid-ossp, postgis)
 3. mcp_supabase_execute_sql → Create ENUM types
 4. mcp_supabase_execute_sql → Create profiles table + trigger
 5. mcp_supabase_execute_sql → Create salons table + geo trigger + indexes
 6. mcp_supabase_execute_sql → Create services table + indexes
 7. mcp_supabase_execute_sql → Create reservations table + indexes
 8. mcp_supabase_execute_sql → Create reviews, portfolio, staff, loyalty tables
 9. mcp_supabase_execute_sql → Enable RLS on all tables
10. mcp_supabase_execute_sql → Create profiles RLS policies
11. mcp_supabase_execute_sql → Create salons RLS policies
12. mcp_supabase_execute_sql → Create services RLS policies
13. mcp_supabase_execute_sql → Create reservations RLS policies (critical)
14. mcp_supabase_execute_sql → Create anti-double-booking trigger (critical)
15. mcp_supabase_storage_create_bucket → 'avatars'
16. mcp_supabase_storage_create_bucket → 'portfolios'
17. mcp_supabase_storage_create_bucket → 'salon-covers'
18. mcp_supabase_execute_sql → Create storage RLS policies
```

---

*Document generated for BarberDZ Platform — Full-Stack Architecture & Execution Plan*
*Stack: React Native (Expo) · NestJS · Supabase (PostgreSQL + Realtime + Auth + Storage)*
*Market: Algeria 🇩🇿 | Model: Freemium → Subscription*
