-- Fase 2A: Unidades vendibles (1 unit = 1 iCal = 1 accommodation_id MotoPress)
CREATE TABLE rooms (
  id                          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id                 UUID        REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  room_type_id                UUID        REFERENCES room_types(id) ON DELETE SET NULL,
  name                        TEXT        NOT NULL,
  motopress_accommodation_id  INT,
  ical_url                    TEXT,
  sync_enabled                BOOLEAN     NOT NULL DEFAULT true,
  sync_status                 TEXT        NOT NULL DEFAULT 'never'
                                CHECK (sync_status IN ('ok', 'error', 'stale', 'never')),
  last_synced_at              TIMESTAMPTZ,
  last_sync_error             TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_select" ON rooms FOR SELECT
  USING (property_id IN (
    SELECT p.id FROM properties p
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid()
  ));

CREATE POLICY "rooms_insert" ON rooms FOR INSERT
  WITH CHECK (property_id IN (
    SELECT p.id FROM properties p
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));

CREATE POLICY "rooms_update" ON rooms FOR UPDATE
  USING (property_id IN (
    SELECT p.id FROM properties p
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));

CREATE POLICY "rooms_delete" ON rooms FOR DELETE
  USING (property_id IN (
    SELECT p.id FROM properties p
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));

CREATE INDEX idx_rooms_property_id ON rooms(property_id);
CREATE INDEX idx_rooms_room_type_id ON rooms(room_type_id);
