-- Migration: create_property_services
-- Generic services table: restaurant, spa, bar, daypass, events, tours.

CREATE TABLE IF NOT EXISTS property_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL
    CHECK (service_type IN ('restaurant', 'spa', 'bar', 'daypass', 'events', 'tours', 'custom')),
  name TEXT NOT NULL,
  short_description_es TEXT,
  short_description_en TEXT,
  long_description_es TEXT,
  long_description_en TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, service_type, name)
);

CREATE INDEX IF NOT EXISTS idx_property_services_property ON property_services(property_id);

ALTER TABLE property_services ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_select' AND tablename = 'property_services') THEN
    CREATE POLICY ps_select ON property_services FOR SELECT
      USING (property_id IN (
        SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
        WHERE om.user_id = auth.uid()
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_insert' AND tablename = 'property_services') THEN
    CREATE POLICY ps_insert ON property_services FOR INSERT
      WITH CHECK (property_id IN (
        SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
        WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_update' AND tablename = 'property_services') THEN
    CREATE POLICY ps_update ON property_services FOR UPDATE
      USING (property_id IN (
        SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
        WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_delete' AND tablename = 'property_services') THEN
    CREATE POLICY ps_delete ON property_services FOR DELETE
      USING (property_id IN (
        SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
        WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ps_public_read' AND tablename = 'property_services') THEN
    CREATE POLICY ps_public_read ON property_services FOR SELECT TO anon USING (is_active = true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_property_services_updated_at') THEN
    CREATE TRIGGER trg_property_services_updated_at BEFORE UPDATE ON property_services
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
