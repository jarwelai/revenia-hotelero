-- ============================================================================
-- Migration: create_rate_plan_intervals
-- Purpose: Track rate_plan_intervals table (ARI grid data)
-- Safety: IF NOT EXISTS — does NOT destroy existing data
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_plan_intervals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_type_id  UUID NOT NULL REFERENCES public.room_types(id) ON DELETE CASCADE,
  rate_plan_id  UUID NOT NULL REFERENCES public.rate_plans(id) ON DELETE CASCADE,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  dow_mask      INT NOT NULL DEFAULT 127, -- 1111111 = all days
  base_rate     NUMERIC(12,2) NOT NULL,
  min_los       INT DEFAULT 1,
  closed        BOOLEAN NOT NULL DEFAULT false,
  priority      INT NOT NULL DEFAULT 0,
  CONSTRAINT chk_rpi_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_rpi_property_id
  ON public.rate_plan_intervals(property_id);

CREATE INDEX IF NOT EXISTS idx_rpi_room_type_id
  ON public.rate_plan_intervals(room_type_id);

CREATE INDEX IF NOT EXISTS idx_rpi_rate_plan_id
  ON public.rate_plan_intervals(rate_plan_id);

CREATE INDEX IF NOT EXISTS idx_rpi_dates
  ON public.rate_plan_intervals(start_date, end_date);

-- RLS
ALTER TABLE public.rate_plan_intervals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'rpi_select_org_member'
  ) THEN
    CREATE POLICY rpi_select_org_member ON public.rate_plan_intervals
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          JOIN public.properties p ON p.org_id = om.org_id
          WHERE p.id = rate_plan_intervals.property_id
            AND om.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'rpi_all_owner_manager'
  ) THEN
    CREATE POLICY rpi_all_owner_manager ON public.rate_plan_intervals
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.org_members om
          JOIN public.properties p ON p.org_id = om.org_id
          WHERE p.id = rate_plan_intervals.property_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'manager')
        )
      );
  END IF;
END $$;
