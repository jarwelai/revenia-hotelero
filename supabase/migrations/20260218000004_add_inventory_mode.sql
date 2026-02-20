-- Fase 2A: Agrega inventory_mode a properties
-- 'unit' = cada habitación es una unidad vendible con su propio iCal
-- 'aggregated' = habitaciones de un mismo tipo comparten disponibilidad (reservado para futuro)
ALTER TABLE properties
  ADD COLUMN inventory_mode TEXT NOT NULL DEFAULT 'unit'
  CHECK (inventory_mode IN ('unit', 'aggregated'));
