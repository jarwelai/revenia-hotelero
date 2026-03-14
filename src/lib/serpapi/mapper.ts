import type {
  DiscoveredReview,
  SearchPlaceResult,
  SerpApiGooglePlace,
  SerpApiGoogleReview,
  SerpApiTripAdvisorPlace,
  SerpApiTripAdvisorReview,
} from './types'

// ─── Place mappers ────────────────────────────────────────────────────────────

export function mapGooglePlace(raw: SerpApiGooglePlace): SearchPlaceResult {
  return {
    source: 'google',
    external_place_id: raw.data_id,
    name: raw.title,
    address: raw.address ?? '',
    rating: raw.rating ?? null,
    review_count: raw.reviews ?? null,
    thumbnail: raw.thumbnail ?? null,
  }
}

export function mapTripAdvisorPlace(raw: SerpApiTripAdvisorPlace): SearchPlaceResult {
  return {
    source: 'tripadvisor',
    external_place_id: raw.place_id,
    name: raw.title,
    address: raw.address ?? '',
    rating: raw.rating ?? null,
    review_count: raw.reviews_count ?? null,
    thumbnail: raw.thumbnail ?? null,
  }
}

// ─── Review mappers ───────────────────────────────────────────────────────────

export function mapGoogleReview(raw: SerpApiGoogleReview): DiscoveredReview {
  return {
    external_uid: raw.review_id,
    source: 'google',
    rating: raw.rating,
    reviewer_name: raw.user?.name ?? null,
    comment: raw.snippet ?? null,
    title: null,
    reviewed_at: raw.iso_date ?? new Date().toISOString(),
    language: null,
    already_imported: false,
  }
}

export function mapTripAdvisorReview(raw: SerpApiTripAdvisorReview): DiscoveredReview {
  // TripAdvisor does not provide unique review IDs, so we compose one
  const uid = `ta_${raw.username}_${raw.date}`

  let reviewedAt: string
  try {
    reviewedAt = raw.date ? new Date(raw.date).toISOString() : new Date().toISOString()
  } catch {
    reviewedAt = new Date().toISOString()
  }

  return {
    external_uid: uid,
    source: 'tripadvisor',
    rating: raw.rating,
    reviewer_name: raw.username ?? null,
    comment: raw.snippet ?? null,
    title: raw.title ?? null,
    reviewed_at: reviewedAt,
    language: null,
    already_imported: false,
  }
}
