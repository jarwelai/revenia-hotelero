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
  lang: PublicLang
  quote_payload: QuoteResult
  expires_at: string
  created_at: string
}
