-- ============================================================================
-- Migration: jarwelerp_guests
-- Purpose: Create guests table — CRM foundation for JarwelERP compatibility
--
-- Design decisions:
--   - guests are org-scoped (not property-scoped) for CRM portability
--   - email is the natural dedup key within an org
--   - bookings.guest_id FK links reservations to guest records
--   - erp_customer_id reserved for future JarwelERP CRM sync
--   - existing bookings with inline guest data will be linked lazily
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.guests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  -- Identity
  full_name        TEXT NOT NULL,
  email            TEXT,
  phone            TEXT,
  country_iso2     TEXT,    -- ISO 3166-1 alpha-2
  language         TEXT,    -- preferred language (es, en, etc.)
  -- CRM fields
  notes            TEXT,
  tags             TEXT[] DEFAULT '{}',
  -- JarwelERP integration
  erp_customer_id  TEXT,    -- future link to JarwelERP CRM customer record
  -- Metadata
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guests_org_id
  ON public.guests(org_id);

CREATE INDEX IF NOT EXISTS idx_guests_email
  ON public.guests(email);

-- Unique email per org (for dedup)
CREATE UNIQUE INDEX IF NOT EXISTS uq_guests_org_email
  ON public.guests(org_id, email)
  WHERE email IS NOT NULL;

-- Trigger for updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_guests_updated_at'
  ) THEN
    CREATE TRIGGER trg_guests_updated_at
      BEFORE UPDATE ON public.guests
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- RLS
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'guests_select_org_member'
  ) THEN
    CREATE POLICY guests_select_org_member ON public.guests
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          WHERE om.org_id = guests.org_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'guests_all_org_member'
  ) THEN
    CREATE POLICY guests_all_org_member ON public.guests
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          WHERE om.org_id = guests.org_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ─── Link bookings to guests ──────────────────────────────────────────────────

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_guest_id
  ON public.bookings(guest_id);
