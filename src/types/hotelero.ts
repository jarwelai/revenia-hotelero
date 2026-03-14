export type OrgRole = 'owner' | 'manager' | 'staff'
export type InventoryMode = 'unit' | 'aggregated'
export type SyncStatus = 'ok' | 'error' | 'stale' | 'never'
export type BookingStatus = 'hold' | 'draft' | 'pending_payment' | 'confirmed' | 'cancelled' | 'expired' | 'no_show'
export type PaymentProvider = 'recurrente' | 'stripe' | 'manual' | 'property'
export type PaymentSessionStatus = 'created' | 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled'
export type PushStatus = 'not_pushed' | 'pending' | 'pushed' | 'failed'
export type ExternalReservationStatus = 'confirmed' | 'tentative' | 'cancelled'
export type ReviewSource = 'manual' | 'internal' | 'google' | 'booking' | 'airbnb' | 'expedia' | 'facebook' | 'tripadvisor' | 'other'
export type ReviewStatus = 'published' | 'hidden'
export type ChargeMode = 'per_room' | 'per_person'

// ─── Property Setup types ───────────────────────────────────────────────────
export type PropertyType = 'hotel' | 'hostal' | 'boutique' | 'resort' | 'posada' | 'apart-hotel' | 'villa' | 'cabin'
export type AmenityCategory = 'general' | 'pool' | 'business' | 'wellness' | 'dining' | 'accessibility' | 'outdoor' | 'custom'
export type ServiceType = 'restaurant' | 'spa' | 'bar' | 'daypass' | 'events' | 'tours' | 'custom'
export type ReviewType = 'guest_to_property' | 'property_to_guest' | 'internal_note'
export type ReviewVisibility = 'public' | 'private' | 'internal'
export type EmbedTheme = 'light' | 'dark'
export type EmbedLayout = 'vertical' | 'horizontal'
export type ImageEntityType = 'property' | 'room_type' | 'service'

export interface Org {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: OrgRole
  created_at: string
}

export interface Property {
  id: string
  org_id: string
  name: string
  timezone: string
  currency: string
  inventory_mode: InventoryMode
  policies_json: Record<string, unknown>
  public_key: string
  created_at: string
  // ─── Property Setup: identity, location, classification, publishing
  address?: string | null
  city?: string | null
  state_province?: string | null
  country_iso2?: string | null
  postal_code?: string | null
  latitude?: number | null
  longitude?: number | null
  phone?: string | null
  email?: string | null
  website?: string | null
  check_in_time?: string | null
  check_out_time?: string | null
  star_rating?: number | null
  property_type?: PropertyType | null
  slug?: string | null
  is_published?: boolean
  hero_image_url?: string | null
}

export interface RoomType {
  id: string
  property_id: string
  name: string
  description: string | null
  max_occupancy: number
  base_price: number | null
  amenities_json: string[]
  created_at: string
}

export interface Room {
  id: string
  property_id: string
  room_type_id: string | null
  name: string
  motopress_accommodation_id: number | null
  ical_url: string | null
  sync_enabled: boolean
  sync_status: SyncStatus
  last_synced_at: string | null
  last_sync_error: string | null
  created_at: string
  // join
  room_type?: { name: string } | null
}

export interface ExternalReservation {
  id: string
  room_id: string
  provider: string
  external_uid: string
  check_in: string
  check_out: string
  status: ExternalReservationStatus
  raw_hash: string | null
  last_seen_at: string
}

export interface Booking {
  id: string
  property_id: string
  room_id: string | null
  guest_name: string
  guest_email: string | null
  guest_phone: string | null
  check_in: string
  check_out: string
  status: BookingStatus
  total_amount: number | null
  currency: string
  notes: string | null
  motopress_booking_id: number | null
  push_status: PushStatus
  push_last_error: string | null
  created_at: string
  updated_at: string
  // Sprint 2A: ocupación y desglose financiero
  adults: number | null
  children_count: number | null
  subtotal: number | null
  taxes_total: number | null
  has_pets: boolean
  pet_count: number
  // JarwelERP integration
  guest_id: string | null
  erp_booking_id: string | null
}

export interface BookingNight {
  id: string
  booking_id: string
  room_id: string
  night: string
  is_active: boolean
  base_rate: number | null
  total_rate: number | null
  // Sprint 2A: snapshot financiero por noche
  adults: number | null
  children_count: number | null
  extras_adults: number | null
  extras_children: number | null
  extras_pets: number | null
  taxes: number | null
}

export interface Block {
  id: string
  property_id: string
  room_id: string
  start_date: string
  end_date: string
  reason: string | null
  created_at: string
}

