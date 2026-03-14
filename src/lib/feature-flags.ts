/**
 * Feature flags — reads from super_admin_config table.
 * Uses service client to bypass RLS (config is controlled by super admins, not property owners).
 */

import { createServiceClient } from '@/lib/supabase/server'

/**
 * Returns true if AI-generated review responses are enabled for the given property.
 * Defaults to false if no config row exists.
 */
export async function isAiReviewResponsesEnabled(propertyId: string): Promise<boolean> {
  const admin = createServiceClient()

  const { data } = await admin
    .from('super_admin_config')
    .select('ai_review_responses_enabled')
    .eq('property_id', propertyId)
    .maybeSingle()

  return data?.ai_review_responses_enabled ?? false
}
