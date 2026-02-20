-- Post-auditoría Fase 2A: RLS hardening en bookings
-- Valida que room_id (si está presente) pertenezca a la misma property_id del booking

DROP POLICY "bookings_insert" ON bookings;

-- NOTA: EXISTS con r.property_id = property_id causa self-comparison por ambigüedad
-- de nombres en PostgreSQL. Se usa subquery escalar para resolverlo correctamente.
CREATE POLICY "bookings_insert" ON bookings FOR INSERT
  WITH CHECK (
    -- 1. property_id del row debe pertenecer al usuario autenticado
    property_id IN (
      SELECT p.id FROM properties p
      JOIN org_members om ON om.org_id = p.org_id
      WHERE om.user_id = auth.uid()
    )
    AND
    -- 2. Si room_id está presente, su property_id debe coincidir con el del booking
    (
      room_id IS NULL
      OR (SELECT r.property_id FROM rooms r WHERE r.id = room_id) = property_id
    )
  );
