'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

// ─── isSuperAdmin ──────────────────────────────────────────────────────────────

/**
 * Returns true if the currently authenticated user's email is in the
 * SUPER_ADMIN_EMAILS environment variable (comma-separated whitelist).
 */
export async function isSuperAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return false

  const whitelist = (process.env.SUPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  return whitelist.includes(user.email.toLowerCase())
}

// ─── listPropertiesWithConfig ──────────────────────────────────────────────────

export interface PropertyWithConfig {
  id: string
  name: string
  org_name: string
  ai_review_responses_enabled: boolean
  // Review integration status
  google_source_connected: boolean
  google_source_place_name: string | null
  tripadvisor_source_connected: boolean
  tripadvisor_source_place_name: string | null
  google_oauth_connected: boolean
  google_oauth_email: string | null
  auto_publish_enabled: boolean
  total_reviews: number
  total_imported_reviews: number
}

interface OrgJoin {
  name: string
}

// Supabase returns joined one-to-many as arrays; we cast via unknown below.
interface PropertyRow {
  id: string
  name: string
  orgs: OrgJoin | OrgJoin[] | null
}

interface SourceConnectionRow {
  property_id: string
  source: string
  place_name: string | null
}

interface GoogleConnectionRow {
  property_id: string
  google_email: string | null
}

interface PublishRuleRow {
  property_id: string
  auto_publish_enabled: boolean
}

interface ReviewCountRow {
  property_id: string
  external_uid: string | null
}

interface ReviewAggregate {
  total: number
  imported: number
}

/**
 * Returns all properties with their super_admin_config feature flags and
 * review manager integration status. Only accessible to super admins.
 */
export async function listPropertiesWithConfig(): Promise<{
  properties?: PropertyWithConfig[]
  error?: string
}> {
  if (!(await isSuperAdmin())) return { error: 'No autorizado' }

  const admin = createServiceClient()

  // Fetch all data in parallel
  const [
    propertiesResult,
    configsResult,
    sourceConnectionsResult,
    googleConnectionsResult,
    publishRulesResult,
    reviewsResult,
  ] = await Promise.all([
    admin.from('properties').select('id, name, orgs(name)').order('name'),
    admin.from('super_admin_config').select('property_id, ai_review_responses_enabled'),
    admin
      .from('review_source_connections')
      .select('property_id, source, place_name'),
    admin
      .from('google_connections')
      .select('property_id, google_email'),
    admin
      .from('review_publish_rules')
      .select('property_id, auto_publish_enabled'),
    admin
      .from('reviews')
      .select('property_id, external_uid'),
  ])

  if (propertiesResult.error) return { error: propertiesResult.error.message }
  if (configsResult.error) return { error: configsResult.error.message }

  // Build config map: property_id -> ai_enabled
  const configMap = new Map<string, boolean>(
    ((configsResult.data ?? []) as { property_id: string; ai_review_responses_enabled: boolean }[]).map(c => [
      c.property_id,
      c.ai_review_responses_enabled,
    ]),
  )

  // Build source connections map: `${property_id}:${source}` -> place_name
  const sourceMap = new Map<string, string | null>()
  for (const row of (sourceConnectionsResult.data ?? []) as SourceConnectionRow[]) {
    sourceMap.set(`${row.property_id}:${row.source}`, row.place_name)
  }

  // Build Google OAuth map: property_id -> google_email
  const googleOAuthMap = new Map<string, string | null>()
  for (const row of (googleConnectionsResult.data ?? []) as GoogleConnectionRow[]) {
    googleOAuthMap.set(row.property_id, row.google_email)
  }

  // Build publish rules map: property_id -> auto_publish_enabled
  const publishRulesMap = new Map<string, boolean>()
  for (const row of (publishRulesResult.data ?? []) as PublishRuleRow[]) {
    publishRulesMap.set(row.property_id, row.auto_publish_enabled)
  }

  // Aggregate review counts per property
  const reviewAggregates = new Map<string, ReviewAggregate>()
  for (const row of (reviewsResult.data ?? []) as ReviewCountRow[]) {
    const existing = reviewAggregates.get(row.property_id) ?? { total: 0, imported: 0 }
    existing.total += 1
    if (row.external_uid !== null) {
      existing.imported += 1
    }
    reviewAggregates.set(row.property_id, existing)
  }

  const rows: PropertyWithConfig[] = ((propertiesResult.data ?? []) as unknown as PropertyRow[]).map(p => {
    const orgsValue = p.orgs
    const orgName = Array.isArray(orgsValue)
      ? (orgsValue[0]?.name ?? 'Sin org')
      : (orgsValue?.name ?? 'Sin org')

    const googlePlaceName = sourceMap.get(`${p.id}:google`) ?? null
    const tripadvisorPlaceName = sourceMap.get(`${p.id}:tripadvisor`) ?? null
    const googleOAuthEmail = googleOAuthMap.has(p.id) ? googleOAuthMap.get(p.id) ?? null : null
    const reviewCounts = reviewAggregates.get(p.id) ?? { total: 0, imported: 0 }

    return {
      id: p.id,
      name: p.name,
      org_name: orgName,
      ai_review_responses_enabled: configMap.get(p.id) ?? false,
      google_source_connected: sourceMap.has(`${p.id}:google`),
      google_source_place_name: googlePlaceName,
      tripadvisor_source_connected: sourceMap.has(`${p.id}:tripadvisor`),
      tripadvisor_source_place_name: tripadvisorPlaceName,
      google_oauth_connected: googleOAuthMap.has(p.id),
      google_oauth_email: googleOAuthEmail,
      auto_publish_enabled: publishRulesMap.get(p.id) ?? false,
      total_reviews: reviewCounts.total,
      total_imported_reviews: reviewCounts.imported,
    }
  })

  return { properties: rows }
}

