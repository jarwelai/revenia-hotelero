-- =============================================================================
-- Sync Migration: properties.public_key
--
-- El campo public_key fue añadido directamente en Supabase sin migración
-- versionada. Esta migración sincroniza el schema del repositorio con la
-- base de datos real.
--
-- PROPÓSITO:
--   Cerrar el drift entre DB real (Supabase) y migraciones del repo.
--   El campo es la clave pública de cada propiedad, usada como token de URL
--   para las rutas públicas: /p/[publicKey]/book, /checkout, /confirmed, etc.
--
-- SEGURIDAD:
--   - 100% idempotente: segura para ejecutar aunque el campo ya exista.
--   - Sin downtime: ADD COLUMN IF NOT EXISTS y CREATE INDEX IF NOT EXISTS
--     son operaciones no bloqueantes.
--   - No modifica datos existentes (solo backfill de NULL, que no existen).
--
-- SCOPE:
--   Solo modifica la tabla `properties`. No toca ninguna otra tabla.
--   No modifica lógica de negocio, triggers, ni RLS existente.
-- =============================================================================

-- ─── 1. Agregar columna (NO-OP si ya existe) ─────────────────────────────────
--
-- DEFAULT gen_random_uuid()::text garantiza que nuevas propiedades creadas
-- vía onboarding reciban un public_key automáticamente, sin depender de la
-- capa de aplicación.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS public_key TEXT DEFAULT gen_random_uuid()::text;

-- ─── 2. Backfill — safety net ─────────────────────────────────────────────────
--
-- En producción no hay filas con NULL (1 propiedad con valor válido).
-- Este UPDATE es defensivo para entornos de staging/dev donde puedan
-- existir propiedades antiguas sin public_key asignado.

UPDATE properties
  SET public_key = gen_random_uuid()::text
  WHERE public_key IS NULL;

-- ─── 3. NOT NULL — idempotente ────────────────────────────────────────────────
--
-- PostgreSQL ignora SET NOT NULL si la columna ya tiene la restricción.
-- Requiere que no existan NULLs (garantizado por el UPDATE anterior).

ALTER TABLE properties
  ALTER COLUMN public_key SET NOT NULL;

-- ─── 4. Unique index — idempotente ───────────────────────────────────────────
--
-- Garantiza que no puedan existir dos propiedades con el mismo public_key.
-- IF NOT EXISTS es un NO-OP si el índice ya fue creado directamente en DB.

CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_public_key
  ON properties (public_key);
