-- ============================================================================
-- Migration: create_rate_plans
-- Purpose: Track rate_plans table that exists in live DB but lacks versioned DDL
-- Safety: IF NOT EXISTS — does NOT destroy existing data
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  code        TEXT NOT NULL DEFAULT 'BAR',
  name        TEXT NOT NULL DEFAULT 'Best Available Rate',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for property lookup
CREATE INDEX IF NOT EXISTS idx_rate_plans_property_id
  ON public.rate_plans(property_id);

-- Unique constraint: one code per property
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_rate_plans_property_code'
  ) THEN
    ALTER TABLE public.rate_plans
      ADD CONSTRAINT uq_rate_plans_property_code UNIQUE (property_id, code);
  END IF;
END $$;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_rate_plans_updated_at'
  ) THEN
    CREATE TRIGGER trg_rate_plans_updated_at
      BEFORE UPDATE ON public.rate_plans
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- RLS
ALTER TABLE public.rate_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'rate_plans_select_org_member'
  ) THEN
    CREATE POLICY rate_plans_select_org_member ON public.rate_plans
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          JOIN public.properties p ON p.org_id = om.org_id
          WHERE p.id = rate_plans.property_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'rate_plans_insert_owner_manager'
  ) THEN
    CREATE POLICY rate_plans_insert_owner_manager ON public.rate_plans
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.org_members om
          JOIN public.properties p ON p.org_id = om.org_id
          WHERE p.id = rate_plans.property_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'manager')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'rate_plans_update_owner_manager'
  ) THEN
    CREATE POLICY rate_plans_update_owner_manager ON public.rate_plans
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          JOIN public.properties p ON p.org_id = om.org_id
          WHERE p.id = rate_plans.property_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'manager')
        )
      );
  END IF;
END $$;
