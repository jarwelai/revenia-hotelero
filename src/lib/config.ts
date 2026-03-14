import { createServiceClient } from '@/lib/supabase/server'

/**
 * Resolves a config value by checking system_secrets table first,
 * then falling back to process.env.
 * This allows Super Admins to configure integrations from the UI
 * while still supporting traditional env vars.
 */
export async function getConfigValue(key: string): Promise<string | null> {
  try {
    const admin = createServiceClient()
    const { data } = await admin
      .from('system_secrets')
      .select('value')
      .eq('key', key)
      .maybeSingle()

    if (data?.value) return data.value
  } catch {
    // If DB query fails, fall through to env var
  }

  return process.env[key] ?? null
}

/**
 * Resolves multiple config values at once (more efficient than multiple calls).
 */
export async function getConfigValues(keys: string[]): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {}

  try {
    const admin = createServiceClient()
    const { data } = await admin
      .from('system_secrets')
      .select('key, value')
      .in('key', keys)

    const dbMap = new Map((data ?? []).map(r => [r.key, r.value]))

    for (const key of keys) {
      result[key] = dbMap.get(key) ?? process.env[key] ?? null
    }
  } catch {
    // Fallback to env vars only
    for (const key of keys) {
      result[key] = process.env[key] ?? null
    }
  }

  return result
}
