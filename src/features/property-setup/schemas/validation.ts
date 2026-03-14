import { z } from 'zod'

// ─── Shared helpers ──────────────────────────────────────────────────────────

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hexadecimal inválido')
const uuid = z.string().uuid('ID inválido')
const trimmedString = (maxLen: number) => z.string().trim().min(1).max(maxLen)
const optionalTrimmed = (maxLen: number) => z.string().max(maxLen).optional()

// ─── Seasons ─────────────────────────────────────────────────────────────────

export const CreateSeasonSchema = z.object({
  name: trimmedString(100),
  start_date: dateString,
  end_date: dateString,
  color: hexColor.optional(),
  pricing_overrides: z.object({
    rates: z.record(z.string(), z.number().nonnegative()).optional(),
  }).optional(),
  restrictions: z.object({
    min_los: z.number().int().positive().optional(),
    closed_room_types: z.array(uuid).optional(),
  }).optional(),
  priority: z.number().int().min(0).max(100).optional(),
}).refine(
  (d) => d.end_date > d.start_date,
  { message: 'La fecha de fin debe ser posterior a la de inicio', path: ['end_date'] },
)

export const UpdateSeasonSchema = z.object({
  name: trimmedString(100).optional(),
  start_date: dateString.optional(),
  end_date: dateString.optional(),
  color: hexColor.optional(),
  pricing_overrides: z.object({
    rates: z.record(z.string(), z.number().nonnegative()).optional(),
  }).optional(),
  restrictions: z.object({
    min_los: z.number().int().positive().optional(),
    closed_room_types: z.array(uuid).optional(),
  }).optional(),
  priority: z.number().int().min(0).max(100).optional(),
  is_active: z.boolean().optional(),
}).refine(
  (d) => {
    if (d.start_date && d.end_date) return d.end_date > d.start_date
    return true
  },
  { message: 'La fecha de fin debe ser posterior a la de inicio', path: ['end_date'] },
)

// ─── Property Profile ────────────────────────────────────────────────────────

export const PROPERTY_TYPES = [
  'hotel', 'hostal', 'boutique', 'resort', 'posada', 'apart-hotel', 'villa', 'cabin',
] as const

export const UpdatePropertyProfileSchema = z.object({
  name: trimmedString(200).optional(),
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state_province: z.string().max(100).nullable().optional(),
  country_iso2: z.string().length(2).nullable().optional(),
  postal_code: z.string().max(20).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().max(254).nullable().optional(),
  website: z.string().url().max(500).nullable().optional(),
  check_in_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  check_out_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  star_rating: z.number().int().min(1).max(5).nullable().optional(),
  property_type: z.enum(PROPERTY_TYPES).nullable().optional(),
  hero_image_url: z.string().url().nullable().optional(),
})

// ─── Amenities ───────────────────────────────────────────────────────────────

export const AMENITY_CATEGORIES = [
  'general', 'pool', 'business', 'wellness', 'dining', 'accessibility', 'outdoor', 'custom',
] as const

export const AddAmenitySchema = z.object({
  category: z.enum(AMENITY_CATEGORIES),
  code: trimmedString(50),
  name_es: trimmedString(200),
  name_en: trimmedString(200),
  is_highlighted: z.boolean().optional(),
})

// ─── Services ────────────────────────────────────────────────────────────────

export const SERVICE_TYPES = [
  'restaurant', 'spa', 'bar', 'daypass', 'events', 'tours', 'custom',
] as const

export const CreateServiceSchema = z.object({
  service_type: z.enum(SERVICE_TYPES),
  name: trimmedString(200),
  short_description_es: optionalTrimmed(500),
  short_description_en: optionalTrimmed(500),
  long_description_es: optionalTrimmed(2000),
  long_description_en: optionalTrimmed(2000),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const UpdateServiceSchema = z.object({
  name: trimmedString(200).optional(),
  short_description_es: z.string().max(500).optional(),
  short_description_en: z.string().max(500).optional(),
  long_description_es: z.string().max(2000).optional(),
  long_description_en: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
})

// ─── Images ──────────────────────────────────────────────────────────────────

export const IMAGE_ENTITY_TYPES = ['property', 'room_type', 'service'] as const

export const UploadImageSchema = z.object({
  entity_type: z.enum(IMAGE_ENTITY_TYPES).default('property'),
  entity_id: uuid.nullable().optional(),
  alt_text_es: z.string().max(300).nullable().optional(),
  alt_text_en: z.string().max(300).nullable().optional(),
})

// ─── Error formatting ────────────────────────────────────────────────────────

/** Extracts the first human-readable error message from a ZodError. */
export function formatZodError(error: z.ZodError): string {
  const first = error.issues[0]
  if (!first) return 'Datos inválidos'
  const path = first.path.length > 0 ? `${first.path.join('.')}: ` : ''
  return `${path}${first.message}`
}
