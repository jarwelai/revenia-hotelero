-- Fase 2A: Reservas externas parseadas de iCal (MotoPress / OTAs)
CREATE TABLE external_reservations (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id      UUID        REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  provider     TEXT        NOT NULL DEFAULT 'ical',
  external_uid TEXT        NOT NULL,
  check_in     DATE        NOT NULL,
  check_out    DATE        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'confirmed'
                 CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
  raw_hash     TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, external_uid)
);

ALTER TABLE external_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ext_reservations_select" ON external_reservations FOR SELECT
  USING (room_id IN (
    SELECT r.id FROM rooms r
    JOIN properties p ON p.id = r.property_id
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid()
  ));

CREATE POLICY "ext_reservations_insert" ON external_reservations FOR INSERT
  WITH CHECK (room_id IN (
    SELECT r.id FROM rooms r
    JOIN properties p ON p.id = r.property_id
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid()
  ));

CREATE POLICY "ext_reservations_update" ON external_reservations FOR UPDATE
  USING (room_id IN (
    SELECT r.id FROM rooms r
    JOIN properties p ON p.id = r.property_id
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid()
  ));

CREATE INDEX idx_ext_res_room_id ON external_reservations(room_id);
CREATE INDEX idx_ext_res_check_in ON external_reservations(check_in);
CREATE INDEX idx_ext_res_check_out ON external_reservations(check_out);
