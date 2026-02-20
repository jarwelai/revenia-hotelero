-- Sprint 2A: Config comercial, reglas de niños e impuestos
-- Tablas: property_commercial_settings, child_pricing_rules, tax_rules

CREATE TABLE property_commercial_settings (
  property_id          uuid PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
  currency             text NOT NULL DEFAULT 'USD',
  prices_include_taxes boolean NOT NULL DEFAULT false,
  charge_mode          text NOT NULL DEFAULT 'per_room',  -- per_room | per_person
  base_occupancy       int NOT NULL DEFAULT 2,
  extra_adult_fee      numeric(12,2) NOT NULL DEFAULT 0,
  child_policy_enabled boolean NOT NULL DEFAULT true,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  CHECK (charge_mode IN ('per_room', 'per_person')),
  CHECK (base_occupancy >= 1)
);

ALTER TABLE property_commercial_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pcs_select" ON property_commercial_settings FOR SELECT
  USING (property_id IN (
    SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid()
  ));
CREATE POLICY "pcs_upsert" ON property_commercial_settings FOR INSERT
  WITH CHECK (property_id IN (
    SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));
CREATE POLICY "pcs_update" ON property_commercial_settings FOR UPDATE
  USING (property_id IN (
    SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));

-- Reutiliza set_updated_at() definida en 20260218000009
CREATE TRIGGER pcs_updated_at BEFORE UPDATE ON property_commercial_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── child_pricing_rules ─────────────────────────────────────────────────────

CREATE TABLE child_pricing_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  min_age           int NOT NULL,
  max_age           int NOT NULL,
  fee_type          text NOT NULL DEFAULT 'fixed',   -- fixed | percent (MVP: solo fixed)
  fee_value         numeric(12,2) NOT NULL DEFAULT 0,
  applies_per_night boolean NOT NULL DEFAULT true,
  created_at        timestamptz DEFAULT now(),
  CHECK (max_age >= min_age),
  CHECK (fee_type IN ('fixed', 'percent'))
);

ALTER TABLE child_pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpr_select" ON child_pricing_rules FOR SELECT
  USING (property_id IN (
    SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid()
  ));
CREATE POLICY "cpr_insert" ON child_pricing_rules FOR INSERT
  WITH CHECK (property_id IN (
    SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));
CREATE POLICY "cpr_delete" ON child_pricing_rules FOR DELETE
  USING (property_id IN (
    SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));

CREATE INDEX idx_cpr_property ON child_pricing_rules(property_id);

-- ─── tax_rules ───────────────────────────────────────────────────────────────

CREATE TABLE tax_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name        text NOT NULL,
  type        text NOT NULL DEFAULT 'percent',   -- percent | fixed (MVP: solo percent)
  value       numeric(12,2) NOT NULL,
  applies_to  text NOT NULL DEFAULT 'total',     -- room | extras | total (MVP: 'total')
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  CHECK (type IN ('percent', 'fixed')),
  CHECK (applies_to IN ('room', 'extras', 'total'))
);

ALTER TABLE tax_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tr_select" ON tax_rules FOR SELECT
  USING (property_id IN (
    SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid()
  ));
CREATE POLICY "tr_insert" ON tax_rules FOR INSERT
  WITH CHECK (property_id IN (
    SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));
CREATE POLICY "tr_update" ON tax_rules FOR UPDATE
  USING (property_id IN (
    SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));
CREATE POLICY "tr_delete" ON tax_rules FOR DELETE
  USING (property_id IN (
    SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));

CREATE INDEX idx_tr_property ON tax_rules(property_id);
