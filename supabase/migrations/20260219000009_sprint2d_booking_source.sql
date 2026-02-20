-- Agregar 'direct' como fuente válida de reserva pública
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_source_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_source_check
  CHECK (source IN ('internal', 'ical', 'direct'));
