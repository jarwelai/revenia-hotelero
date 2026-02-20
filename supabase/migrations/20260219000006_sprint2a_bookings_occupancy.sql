-- Sprint 2A: Snapshot financiero en bookings — columnas de ocupación y desglose
-- Nota: total_amount ya existe, se usa para grand_total
ALTER TABLE bookings
  ADD COLUMN adults         int,
  ADD COLUMN children_count int,
  ADD COLUMN subtotal       numeric(12,2),
  ADD COLUMN taxes_total    numeric(12,2);
