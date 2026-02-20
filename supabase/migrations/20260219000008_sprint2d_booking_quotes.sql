CREATE TABLE booking_quotes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_id       uuid NULL,
  room_type_id  uuid NULL,
  rate_plan_id  uuid NULL,
  check_in      date NOT NULL,
  check_out     date NOT NULL,
  adults        int NOT NULL,
  children_ages int[] NOT NULL DEFAULT '{}',
  lang          text NOT NULL DEFAULT 'es',
  quote_payload jsonb NOT NULL,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz DEFAULT now(),
  CHECK (lang IN ('es', 'en'))
);
ALTER TABLE booking_quotes ENABLE ROW LEVEL SECURITY;

-- SELECT solo para org members (admin dashboard). Escrituras via service client server-side.
CREATE POLICY "bq_select_member" ON booking_quotes FOR SELECT
  USING (property_id IN (
    SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid()
  ));

CREATE INDEX idx_bq_property_created ON booking_quotes(property_id, created_at DESC);
CREATE INDEX idx_bq_expires ON booking_quotes(expires_at);
