import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { OrgRole } from '@/types/hotelero'

export const ACTIVE_PROPERTY_COOKIE = 'rp_active_property_id'

export interface ActiveProperty {
  id: string
  org_id: string
  name: string
  public_key: string
  timezone: string
  currency: string
}

const PROPERTY_SELECT = 'id, org_id, name, public_key, timezone, currency'

/**
 * Resolves the active property for the authenticated user.
 *
 * Resolution order:
 * 1. Cookie `rp_active_property_id` — validated via RLS (user must still have access)
 * 2. First accessible property ordered by created_at ASC (stable fallback)
 *
 * Note: Cookie writes only succeed in Server Actions / Route Handlers.
 * In Server Components the write is silently swallowed (same pattern as server.ts).
 *
 * @param supabase  RLS-enabled Supabase client (user session must be active)
 */
export async function getActiveProperty(
  supabase: SupabaseClient,
): Promise<ActiveProperty | null> {
  const cookieStore = await cookies()
  const storedId = cookieStore.get(ACTIVE_PROPERTY_COOKIE)?.value

  if (storedId) {
    const { data } = await supabase
      .from('properties')
      .select(PROPERTY_SELECT)
      .eq('id', storedId)
      .maybeSingle()

    if (data) return data as ActiveProperty
    // Cookie stale (property deleted or access revoked) — fall through to fallback
  }

  // Fallback: first accessible property, stable creation-date order
  const { data: rows } = await supabase
    .from('properties')
    .select(PROPERTY_SELECT)
    .order('created_at', { ascending: true })
    .limit(1)

  return (rows?.[0] ?? null) as ActiveProperty | null
}

/**
 * Resolves active property AND the user's role in that property's org.
 * Convenience wrapper for pages that need both (canEdit checks, staff redirects).
 */
export async function getActivePropertyWithRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ property: ActiveProperty | null; role: OrgRole | null }> {
  const property = await getActiveProperty(supabase)
  if (!property) return { property: null, role: null }

  const { data: member } = await supabase
    .from('org_members')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', property.org_id)
    .maybeSingle()

  return { property, role: (member?.role as OrgRole) ?? null }
}
