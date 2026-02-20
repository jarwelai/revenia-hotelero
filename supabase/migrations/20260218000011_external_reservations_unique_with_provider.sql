-- Post-auditoría Fase 2A: UNIQUE en external_reservations incluye provider
-- Previene colisiones de UID entre distintos proveedores (Airbnb, Booking.com, etc.)

-- 1. Eliminar constraint anterior (también elimina su índice automático)
ALTER TABLE external_reservations
  DROP CONSTRAINT external_reservations_room_id_external_uid_key;

-- 2. Crear nuevo constraint con provider incluido
ALTER TABLE external_reservations
  ADD CONSTRAINT external_reservations_room_provider_uid_key
  UNIQUE (room_id, provider, external_uid);
