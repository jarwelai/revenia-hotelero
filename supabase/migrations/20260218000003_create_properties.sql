-- Migration 3: create_properties
-- Crea la tabla de propiedades (hoteles) por organización.
-- Todas las queries se scopean por property_id para aislamiento de datos.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Guatemala',
  currency TEXT NOT NULL DEFAULT 'USD',
  policies_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- SELECT: miembros de la org pueden ver sus propiedades
CREATE POLICY "properties_select_for_members" ON properties
  FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
  ));

-- INSERT: solo owners y managers pueden crear propiedades
CREATE POLICY "properties_insert_for_owners" ON properties
  FOR INSERT
  WITH CHECK (org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
  ));

-- UPDATE: solo owners y managers pueden actualizar propiedades
CREATE POLICY "properties_update_for_owners" ON properties
  FOR UPDATE
  USING (org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
  ));
