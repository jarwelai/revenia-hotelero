/**
 * GET /api/auth/google
 *
 * Initiates the Google Business Profile OAuth2 consent flow.
 * Verifies that the requesting user is owner/manager of the given property,
 * then redirects to Google's consent screen.
 *
 * Query params:
 *   propertyId — the property to connect to Google
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAuthUrl } from '@/lib/google/client'
import { encrypt } from '@/lib/encryption'

export const runtime = 'nodejs'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const propertyId = searchParams.get('propertyId')

  if (!propertyId) {
    return NextResponse.json({ error: 'propertyId is required' }, { status: 400 })
  }

  // 1. Verify the user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Verify user is owner or manager of the property
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('id, org_id')
    .eq('id', propertyId)
    .maybeSingle()

  if (propError || !property) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 })
  }

  const { data: membership } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', property.org_id)
    .eq('user_id', user.id)
    .in('role', ['owner', 'manager'])
    .maybeSingle()

  if (!membership) {
    return NextResponse.json(
      { error: 'Forbidden — only owner or manager can connect Google' },
      { status: 403 },
    )
  }

  // 3. Generate CSRF state (encrypted payload with propertyId, userId, timestamp)
  const statePayload = JSON.stringify({
    propertyId,
    userId: user.id,
    ts: Date.now(),
  })

  let state: string
  try {
    state = await encrypt(statePayload)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Encryption error'
    console.error('[api/auth/google] Failed to encrypt state:', message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // 4. Redirect to Google consent screen
  let authUrl: string
  try {
    authUrl = await buildAuthUrl(state)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Config error'
    console.error('[api/auth/google] Failed to build auth URL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.redirect(authUrl)
}
