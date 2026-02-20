-- Fase 2A: Reservas internas Revenia + tabla de noches para disponibilidad
CREATE TABLE bookings (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id         UUID        REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  room_id             UUID        REFERENCES rooms(id) ON DELETE SET NULL,
  guest_name          TEXT        NOT NULL,
  guest_email         TEXT,
  guest_phone         TEXT,
  check_in            DATE        NOT NULL,
  check_out           DATE        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'hold'
                        CHECK (status IN ('hold', 'confirmed', 'cancelled', 'no_show')),
  total_amount        NUMERIC(10,2),
  currency            TEXT        NOT NULL DEFAULT 'USD',
  notes               TEXT,
  -- Campos para futura integración MotoPress bridge (Fase 2B)
  motopress_booking_id INT,
  push_status         TEXT        NOT NULL DEFAULT 'not_pushed'
                        CHECK (push_status IN ('not_pushed', 'pending', 'pushed', 'failed')),
  push_last_error     TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_select" ON bookings FOR SELECT
  USING (property_id IN (
    SELECT p.id FROM properties p
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid()
  ));

CREATE POLICY "bookings_insert" ON bookings FOR INSERT
  WITH CHECK (property_id IN (
    SELECT p.id FROM properties p
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid()
  ));

CREATE POLICY "bookings_update" ON bookings FOR UPDATE
  USING (property_id IN (
    SELECT p.id FROM properties p
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid()
  ));

CREATE INDEX idx_bookings_property_id ON bookings(property_id);
CREATE INDEX idx_bookings_room_id ON bookings(room_id);
CREATE INDEX idx_bookings_check_in ON bookings(check_in);

-- Tabla de noches reservadas para queries de disponibilidad O(1)
CREATE TABLE booking_nights (
  id         UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID  REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  room_id    UUID  REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  night      DATE  NOT NULL,
  UNIQUE(room_id, night)
);

ALTER TABLE booking_nights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_nights_select" ON booking_nights FOR SELECT
  USING (booking_id IN (
    SELECT b.id FROM bookings b
    JOIN properties p ON p.id = b.property_id
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid()
  ));

CREATE POLICY "booking_nights_insert" ON booking_nights FOR INSERT
  WITH CHECK (booking_id IN (
    SELECT b.id FROM bookings b
    JOIN properties p ON p.id = b.property_id
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid()
  ));

CREATE INDEX idx_booking_nights_room_night ON booking_nights(room_id, night);
