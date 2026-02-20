-- Post-auditoría Fase 2A: Índices y constraints de integridad
-- Fix #3: Índices faltantes en bookings para queries de disponibilidad
CREATE INDEX idx_bookings_check_out ON bookings(check_out);
CREATE INDEX idx_bookings_status    ON bookings(status);

-- Fix #4: Eliminar índice duplicado en booking_nights
-- El UNIQUE constraint ya crea su propio btree (booking_nights_room_id_night_key)
DROP INDEX IF EXISTS idx_booking_nights_room_night;

-- Fix #5: Constraints de integridad de fechas
ALTER TABLE bookings
  ADD CONSTRAINT bookings_check_out_after_check_in
  CHECK (check_out > check_in);

ALTER TABLE external_reservations
  ADD CONSTRAINT ext_reservations_check_out_after_check_in
  CHECK (check_out > check_in);
