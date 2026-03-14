-- Migration: create_seasons
-- Metadata table grouping rate_plan_intervals into named seasons.
-- The quote engine resolves via rate_plan_intervals.priority — zero impact.

CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  pricing_overrides JSONB DEFAULT '{}'::jsonb,
  restrictions JSONB DEFAULT '{}'::jsonb,
  priority INT DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, name),
  CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_seasons_property ON seasons(property_id);
CREATE INDEX IF NOT EXISTS idx_seasons_dates ON seasons(property_id, start_date, end_date);

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'seasons_select' AND tablename = 'seasons') THEN
    CREATE POLICY seasons_select ON seasons FOR SELECT
      USING (property_id IN (
        SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
        WHERE om.user_id = auth.uid()
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'seasons_insert' AND tablename = 'seasons') THEN
    CREATE POLICY seasons_insert ON seasons FOR INSERT
      WITH CHECK (property_id IN (
        SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
        WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'seasons_update' AND tablename = 'seasons') THEN
    CREATE POLICY seasons_update ON seasons FOR UPDATE
      USING (property_id IN (
        SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
        WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'seasons_delete' AND tablename = 'seasons') THEN
    CREATE POLICY seasons_delete ON seasons FOR DELETE
      USING (property_id IN (
        SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
        WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
      ));
  END IF;
END $$;

ALTER TABLE rate_plan_intervals ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_seasons_updated_at') THEN
    CREATE TRIGGER trg_seasons_updated_at BEFORE UPDATE ON seasons
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
