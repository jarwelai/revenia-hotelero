/**
 * Google Business Profile API client.
 * Handles OAuth2 flow, token refresh, account/location queries, and review replies.
 *
 * Config keys resolved via @/lib/config (DB system_secrets → env fallback):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REDIRECT_URI
 *   TOKEN_ENCRYPTION_KEY  — used by encrypt/decrypt
 */

import { encrypt, decrypt } from '@/lib/encryption'
import { getConfigValues } from '@/lib/config'
import { createServiceClient } from '@/lib/supabase/server'
import type { GoogleAccount, GoogleLocation } from './types'

const GOOGLE_OAUTH_BASE = 'https://accounts.google.com/o/oauth2'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_BUSINESS_SCOPE = 'https://www.googleapis.com/auth/business.manage'

// ─── OAuth helpers ────────────────────────────────────────────────────────────

/**
 * Builds the Google OAuth consent URL.
 * Requests offline access so a refresh token is issued.
 */
export async function buildAuthUrl(state: string): Promise<string> {
  const cfg = await getConfigValues(['GOOGLE_CLIENT_ID', 'GOOGLE_REDIRECT_URI'])
  const clientId = cfg['GOOGLE_CLIENT_ID']
  const redirectUri = cfg['GOOGLE_REDIRECT_URI']

  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured')
  if (!redirectUri) throw new Error('GOOGLE_REDIRECT_URI is not configured')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_BUSINESS_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  return `${GOOGLE_OAUTH_BASE}/auth?${params.toString()}`
}

// ─── Token exchange ───────────────────────────────────────────────────────────

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

/**
 * Exchanges an OAuth authorization code for tokens.
 * Returns raw (unencrypted) tokens — caller is responsible for encrypting before storage.
 */
export async function exchangeCodeForTokens(
  code: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const cfg = await getConfigValues(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'])
  const clientId = cfg['GOOGLE_CLIENT_ID']
  const clientSecret = cfg['GOOGLE_CLIENT_SECRET']
  const redirectUri = cfg['GOOGLE_REDIRECT_URI']

  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured')
  if (!clientSecret) throw new Error('GOOGLE_CLIENT_SECRET is not configured')
  if (!redirectUri) throw new Error('GOOGLE_REDIRECT_URI is not configured')

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Google token exchange failed (${res.status}): ${body}`)
  }

  const data = await res.json() as TokenResponse

  if (!data.access_token || !data.refresh_token) {
    throw new Error('Google did not return expected tokens. Ensure access_type=offline and prompt=consent.')
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  }
}

// ─── Token refresh ────────────────────────────────────────────────────────────

interface RefreshResponse {
  access_token: string
  expires_in: number
  token_type: string
}

/**
 * Decrypts the stored refresh token and uses it to obtain a new access token.
 */
export async function refreshAccessToken(
  refreshTokenEncrypted: string,
): Promise<{ access_token: string; expires_in: number }> {
  const cfg = await getConfigValues(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'])
  const clientId = cfg['GOOGLE_CLIENT_ID']
  const clientSecret = cfg['GOOGLE_CLIENT_SECRET']

  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured')
  if (!clientSecret) throw new Error('GOOGLE_CLIENT_SECRET is not configured')

  const refreshToken = await decrypt(refreshTokenEncrypted)

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Google token refresh failed (${res.status}): ${body}`)
  }

  const data = await res.json() as RefreshResponse

  if (!data.access_token) {
    throw new Error('Google token refresh did not return an access_token')
  }

  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
  }
}

// ─── Business Profile API calls ───────────────────────────────────────────────

interface AccountsListResponse {
  accounts?: GoogleAccount[]
}

/**
 * Lists all Google Business Profile accounts accessible to the authenticated user.
 */
export async function getAccounts(accessToken: string): Promise<GoogleAccount[]> {
  const res = await fetch(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  )

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Google getAccounts failed (${res.status}): ${body}`)
  }

  const data = await res.json() as AccountsListResponse
  return data.accounts ?? []
}

interface LocationsListResponse {
  locations?: GoogleLocation[]
}

/**
 * Lists locations under a Google Business Profile account.
 * @param accountName — e.g. "accounts/{accountId}"
 */
export async function getLocations(
  accessToken: string,
  accountName: string,
): Promise<GoogleLocation[]> {
  const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Google getLocations failed (${res.status}): ${body}`)
  }

  const data = await res.json() as LocationsListResponse
  return data.locations ?? []
}

/**
 * Replies to a Google review via the My Business API v4.
 * @param reviewName — full review resource name, e.g. "accounts/{a}/locations/{l}/reviews/{r}"
 */
export async function replyToReview(
  accessToken: string,
  reviewName: string,
  comment: string,
): Promise<void> {
  const url = `https://mybusiness.googleapis.com/v4/${reviewName}/reply`

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ comment }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Google replyToReview failed (${res.status}): ${body}`)
  }
}

// ─── Token orchestration ──────────────────────────────────────────────────────

interface GoogleConnectionRow {
  access_token_encrypted: string
  refresh_token_encrypted: string
  token_expires_at: string | null
}

/**
 * Returns a valid (non-expired) access token for the given google_connection.
 * Automatically refreshes using the stored refresh token if the access token
 * has expired, and persists the new token to the DB.
 */
export async function getValidAccessToken(connectionId: string): Promise<string> {
  const admin = createServiceClient()

  const { data: conn, error } = await admin
    .from('google_connections')
    .select('access_token_encrypted, refresh_token_encrypted, token_expires_at')
    .eq('id', connectionId)
    .maybeSingle()

  if (error) throw new Error(`Failed to load google_connection: ${error.message}`)
  if (!conn) throw new Error(`google_connection not found: ${connectionId}`)

  const row = conn as GoogleConnectionRow

  const now = Date.now()
  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0
  const isExpired = expiresAt < now

  if (!isExpired) {
    return await decrypt(row.access_token_encrypted)
  }

  // Token is expired — refresh
  const { access_token, expires_in } = await refreshAccessToken(row.refresh_token_encrypted)

  const newExpiresAt = new Date(now + expires_in * 1000).toISOString()
  const newAccessTokenEncrypted = await encrypt(access_token)

  const { error: updateError } = await admin
    .from('google_connections')
    .update({
      access_token_encrypted: newAccessTokenEncrypted,
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connectionId)

  if (updateError) {
    console.error('[google/client] Failed to persist refreshed token:', updateError.message)
    // Non-fatal — token was obtained, proceed with it
  }

  return access_token
}
