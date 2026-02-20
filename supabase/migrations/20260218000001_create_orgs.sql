-- Migration 1: create_orgs
-- Crea la tabla de organizaciones (tenants del SaaS).
-- La policy SELECT se agrega en la migración 2, después de que org_members exista.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE orgs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;

-- INSERT: cualquier usuario autenticado puede crear una org (necesario para el onboarding)
-- La policy SELECT se agrega en migration 2 cuando org_members ya existe.
CREATE POLICY "orgs_insert_authenticated" ON orgs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
