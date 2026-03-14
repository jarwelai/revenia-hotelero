-- Migration: create_property_images
-- Unified image gallery with entity_type discriminator.

CREATE TABLE IF NOT EXISTS property_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL DEFAULT 'property'
    CHECK (entity_type IN ('property', 'room_type', 'service')),
  entity_id UUID,
  url TEXT NOT NULL,
  alt_text_es TEXT,
  alt_text_en TEXT,
  sort_order INT DEFAULT 0,
  is_hero BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_images_property ON property_images(property_id);
CREATE INDEX IF NOT EXISTS idx_property_images_entity ON property_images(entity_type, entity_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_images_hero
  ON property_images(property_id, entity_type, COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE is_hero = true;

ALTER TABLE property_images ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pi_select' AND tablename = 'property_images') THEN
    CREATE POLICY pi_select ON property_images FOR SELECT
      USING (property_id IN (
        SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
        WHERE om.user_id = auth.uid()
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pi_insert' AND tablename = 'property_images') THEN
    CREATE POLICY pi_insert ON property_images FOR INSERT
      WITH CHECK (property_id IN (
        SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
        WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pi_update' AND tablename = 'property_images') THEN
    CREATE POLICY pi_update ON property_images FOR UPDATE
      USING (property_id IN (
        SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
        WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pi_delete' AND tablename = 'property_images') THEN
    CREATE POLICY pi_delete ON property_images FOR DELETE
      USING (property_id IN (
        SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
        WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pi_public_read' AND tablename = 'property_images') THEN
    CREATE POLICY pi_public_read ON property_images FOR SELECT TO anon USING (true);
  END IF;
END $$;
