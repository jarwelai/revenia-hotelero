-- Migration 2: create_org_members
-- Crea la tabla de miembros de organizaciones.
-- También agrega la policy SELECT de orgs (ahora que org_members existe).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE org_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('owner', 'manager', 'staff')) NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

-- SELECT: cada usuario puede ver sus propias membresías
CREATE POLICY "org_members_select" ON org_members
  FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: solo de propias membresías (para onboarding)
CREATE POLICY "org_members_insert_own" ON org_members
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Ahora que org_members existe, se agrega la policy SELECT de orgs
CREATE POLICY "orgs_select_for_members" ON orgs
  FOR SELECT
  USING (id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
  ));
