'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActivePropertyWithRole } from '@/lib/property-context'
import type { ReviewPublishRules } from '@/types/hotelero'

// ─── Get publish rules ────────────────────────────────────────────────────────

export async function getPublishRules(
  propertyId: string,
): Promise<{ rules?: ReviewPublishRules | null; error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('review_publish_rules')
    .select('*')
    .eq('property_id', propertyId)
    .maybeSingle()

  if (error) return { error: error.message }
  return { rules: data as ReviewPublishRules | null }
}

// ─── Save publish rules ───────────────────────────────────────────────────────

export async function savePublishRules(input: {
  propertyId: string
  autoPublishEnabled: boolean
  minRating: number
  autoPublishSources: string[]
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { role } = await getActivePropertyWithRole(supabase, user.id)
  if (!role || !['owner', 'manager'].includes(role)) return { error: 'Sin permisos' }

  if (input.minRating < 1 || input.minRating > 5) {
    return { error: 'El rating minimo debe estar entre 1 y 5' }
  }

  const { error } = await supabase
    .from('review_publish_rules')
    .upsert(
      {
        property_id: input.propertyId,
        auto_publish_enabled: input.autoPublishEnabled,
        min_rating: input.minRating,
        auto_publish_sources: input.autoPublishSources,
      },
      { onConflict: 'property_id' },
    )

  if (error) return { error: error.message }

  revalidatePath('/dashboard/reviews')
  revalidatePath('/dashboard/settings')
  return {}
}
