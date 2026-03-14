/**
 * GET /api/auth/google/callback
 *
 * OAuth2 callback handler for Google Business Profile.
 * Validates state, exchanges code for tokens, persists encrypted tokens,
 * then redirects to /dashboard/settings?google=connected.
 *
 * Query params (provided by Google):
 *   code  — authorization code
 *   state — encrypted CSRF state from /api/auth/google
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { decrypt, encrypt } from '@/lib/encryption'
import { exchangeCodeForTokens, getAccounts } from '@/lib/google/client'

export const runtime = 'nodejs'

const STATE_MAX_AGE_MS = 10 * 60 * 1000 // 10 minutes

interface OAuthState {
  propertyId: string
  userId: string
  ts: number
}

function isOAuthState(value: unknown): value is OAuthState {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.propertyId === 'string' &&
    typeof obj.userId === 'string' &&
    typeof obj.ts === 'number'
  )
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const errorParam = searchParams.get('error')

  // Google sends an error param if the user denied consent
  if (errorParam) {
    console.warn('[api/auth/google/callback] OAuth error from Google:', errorParam)
    return NextResponse.redirect(
      new URL('/dashboard/settings?google=denied', request.url),
    )
  }

  if (!code || !stateParam) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
  }

  // 1. Decrypt and validate state
  let state: OAuthState
  try {
    const raw = await decrypt(stateParam)
    const parsed: unknown = JSON.parse(raw)
    if (!isOAuthState(parsed)) {
      throw new Error('Invalid state shape')
    }
    state = parsed
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[api/auth/google/callback] Invalid state:', message)
    return NextResponse.json({ error: 'Invalid or tampered state' }, { status: 400 })
  }

  // 2. Validate state is not expired (max 10 minutes)
  const age = Date.now() - state.ts
  if (age > STATE_MAX_AGE_MS) {
    return NextResponse.json({ error: 'OAuth state has expired. Please try again.' }, { status: 400 })
  }

  // 3. Exchange authorization code for tokens
  let tokens: { access_token: string; refresh_token: string; expires_in: number }
  try {
    tokens = await exchangeCodeForTokens(code)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token exchange failed'
    console.error('[api/auth/google/callback] Token exchange error:', message)
    return NextResponse.redirect(
      new URL('/dashboard/settings?google=error', request.url),
    )
  }

  // 4. Encrypt tokens before storage
  const accessTokenEncrypted = await encrypt(tokens.access_token)
  const refreshTokenEncrypted = await encrypt(tokens.refresh_token)
  const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  // 5. Fetch Google account to get the account ID
  let googleAccountId = ''
  try {
    const accounts = await getAccounts(tokens.access_token)
    const firstAccount = accounts[0]
    if (firstAccount) {
      // "accounts/{accountId}" — extract the ID portion
      googleAccountId = firstAccount.name ?? ''
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[api/auth/google/callback] Could not fetch Google accounts:', message)
    // Non-fatal — we still store the connection; user can configure location later
  }

  // 6. Load org_id for the property using service client (bypasses RLS)
  const admin = createServiceClient()

  const { data: property, error: propError } = await admin
    .from('properties')
    .select('org_id')
    .eq('id', state.propertyId)
    .maybeSingle()

  if (propError || !property) {
    console.error('[api/auth/google/callback] Property not found:', state.propertyId)
    return NextResponse.redirect(
      new URL('/dashboard/settings?google=error', request.url),
    )
  }

  // 7. Upsert google_connection (one per property)
  const { error: upsertError } = await admin
    .from('google_connections')
    .upsert(
      {
        property_id: state.propertyId,
        org_id: property.org_id,
        google_account_id: googleAccountId,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expires_at: tokenExpiresAt,
        sync_enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'property_id' },
    )

  if (upsertError) {
    console.error('[api/auth/google/callback] Failed to upsert google_connection:', upsertError.message)
    return NextResponse.redirect(
      new URL('/dashboard/settings?google=error', request.url),
    )
  }

  console.log(
    `[api/auth/google/callback] Google connection saved for property ${state.propertyId} (account: ${googleAccountId})`,
  )

  return NextResponse.redirect(
    new URL('/dashboard/settings?google=connected', request.url),
  )
}
