-- ============================================================================
-- Migration: jarwelerp_ledger_entries
-- Purpose: Financial ledger for JarwelERP accounting compatibility
--
-- Design:
--   - Every financial movement creates a ledger entry
--   - Double-entry compatible: each entry has a category (revenue, tax, fee)
--   - Links to booking + payment_session for full traceability
--   - erp_journal_id reserved for JarwelERP GL sync
--   - Immutable: entries are never updated, only appended (reversals are new entries)
--
-- This table allows JarwelERP to:
--   - Generate accounts receivable reports
--   - Feed general ledger
--   - Reconcile payments vs revenue
--   - Generate tax reports by jurisdiction
--   - Track revenue by property, room type, rate plan
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  property_id        UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  -- Source reference
  booking_id         UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  payment_session_id UUID REFERENCES public.payment_sessions(id) ON DELETE SET NULL,
  -- Entry classification
  entry_type         TEXT NOT NULL
                     CHECK (entry_type IN (
                       'revenue',           -- room revenue
                       'tax',               -- tax collected
                       'extra_adult',        -- extra adult fee
                       'extra_child',        -- child fee
                       'extra_pet',          -- pet fee
                       'payment_received',   -- payment from guest
                       'refund',             -- refund to guest
                       'adjustment',         -- manual adjustment
                       'commission'          -- channel commission (future)
                     )),
  -- Financial data
  amount             NUMERIC(12,2) NOT NULL,
  currency           TEXT NOT NULL DEFAULT 'USD',
  -- Classification for accounting
  description        TEXT,
  night              DATE,          -- which night this entry relates to (for per-night revenue)
  tax_rule_name      TEXT,          -- which tax rule generated this entry
  -- JarwelERP integration
  erp_journal_id     TEXT,          -- future link to JarwelERP General Ledger
  erp_account_code   TEXT,          -- future: GL account code mapping
  -- Metadata
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_le_org_id
  ON public.ledger_entries(org_id);

CREATE INDEX IF NOT EXISTS idx_le_property_id
  ON public.ledger_entries(property_id);

CREATE INDEX IF NOT EXISTS idx_le_booking_id
  ON public.ledger_entries(booking_id);

CREATE INDEX IF NOT EXISTS idx_le_payment_session_id
  ON public.ledger_entries(payment_session_id);

CREATE INDEX IF NOT EXISTS idx_le_entry_type
  ON public.ledger_entries(entry_type);

CREATE INDEX IF NOT EXISTS idx_le_created_at
  ON public.ledger_entries(created_at);

-- RLS
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'le_select_org_member'
  ) THEN
    CREATE POLICY le_select_org_member ON public.ledger_entries
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          WHERE om.org_id = ledger_entries.org_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Writes are service-role only (ledger entries created by server actions)
