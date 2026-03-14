-- ============================================================================
-- Migration: schema_drift_fix
-- Purpose: Add columns that exist in TypeScript types but not in migrations
-- Safety: ADD COLUMN IF NOT EXISTS — does NOT destroy existing data
-- ============================================================================

-- ─── bookings: missing columns ────────────────────────────────────────────────

-- has_pets and pet_count (used in createInternalBooking + createCheckout)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS has_pets BOOLEAN DEFAULT false;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pet_count INT DEFAULT 0;

-- quote_payload (used in payment.ts for storing full quote snapshot)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS quote_payload JSONB;

-- ─── booking_nights: missing columns ──────────────────────────────────────────

-- base_rate and total_rate (used in createInternalBooking night snapshot)
ALTER TABLE public.booking_nights
  ADD COLUMN IF NOT EXISTS base_rate NUMERIC(12,2);

ALTER TABLE public.booking_nights
  ADD COLUMN IF NOT EXISTS total_rate NUMERIC(12,2);

-- extras_pets (used in createInternalBooking)
ALTER TABLE public.booking_nights
  ADD COLUMN IF NOT EXISTS extras_pets NUMERIC(12,2) DEFAULT 0;

-- is_active (used for soft-delete on cancel — critical for partial UNIQUE index)
ALTER TABLE public.booking_nights
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ─── booking_quotes: missing columns ──────────────────────────────────────────

-- has_pets and pet_count (used in public booking flow)
ALTER TABLE public.booking_quotes
  ADD COLUMN IF NOT EXISTS has_pets BOOLEAN DEFAULT false;

ALTER TABLE public.booking_quotes
  ADD COLUMN IF NOT EXISTS pet_count INT DEFAULT 0;

-- ─── property_commercial_settings: missing columns ────────────────────────────

-- pet_policy_enabled and pet_fee (used in settings + quote engine)
ALTER TABLE public.property_commercial_settings
  ADD COLUMN IF NOT EXISTS pet_policy_enabled BOOLEAN DEFAULT false;

ALTER TABLE public.property_commercial_settings
  ADD COLUMN IF NOT EXISTS pet_fee NUMERIC(12,2) DEFAULT 0;

-- ─── booking_nights: partial unique index for availability ────────────────────
-- Only active nights block the room. Cancelled nights (is_active=false) don't.

-- Drop the old UNIQUE constraint if it exists (it's a simple unique, not partial)
-- We need to replace it with a partial unique index
DO $$ BEGIN
  -- Check if the old constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_nights_room_id_night_key'
      AND conrelid = 'public.booking_nights'::regclass
  ) THEN
    ALTER TABLE public.booking_nights
      DROP CONSTRAINT booking_nights_room_id_night_key;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Create partial unique index (only active nights block the room)
CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_nights_active_room_night
  ON public.booking_nights(room_id, night)
  WHERE is_active = true;

-- ─── bookings: add pending_payment + expired + draft to status check ──────────

-- The original CHECK constraint only allows: hold, confirmed, cancelled, no_show
-- Code uses: hold, draft, pending_payment, confirmed, cancelled, expired, no_show
DO $$ BEGIN
  ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS bookings_status_check;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_status_check_v2'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_status_check_v2
      CHECK (status IN ('hold', 'draft', 'pending_payment', 'confirmed', 'cancelled', 'expired', 'no_show'));
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;
