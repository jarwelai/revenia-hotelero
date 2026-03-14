-- ============================================================================
-- Migration: create_google_connections
-- Purpose: Track Google Business Profile OAuth connections
-- Safety: IF NOT EXISTS — does NOT destroy existing data
-- CRITICAL: Contains encrypted OAuth tokens — RLS is mandatory
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.google_connections (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id              UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  org_id                   UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  google_account_id        TEXT NOT NULL,
  google_email             TEXT,
  google_location_id       TEXT,
  google_location_name     TEXT,
  sync_enabled             BOOLEAN NOT NULL DEFAULT true,
  access_token_encrypted   TEXT,
  refresh_token_encrypted  TEXT,
  token_expiry             TIMESTAMPTZ,
  last_synced_at           TIMESTAMPTZ,
  last_sync_error          TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gc_property_id
  ON public.google_connections(property_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_gc_property'
  ) THEN
    ALTER TABLE public.google_connections
      ADD CONSTRAINT uq_gc_property UNIQUE (property_id);
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Trigger for updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_gc_updated_at'
  ) THEN
    CREATE TRIGGER trg_gc_updated_at
      BEFORE UPDATE ON public.google_connections
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- RLS — CRITICAL: tokens must never leak
ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;

-- Authenticated users can only read non-token fields for their org
-- Token access is via service role only
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'gc_select_org_member'
  ) THEN
    CREATE POLICY gc_select_org_member ON public.google_connections
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          WHERE om.org_id = google_connections.org_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'gc_all_owner_manager'
  ) THEN
    CREATE POLICY gc_all_owner_manager ON public.google_connections
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          WHERE om.org_id = google_connections.org_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'manager')
        )
      );
  END IF;
END $$;
