-- Sprint 2A: Snapshot financiero por noche — columnas de ocupación
ALTER TABLE booking_nights
  ADD COLUMN adults          int,
  ADD COLUMN children_count  int,
  ADD COLUMN extras_adults   numeric(12,2),
  ADD COLUMN extras_children numeric(12,2),
  ADD COLUMN taxes           numeric(12,2);
