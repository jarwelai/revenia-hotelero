/**
 * JarwelERP Guest Resolver
 *
 * Resolves or creates a guest record from booking data.
 * Deduplicates by email within the same org.
 *
 * Design:
 *   - Guests are org-scoped (not property-scoped) — same guest can book at multiple properties
 *   - Email is the natural dedup key
 *   - If no email, a new guest record is always created (no dedup possible)
 *   - Returns guest_id for linking to bookings
 *   - Fire-and-forget for booking flow — guest resolution failure should never block a booking
 */

import { createServiceClient } from '@/lib/supabase/server'

export interface GuestInput {
  orgId: string
  fullName: string
  email?: string | null
  phone?: string | null
  countryIso2?: string | null
  language?: string | null
}

/**
 * Resolve (find or create) a guest record.
 * Returns the guest ID, or null if resolution fails.
 */
export async function resolveGuest(input: GuestInput): Promise<string | null> {
  try {
    const admin = createServiceClient()
    const { orgId, fullName, email, phone, countryIso2, language } = input

    // Try to find existing guest by email within org
    if (email) {
      const { data: existing } = await admin
        .from('guests')
        .select('id')
        .eq('org_id', orgId)
        .eq('email', email.trim().toLowerCase())
        .maybeSingle()

      if (existing) {
        // Update contact info if changed
        await admin
          .from('guests')
          .update({
            full_name: fullName.trim(),
            phone: phone?.trim() || undefined,
            country_iso2: countryIso2 || undefined,
            language: language || undefined,
          })
          .eq('id', existing.id)

        return existing.id
      }
    }

    // Create new guest
    const { data: newGuest } = await admin
      .from('guests')
      .insert({
        org_id: orgId,
        full_name: fullName.trim(),
        email: email?.trim().toLowerCase() || null,
        phone: phone?.trim() || null,
        country_iso2: countryIso2 || null,
        language: language || null,
      })
      .select('id')
      .single()

    return newGuest?.id ?? null
  } catch (err) {
    console.error('[resolveGuest] Failed:', err)
    return null
  }
}
