import type {
  SerpApiGooglePlace,
  SerpApiGoogleReview,
  SerpApiTripAdvisorPlace,
  SerpApiTripAdvisorReview,
} from './types'
import { getConfigValue } from '@/lib/config'

const SERPAPI_BASE = 'https://serpapi.com/search.json'

async function getApiKey(): Promise<string> {
  const key = await getConfigValue('SERPAPI_KEY')
  if (!key) throw new Error('SERPAPI_KEY is not configured')
  return key
}

// ─── Google Maps ──────────────────────────────────────────────────────────────

/**
 * Search Google Maps for places matching a query.
 * Returns an array of local results.
 */
export async function searchGoogleMaps(query: string): Promise<SerpApiGooglePlace[]> {
  const params = new URLSearchParams({
    engine: 'google_maps',
    q: query,
    type: 'search',
    api_key: await getApiKey(),
  })
  const res = await fetch(`${SERPAPI_BASE}?${params}`)
  if (!res.ok) throw new Error(`SerpAPI error: ${res.status}`)
  const data: unknown = await res.json()
  const record = data as Record<string, unknown>
  return (record.local_results as SerpApiGooglePlace[] | undefined) ?? []
}

/**
 * Fetch Google Maps reviews for a given data_id.
 * Supports pagination via next_page_token.
 */
export async function fetchGoogleMapsReviews(
  dataId: string,
  nextPageToken?: string,
): Promise<{ reviews: SerpApiGoogleReview[]; next_page_token?: string }> {
  const params = new URLSearchParams({
    engine: 'google_maps_reviews',
    data_id: dataId,
    api_key: await getApiKey(),
    sort_by: 'newestFirst',
    hl: 'es',
  })
  if (nextPageToken) params.set('next_page_token', nextPageToken)

  const res = await fetch(`${SERPAPI_BASE}?${params}`)
  if (!res.ok) throw new Error(`SerpAPI error: ${res.status}`)
  const data: unknown = await res.json()
  const record = data as Record<string, unknown>
  const pagination = record.serpapi_pagination as Record<string, unknown> | undefined

  return {
    reviews: (record.reviews as SerpApiGoogleReview[] | undefined) ?? [],
    next_page_token: pagination?.next_page_token as string | undefined,
  }
}

// ─── TripAdvisor ──────────────────────────────────────────────────────────────

function isTripAdvisorPlace(value: unknown): value is SerpApiTripAdvisorPlace {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return typeof obj.place_id === 'string'
}

/**
 * Search TripAdvisor for places matching a query.
 * Filters results to only those with a valid place_id (accommodations).
 */
export async function searchTripAdvisor(query: string): Promise<SerpApiTripAdvisorPlace[]> {
  const params = new URLSearchParams({
    engine: 'tripadvisor_search',
    q: query,
    api_key: await getApiKey(),
  })
  const res = await fetch(`${SERPAPI_BASE}?${params}`)
  if (!res.ok) throw new Error(`SerpAPI error: ${res.status}`)
  const data: unknown = await res.json()
  const record = data as Record<string, unknown>
  const results = (record.results as unknown[] | undefined) ?? []
  return results.filter(isTripAdvisorPlace)
}

/**
 * Fetch TripAdvisor reviews for a given place_id.
 */
export async function fetchTripAdvisorReviews(
  placeId: string,
): Promise<SerpApiTripAdvisorReview[]> {
  const params = new URLSearchParams({
    engine: 'tripadvisor_place',
    place_id: placeId,
    api_key: await getApiKey(),
  })
  const res = await fetch(`${SERPAPI_BASE}?${params}`)
  if (!res.ok) throw new Error(`SerpAPI error: ${res.status}`)
  const data: unknown = await res.json()
  const record = data as Record<string, unknown>
  return (record.reviews_list as SerpApiTripAdvisorReview[] | undefined) ?? []
}
