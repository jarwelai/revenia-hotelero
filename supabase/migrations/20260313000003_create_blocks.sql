-- ============================================================================
-- Migration: create_blocks
-- Purpose: Track blocks table (manual room closures)
-- Safety: IF NOT EXISTS — does NOT destroy existing data
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_id     UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_blocks_dates CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_blocks_property_id
  ON public.blocks(property_id);

CREATE INDEX IF NOT EXISTS idx_blocks_room_id
  ON public.blocks(room_id);

CREATE INDEX IF NOT EXISTS idx_blocks_dates
  ON public.blocks(start_date, end_date);

-- RLS
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'blocks_select_org_member'
  ) THEN
    CREATE POLICY blocks_select_org_member ON public.blocks
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          JOIN public.properties p ON p.org_id = om.org_id
          WHERE p.id = blocks.property_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'blocks_insert_owner_manager'
  ) THEN
    CREATE POLICY blocks_insert_owner_manager ON public.blocks
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.org_members om
          JOIN public.properties p ON p.org_id = om.org_id
          WHERE p.id = blocks.property_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'manager')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'blocks_delete_owner_manager'
  ) THEN
    CREATE POLICY blocks_delete_owner_manager ON public.blocks
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          JOIN public.properties p ON p.org_id = om.org_id
          WHERE p.id = blocks.property_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'manager')
        )
      );
  END IF;
END $$;
