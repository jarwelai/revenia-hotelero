-- Fase 2A: Tipos de habitación por propiedad
CREATE TABLE room_types (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id   UUID        REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  name          TEXT        NOT NULL,
  description   TEXT,
  max_occupancy INT         NOT NULL DEFAULT 2,
  base_price    NUMERIC(10,2),
  amenities_json JSONB     DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_types_select" ON room_types FOR SELECT
  USING (property_id IN (
    SELECT p.id FROM properties p
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid()
  ));

CREATE POLICY "room_types_insert" ON room_types FOR INSERT
  WITH CHECK (property_id IN (
    SELECT p.id FROM properties p
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));

CREATE POLICY "room_types_update" ON room_types FOR UPDATE
  USING (property_id IN (
    SELECT p.id FROM properties p
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));

CREATE POLICY "room_types_delete" ON room_types FOR DELETE
  USING (property_id IN (
    SELECT p.id FROM properties p
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));

CREATE INDEX idx_room_types_property_id ON room_types(property_id);
