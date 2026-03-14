// ─── SerpAPI Response Types ──────────────────────────────────────────────────

// Google Maps search result (from engine=google_maps)
export interface SerpApiGooglePlace {
  data_id: string
  title: string
  address: string
  gps_coordinates?: { latitude: number; longitude: number }
  rating?: number
  reviews?: number
  type?: string
  thumbnail?: string
}

// Google Maps review (from engine=google_maps_reviews)
export interface SerpApiGoogleReview {
  review_id: string
  user: {
    name: string
    link?: string
    thumbnail?: string
    local_guide?: boolean
    reviews?: number
  }
  rating: number
  date: string
  iso_date: string
  snippet: string
  likes?: number
  response?: { snippet: string; date: string }
}

// TripAdvisor search result (from engine=tripadvisor_search)
export interface SerpApiTripAdvisorPlace {
  place_id: string
  title: string
  rating?: number
  reviews_count?: number
  address?: string
  thumbnail?: string
}

// TripAdvisor review (from engine=tripadvisor_place)
export interface SerpApiTripAdvisorReview {
  title?: string
  snippet: string
  rating: number
  username: string
  date: string
  url?: string
}

// ─── Unified domain types ─────────────────────────────────────────────────────

// Generic place result unified across sources
export interface SearchPlaceResult {
  source: 'google' | 'tripadvisor'
  external_place_id: string
  name: string
  address: string
  rating: number | null
  review_count: number | null
  thumbnail: string | null
}

// Discovered review (before import into our DB)
export interface DiscoveredReview {
  external_uid: string
  source: 'google' | 'tripadvisor'
  rating: number
  reviewer_name: string | null
  comment: string | null
  title: string | null
  reviewed_at: string
  language: string | null
  already_imported: boolean
}
