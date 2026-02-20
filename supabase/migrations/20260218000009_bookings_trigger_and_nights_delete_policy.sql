-- Post-auditoría Fase 2A: Bloqueadores críticos
-- Fix #1: Trigger para mantener updated_at actualizado en bookings
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_set_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Fix #2: Policy DELETE en booking_nights (necesaria para flujo de cancelación)
CREATE POLICY "booking_nights_delete" ON booking_nights FOR DELETE
  USING (booking_id IN (
    SELECT b.id FROM bookings b
    JOIN properties p ON p.id = b.property_id
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid()
  ));