export interface TapeChartRoom {
  id: string
  name: string
  room_type_id: string | null
  room_type_name: string
}

export interface TapeChartBooking {
  id: string
  room_id: string
  guest_name: string
  check_in: string
  check_out: string
  status: BookingStatus
}

export interface TapeChartBlock {
  id: string
  room_id: string
  start_date: string
  end_date: string
  reason: string | null
}

export interface TapeChartData {
  rooms: TapeChartRoom[]
  bookings: TapeChartBooking[]
  blocks: TapeChartBlock[]
  dateFrom: string
  dateTo: string
}

export interface RatePlan {
  id: string
  property_id: string
  code: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RatePlanInterval {
  id: string
  property_id: string
  room_type_id: string
  rate_plan_id: string
  start_date: string
  end_date: string
  dow_mask: number
  base_rate: number
  min_los: number | null
  closed: boolean
  priority: number
  season_id?: string | null
}

export interface AriCell {
  base_rate: number | null
  min_los: number | null
  closed: boolean
}

export interface AriGrid {
  grid: Record<string, Record<string, AriCell>>
  ratePlanId: string | null
  dateFrom: string
  dateTo: string
  roomTypes: { id: string; name: string }[]
}

export interface BulkAriUpdate {
  property_id: string
  room_type_ids: string[]
  rate_plan_id: string
  start_date: string
  end_date: string
  dow_mask?: number
  base_rate?: number | null
  min_los?: number | null
  closed?: boolean | null
}

// ─── Sprint 2A: Config comercial, niños, impuestos, cotización ─────────────

export interface PropertyCommercialSettings {
  property_id: string
  currency: string
  prices_include_taxes: boolean
  charge_mode: ChargeMode
  base_occupancy: number
  extra_adult_fee: number
  child_policy_enabled: boolean
  pet_policy_enabled: boolean
  pet_fee: number
  created_at: string
  updated_at: string
}

export interface ChildPricingRule {
  id: string
  property_id: string
  min_age: number
  max_age: number
  fee_type: 'fixed' | 'percent'
  fee_value: number
  applies_per_night: boolean
  created_at: string
}

export interface TaxRule {
  id: string
  property_id: string
  name: string
  type: 'percent' | 'fixed'
  value: number
  applies_to: 'room' | 'extras' | 'total'
  is_active: boolean
  created_at: string
}

export interface NightQuote {
  night: string
  base_rate: number | null
  extras_adults: number
  extras_children: number
  extras_pets: number
  subtotal: number     // base_rate + extras (0 si base_rate es null)
  taxes: number
  total_rate: number   // subtotal + taxes (exclusive) o subtotal (inclusive)
}

export interface QuoteResult {
  nights: NightQuote[]
  subtotal: number
  taxes_total: number
  grand_total: number
  currency: string
  error?: string
}

export interface Review {
  id: string
  org_id: string
  property_id: string
  source: ReviewSource
  external_uid: string | null
  rating: number
  title: string | null
  comment: string | null
  reviewer_name: string | null
  reviewer_email: string | null
  reviewer_country: string | null
  stay_start: string | null
  stay_end: string | null
  booking_id: string | null
  language: string | null
  status: ReviewStatus
  featured: boolean
  reviewed_at: string
  created_at: string
  updated_at: string
  reply_text: string | null
  reply_author: string | null
  replied_at: string | null
  reply_synced_to_source: boolean
  reply_sync_error: string | null
  // ─── Review model evolution
  review_type?: ReviewType
  visibility?: ReviewVisibility
  guest_id?: string | null
}

export interface ReviewAggregate {
  property_id: string
  org_id: string
  total_reviews: number
  average_rating: number
  rating_distribution: Record<string, number>
  last_reviewed_at: string | null
  updated_at: string
}

// ─── Reviews Module: Source connections, publish rules, Google, super admin ──

export interface ReviewSourceConnection {
  id: string
  property_id: string
  org_id: string
  source: 'google' | 'tripadvisor'
  external_place_id: string
  place_name: string | null
  place_url: string | null
  last_synced_at: string | null
  last_sync_error: string | null
  created_at: string
}

export interface ReviewPublishRules {
  property_id: string
  auto_publish_enabled: boolean
  min_rating: number
  auto_publish_sources: ReviewSource[]
  created_at: string
  updated_at: string
}

export interface GoogleConnection {
  id: string
  property_id: string
  org_id: string
  google_account_id: string
  google_email: string | null
  google_location_id: string | null
  google_location_name: string | null
  sync_enabled: boolean
  last_synced_at: string | null
  last_sync_error: string | null
  created_at: string
  updated_at: string
  // NOTE: encrypted tokens are NEVER exposed to the client
}

export interface SuperAdminConfig {
  id: string
  property_id: string
  ai_review_responses_enabled: boolean
  created_at: string
  updated_at: string
}

// ─── Sprint 3D: Payment provider configuration ───────────────────────────────

export type GatewayProvider = 'stripe' | 'recurrente'

export interface PropertyPaymentProvider {
  id: string
  property_id: string
  provider: GatewayProvider
  is_enabled: boolean
  is_default: boolean
  config_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ─── Phase 2D: Public Booking + i18n-ready ────────────────────────────────────

export type PublicLang = 'es' | 'en'
export type ContentStatus = 'draft' | 'approved'
export type BookingSource = 'internal' | 'ical' | 'direct'

export interface PropertyPublicSettings {
  property_id: string
  default_lang: PublicLang
  supported_langs: PublicLang[]
  public_brand_name: string | null
  created_at: string
  updated_at: string
  // ─── Embed customization
  embed_primary_color?: string | null
  embed_border_radius?: number | null
  embed_theme?: EmbedTheme | null
  embed_layout?: EmbedLayout | null
}

export interface PublicContentSlot {
  id: string
  property_id: string
  key: string
  source_lang: PublicLang
  status: ContentStatus
  approved_at: string | null
  approved_by: string | null
  created_at: string
  updated_at: string
  translations?: PublicContentTranslation[]
}

export interface PublicContentTranslation {
  id: string
  slot_id: string
  lang: PublicLang
  text: string
  status: ContentStatus
  approved_at: string | null
  approved_by: string | null
  created_at: string
  updated_at: string
}

export interface BookingQuote {
  id: string
  property_id: string
  room_id: string | null
  room_type_id: string | null
  rate_plan_id: string | null
  check_in: string
  check_out: string
  adults: number
  children_ages: number[]
  has_pets: boolean
  pet_count: number
  lang: PublicLang
  quote_payload: QuoteResult
  expires_at: string
  created_at: string
}

// ─── JarwelERP Integration Types ──────────────────────────────────────────────

export interface Guest {
  id: string
  org_id: string
  full_name: string
  email: string | null
  phone: string | null
  country_iso2: string | null
  language: string | null
  notes: string | null
  tags: string[]
  erp_customer_id: string | null
  created_at: string
  updated_at: string
}

export interface OperationalEvent {
  id: string
  org_id: string
  property_id: string | null
  event_type: string
  entity_type: string
  entity_id: string
  payload: Record<string, unknown>
  actor_id: string | null
  actor_type: 'user' | 'system' | 'webhook' | 'cron'
  erp_synced_at: string | null
  erp_sync_error: string | null
  created_at: string
}

export interface LedgerEntry {
  id: string
  org_id: string
  property_id: string
  booking_id: string | null
  payment_session_id: string | null
  entry_type: string
  amount: number
  currency: string
  description: string | null
  night: string | null
  tax_rule_name: string | null
  erp_journal_id: string | null
  erp_account_code: string | null
  created_at: string
}

export interface PaymentSession {
  id: string
  property_id: string
  booking_id: string
  provider: PaymentProvider
  status: PaymentSessionStatus
  amount: number
  currency: string
  provider_reference: string | null
  checkout_url: string | null
  erp_reference: string | null
  created_at: string
  updated_at: string
}

// ─── Property Setup: Amenities, Seasons, Services, Images, Activation ────────

export interface PropertyAmenity {
  id: string
  property_id: string
  category: AmenityCategory
  code: string
  name_es: string
  name_en: string
  is_highlighted: boolean
  sort_order: number
  created_at: string
}

export interface Season {
  id: string
  property_id: string
  name: string
  start_date: string
  end_date: string
  color: string
  pricing_overrides: {
    rates?: Record<string, number>
    extra_adult_fee?: number
    base_occupancy?: number
    pet_fee?: number
  }
  restrictions: {
    min_los?: number
    closed_room_types?: string[]
  }
  priority: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PropertyService {
  id: string
  property_id: string
  service_type: ServiceType
  name: string
  short_description_es: string | null
  short_description_en: string | null
  long_description_es: string | null
  long_description_en: string | null
  metadata: Record<string, unknown>
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface PropertyImage {
  id: string
  property_id: string
  entity_type: ImageEntityType
  entity_id: string | null
  url: string
  alt_text_es: string | null
  alt_text_en: string | null
  sort_order: number
  is_hero: boolean
  created_at: string
}

export interface ActivationChecklistItem {
  key: string
  label_es: string
  label_en: string
  weight: number
  completed: boolean
}

export interface ActivationChecklist {
  items: ActivationChecklistItem[]
  score: number
  ready_to_publish: boolean
}
