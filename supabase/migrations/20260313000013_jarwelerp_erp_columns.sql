-- ============================================================================
-- Migration: jarwelerp_erp_columns
-- Purpose: Add ERP reference columns to existing tables for JarwelERP sync
-- Safety: ADD COLUMN IF NOT EXISTS — does NOT destroy existing data
-- ============================================================================

-- ─── bookings: ERP reference ──────────────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS erp_booking_id TEXT;

-- ─── properties: ERP reference ────────────────────────────────────────────────
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS erp_property_id TEXT;

-- ─── orgs: ERP reference ─────────────────────────────────────────────────────
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS erp_org_id TEXT;

-- ─── reviews: ERP reference for CRM linkage ──────────────────────────────────
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_guest_id
  ON public.reviews(guest_id);
