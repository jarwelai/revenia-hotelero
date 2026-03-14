'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin } from './super-admin'

/**
 * Returns the set of configured secret keys (NOT their values).
 * Checks both system_secrets table and environment variables.
 */
export async function listConfiguredKeys(): Promise<{
  keys?: string[]
  error?: string
}> {
  if (!(await isSuperAdmin())) return { error: 'No autorizado' }

  const admin = createServiceClient()
  const { data, error } = await admin.from('system_secrets').select('key')
  if (error) return { error: error.message }

  // Combine DB keys with env var keys
  const dbKeys = (data ?? []).map(r => r.key)

  // Check env vars that might be configured outside DB
  const envKeysToCheck = [
    'SERPAPI_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'TOKEN_ENCRYPTION_KEY',
    'OPENROUTER_API_KEY',
    'CRON_SECRET',
  ]

  const configuredKeys = new Set(dbKeys)
  for (const key of envKeysToCheck) {
    if (process.env[key]) configuredKeys.add(key)
  }

  return { keys: Array.from(configuredKeys) }
}

/**
 * Saves a secret value to the system_secrets table.
 * Uses upsert so it works for both create and update.
 */
export async function upsertSecret(
  key: string,
  value: string,
): Promise<{ error?: string }> {
  if (!(await isSuperAdmin())) return { error: 'No autorizado' }
  if (!key || !value.trim()) return { error: 'Key y valor son requeridos' }

  // Validate specific keys
  if (key === 'TOKEN_ENCRYPTION_KEY') {
    if (!/^[0-9a-f]{64}$/i.test(value.trim())) {
      return { error: 'La clave de cifrado debe ser exactamente 64 caracteres hexadecimales' }
    }
  }

  const admin = createServiceClient()
  const { error } = await admin
    .from('system_secrets')
    .upsert(
      { key, value: value.trim() },
      { onConflict: 'key' },
    )

  if (error) return { error: error.message }
  return {}
}

/**
 * Saves multiple secrets at once (for multi-field configs like Google OAuth).
 */
export async function upsertSecrets(
  secrets: { key: string; value: string }[],
): Promise<{ error?: string }> {
  if (!(await isSuperAdmin())) return { error: 'No autorizado' }

  for (const s of secrets) {
    if (!s.key || !s.value.trim()) {
      return { error: 'Todos los campos son requeridos' }
    }
  }

  // Validate specific keys
  const encKey = secrets.find(s => s.key === 'TOKEN_ENCRYPTION_KEY')
  if (encKey && !/^[0-9a-f]{64}$/i.test(encKey.value.trim())) {
    return { error: 'La clave de cifrado debe ser exactamente 64 caracteres hexadecimales' }
  }

  const admin = createServiceClient()

  for (const s of secrets) {
    const { error } = await admin
      .from('system_secrets')
      .upsert(
        { key: s.key, value: s.value.trim() },
        { onConflict: 'key' },
      )
    if (error) return { error: error.message }
  }

  return {}
}

/**
 * Deletes a secret (or multiple keys for a config group).
 */
export async function deleteSecrets(
  keys: string[],
): Promise<{ error?: string }> {
  if (!(await isSuperAdmin())) return { error: 'No autorizado' }
  if (keys.length === 0) return { error: 'Keys requeridas' }

  const admin = createServiceClient()
  const { error } = await admin
    .from('system_secrets')
    .delete()
    .in('key', keys)

  if (error) return { error: error.message }
  return {}
}
