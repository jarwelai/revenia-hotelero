-- Migration: create_property_amenities
-- Property-level amenities with categorization and i18n support.

CREATE TABLE IF NOT EXISTS property_amenities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'pool', 'business', 'wellness', 'dining', 'accessibility', 'outdoor', 'custom')),
  code TEXT NOT NULL,
  name_es TEXT NOT NULL,
  name_en TEXT NOT NULL,
  is_highlighted BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, code)
);

CREATE INDEX IF NOT EXISTS idx_property_amenities_property ON property_amenities(property_id);

ALTER TABLE property_amenities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pa_select' AND tablename = 'property_amenities') THEN
    CREATE POLICY pa_select ON property_amenities FOR SELECT
      USING (property_id IN (
        SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
        WHERE om.user_id = auth.uid()
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pa_insert' AND tablename = 'property_amenities') THEN
    CREATE POLICY pa_insert ON property_amenities FOR INSERT
      WITH CHECK (property_id IN (
        SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
        WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pa_update' AND tablename = 'property_amenities') THEN
    CREATE POLICY pa_update ON property_amenities FOR UPDATE
      USING (property_id IN (
        SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
        WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pa_delete' AND tablename = 'property_amenities') THEN
    CREATE POLICY pa_delete ON property_amenities FOR DELETE
      USING (property_id IN (
        SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
        WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pa_public_read' AND tablename = 'property_amenities') THEN
    CREATE POLICY pa_public_read ON property_amenities FOR SELECT TO anon USING (true);
  END IF;
END $$;
