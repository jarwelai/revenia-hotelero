-- Migration 007: property_public_settings + public_content_slots + public_content_translations

CREATE TABLE property_public_settings (
  property_id       uuid PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,
  default_lang      text NOT NULL DEFAULT 'es',
  supported_langs   text[] NOT NULL DEFAULT ARRAY['es', 'en'],
  public_brand_name text NULL,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  CHECK (default_lang IN ('es', 'en'))
);
ALTER TABLE property_public_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pps_select" ON property_public_settings FOR SELECT
  USING (property_id IN (
    SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid()
  ));
CREATE POLICY "pps_insert" ON property_public_settings FOR INSERT
  WITH CHECK (property_id IN (
    SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));
CREATE POLICY "pps_update" ON property_public_settings FOR UPDATE
  USING (property_id IN (
    SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));

CREATE TRIGGER pps_updated_at
  BEFORE UPDATE ON property_public_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── public_content_slots ────────────────────────────────────────────────────

CREATE TABLE public_content_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  key         text NOT NULL,
  source_lang text NOT NULL DEFAULT 'es',
  status      text NOT NULL DEFAULT 'draft',
  approved_at timestamptz NULL,
  approved_by uuid NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(property_id, key),
  CHECK (source_lang IN ('es', 'en')),
  CHECK (status IN ('draft', 'approved'))
);
ALTER TABLE public_content_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pcslot_select" ON public_content_slots FOR SELECT
  USING (property_id IN (
    SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid()
  ));
CREATE POLICY "pcslot_insert" ON public_content_slots FOR INSERT
  WITH CHECK (property_id IN (
    SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));
CREATE POLICY "pcslot_update" ON public_content_slots FOR UPDATE
  USING (property_id IN (
    SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));
CREATE POLICY "pcslot_delete" ON public_content_slots FOR DELETE
  USING (property_id IN (
    SELECT p.id FROM properties p JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));

CREATE TRIGGER pcslot_updated_at
  BEFORE UPDATE ON public_content_slots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_pcslot_property ON public_content_slots(property_id);

-- ─── public_content_translations ─────────────────────────────────────────────

CREATE TABLE public_content_translations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id     uuid NOT NULL REFERENCES public_content_slots(id) ON DELETE CASCADE,
  lang        text NOT NULL,
  text        text NOT NULL,
  status      text NOT NULL DEFAULT 'draft',
  approved_at timestamptz NULL,
  approved_by uuid NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(slot_id, lang),
  CHECK (lang IN ('es', 'en')),
  CHECK (status IN ('draft', 'approved'))
);
ALTER TABLE public_content_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pctran_select" ON public_content_translations FOR SELECT
  USING (slot_id IN (
    SELECT s.id FROM public_content_slots s
    JOIN properties p ON p.id = s.property_id
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid()
  ));
CREATE POLICY "pctran_insert" ON public_content_translations FOR INSERT
  WITH CHECK (slot_id IN (
    SELECT s.id FROM public_content_slots s
    JOIN properties p ON p.id = s.property_id
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));
CREATE POLICY "pctran_update" ON public_content_translations FOR UPDATE
  USING (slot_id IN (
    SELECT s.id FROM public_content_slots s
    JOIN properties p ON p.id = s.property_id
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));
CREATE POLICY "pctran_delete" ON public_content_translations FOR DELETE
  USING (slot_id IN (
    SELECT s.id FROM public_content_slots s
    JOIN properties p ON p.id = s.property_id
    JOIN org_members om ON om.org_id = p.org_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager')
  ));

CREATE TRIGGER pctran_updated_at
  BEFORE UPDATE ON public_content_translations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_pctran_slot ON public_content_translations(slot_id);
