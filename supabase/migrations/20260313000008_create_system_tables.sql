-- ============================================================================
-- Migration: create_system_tables
-- Purpose: Track system_secrets + super_admin_config tables
-- Safety: IF NOT EXISTS — does NOT destroy existing data
-- CRITICAL: system_secrets contains encrypted values — RLS mandatory
-- ============================================================================

-- ─── system_secrets ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.system_secrets (
  key              TEXT PRIMARY KEY,
  value_encrypted  TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ss_updated_at'
  ) THEN
    CREATE TRIGGER trg_ss_updated_at
      BEFORE UPDATE ON public.system_secrets
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- RLS — service role only, no user access
ALTER TABLE public.system_secrets ENABLE ROW LEVEL SECURITY;
-- No policies = only service role can access

-- ─── super_admin_config ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.super_admin_config (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id                  UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  ai_review_responses_enabled  BOOLEAN NOT NULL DEFAULT false,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_sac_property'
  ) THEN
    ALTER TABLE public.super_admin_config
      ADD CONSTRAINT uq_sac_property UNIQUE (property_id);
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Trigger for updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sac_updated_at'
  ) THEN
    CREATE TRIGGER trg_sac_updated_at
      BEFORE UPDATE ON public.super_admin_config
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- RLS — service role only (super admin ops are server-side)
ALTER TABLE public.super_admin_config ENABLE ROW LEVEL SECURITY;
-- No policies = only service role can access