// ─── getSystemIntegrationStatus ────────────────────────────────────────────────

export interface SystemIntegrationStatus {
  serpapi_configured: boolean
  google_oauth_configured: boolean
  encryption_key_configured: boolean
  openrouter_configured: boolean
  cron_secret_configured: boolean
  super_admin_emails: string[]
  error?: string
}

/**
 * Returns the configuration status of all required environment variables for
 * the Review Manager integration. Only accessible to super admins.
 */
export async function getSystemIntegrationStatus(): Promise<SystemIntegrationStatus> {
  if (!(await isSuperAdmin())) {
    return {
      serpapi_configured: false,
      google_oauth_configured: false,
      encryption_key_configured: false,
      openrouter_configured: false,
      cron_secret_configured: false,
      super_admin_emails: [],
      error: 'No autorizado',
    }
  }

  // Check both DB secrets and env vars
  const admin = createServiceClient()
  const { data: secrets } = await admin.from('system_secrets').select('key')
  const dbKeys = new Set((secrets ?? []).map((r: { key: string }) => r.key))

  const hasKey = (key: string) => dbKeys.has(key) || !!process.env[key]

  return {
    serpapi_configured: hasKey('SERPAPI_KEY'),
    google_oauth_configured:
      hasKey('GOOGLE_CLIENT_ID') && hasKey('GOOGLE_CLIENT_SECRET'),
    encryption_key_configured: hasKey('TOKEN_ENCRYPTION_KEY'),
    openrouter_configured: hasKey('OPENROUTER_API_KEY'),
    cron_secret_configured: hasKey('CRON_SECRET'),
    super_admin_emails: (process.env.SUPER_ADMIN_EMAILS ?? '')
      .split(',')
      .map(e => e.trim())
      .filter(Boolean),
  }
}

// ─── toggleAiReviewResponses ───────────────────────────────────────────────────

/**
 * Enables or disables the AI review responses feature for a specific property.
 * Uses upsert so the row is created on first toggle.
 * Only accessible to super admins.
 */
export async function toggleAiReviewResponses(
  propertyId: string,
  enabled: boolean,
): Promise<{ error?: string }> {
  if (!(await isSuperAdmin())) return { error: 'No autorizado' }
  if (!propertyId) return { error: 'propertyId es requerido' }

  const admin = createServiceClient()

  const { error } = await admin
    .from('super_admin_config')
    .upsert(
      {
        property_id: propertyId,
        ai_review_responses_enabled: enabled,
      },
      { onConflict: 'property_id' },
    )

  if (error) return { error: error.message }
  return {}
}
