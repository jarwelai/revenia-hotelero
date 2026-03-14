-- ============================================================================
-- Migration: create_review_source_connections + review_publish_rules
-- Purpose: Track review integration tables
-- Safety: IF NOT EXISTS — does NOT destroy existing data
-- ============================================================================

-- ─── review_source_connections ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.review_source_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  org_id            UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  source            TEXT NOT NULL CHECK (source IN ('google', 'tripadvisor')),
  external_place_id TEXT NOT NULL,
  place_name        TEXT,
  place_url         TEXT,
  last_synced_at    TIMESTAMPTZ,
  last_sync_error   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rsc_property_id
  ON public.review_source_connections(property_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_rsc_property_source'
  ) THEN
    ALTER TABLE public.review_source_connections
      ADD CONSTRAINT uq_rsc_property_source UNIQUE (property_id, source);
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- RLS
ALTER TABLE public.review_source_connections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'rsc_select_org_member'
  ) THEN
    CREATE POLICY rsc_select_org_member ON public.review_source_connections
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          WHERE om.org_id = review_source_connections.org_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'rsc_all_owner_manager'
  ) THEN
    CREATE POLICY rsc_all_owner_manager ON public.review_source_connections
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          WHERE om.org_id = review_source_connections.org_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'manager')
        )
      );
  END IF;
END $$;

-- ─── review_publish_rules ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.review_publish_rules (
  property_id           UUID PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  auto_publish_enabled  BOOLEAN NOT NULL DEFAULT false,
  min_rating            INT NOT NULL DEFAULT 4 CHECK (min_rating BETWEEN 1 AND 5),
  auto_publish_sources  TEXT[] NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_rpr_updated_at'
  ) THEN
    CREATE TRIGGER trg_rpr_updated_at
      BEFORE UPDATE ON public.review_publish_rules
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- RLS
ALTER TABLE public.review_publish_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'rpr_select_org_member'
  ) THEN
    CREATE POLICY rpr_select_org_member ON public.review_publish_rules
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          JOIN public.properties p ON p.org_id = om.org_id
          WHERE p.id = review_publish_rules.property_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'rpr_all_owner_manager'
  ) THEN
    CREATE POLICY rpr_all_owner_manager ON public.review_publish_rules
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          JOIN public.properties p ON p.org_id = om.org_id
          WHERE p.id = review_publish_rules.property_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'manager')
        )
      );
  END IF;
END $$;
