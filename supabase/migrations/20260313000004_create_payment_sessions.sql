-- ============================================================================
-- Migration: create_payment_sessions
-- Purpose: Track payment_sessions table (payment state machine)
-- Safety: IF NOT EXISTS — does NOT destroy existing data
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payment_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id         UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  booking_id          UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL CHECK (provider IN ('recurrente', 'stripe', 'manual', 'property')),
  status              TEXT NOT NULL DEFAULT 'created'
                      CHECK (status IN ('created', 'pending', 'paid', 'failed', 'expired', 'cancelled')),
  amount              NUMERIC(12,2) NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'USD',
  provider_reference  TEXT,
  checkout_url        TEXT,
  -- JarwelERP: external reference for ERP reconciliation
  erp_reference       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ps_property_id
  ON public.payment_sessions(property_id);

CREATE INDEX IF NOT EXISTS idx_ps_booking_id
  ON public.payment_sessions(booking_id);

CREATE INDEX IF NOT EXISTS idx_ps_status
  ON public.payment_sessions(status);

-- Trigger for updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_sessions_updated_at'
  ) THEN
    CREATE TRIGGER trg_payment_sessions_updated_at
      BEFORE UPDATE ON public.payment_sessions
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- RLS
ALTER TABLE public.payment_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'ps_select_org_member'
  ) THEN
    CREATE POLICY ps_select_org_member ON public.payment_sessions
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          JOIN public.properties p ON p.org_id = om.org_id
          WHERE p.id = payment_sessions.property_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Service role handles INSERT/UPDATE (payment flow is server-side)
