'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getActiveProperty } from '@/lib/property-context'
import type { ImageEntityType, PropertyImage } from '@/types/hotelero'
import { UploadImageSchema, formatZodError } from '@/features/property-setup/schemas/validation'

const STORAGE_BUCKET = 'property-images'
const REVALIDATE_PATH = '/dashboard/setup/gallery'

// ─── getPropertyImages ────────────────────────────────────────────────────────

export interface GetPropertyImagesResult {
  images?: PropertyImage[]
  error?: string
}

/**
 * Returns images for the active property.
 * Optional filters by entity_type and entity_id.
 * Ordered by sort_order ASC, then created_at ASC.
 */
export async function getPropertyImages(
  entityType?: ImageEntityType,
  entityId?: string,
): Promise<GetPropertyImagesResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'No hay propiedad activa' }

  let query = supabase
    .from('property_images')
    .select('*')
    .eq('property_id', property.id)

  if (entityType) {
    query = query.eq('entity_type', entityType)
  }

  if (entityId !== undefined) {
    query = entityId
      ? query.eq('entity_id', entityId)
      : query.is('entity_id', null)
  }

  const { data, error } = await query
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }

  return { images: (data ?? []) as PropertyImage[] }
}

// ─── uploadImage ──────────────────────────────────────────────────────────────

export interface UploadImageResult {
  image?: PropertyImage
  error?: string
}

/**
 * Uploads an image to Supabase Storage and creates a DB record.
 *
 * FormData fields:
 *   - file: File
 *   - entity_type: string (default 'property')
 *   - entity_id: string | '' (empty string treated as null)
 *   - alt_text_es: string (optional)
 *   - alt_text_en: string (optional)
 *
 * Storage path: {property_id}/{entity_type}/{timestamp}-{filename}
 * Uses service client for storage upload (bypasses Storage RLS).
 */
export async function uploadImage(formData: FormData): Promise<UploadImageResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'No hay propiedad activa' }

  // ── Extract and validate form fields ───────────────────────────────────────
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'No se proporcionó ningún archivo' }

  if (file.size > 10 * 1024 * 1024) return { error: 'El archivo excede el límite de 10MB' }

  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { error: 'Solo se permiten imágenes (JPEG, PNG, WebP, GIF)' }
  }

  const entityIdRaw = formData.get('entity_id') as string | null
  const metaInput = {
    entity_type: (formData.get('entity_type') as string | null) ?? 'property',
    entity_id: entityIdRaw && entityIdRaw.trim() !== '' ? entityIdRaw.trim() : null,
    alt_text_es: (formData.get('alt_text_es') as string | null)?.trim() || null,
    alt_text_en: (formData.get('alt_text_en') as string | null)?.trim() || null,
  }
  const parsed = UploadImageSchema.safeParse(metaInput)
  if (!parsed.success) return { error: formatZodError(parsed.error) }

  const entityType = parsed.data.entity_type as ImageEntityType
  const entityId = parsed.data.entity_id ?? null
  const altTextEs = parsed.data.alt_text_es ?? null
  const altTextEn = parsed.data.alt_text_en ?? null

  // ── Build storage path ─────────────────────────────────────────────────────
  const timestamp = Date.now()
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${property.id}/${entityType}/${timestamp}-${safeFilename}`

  // ── Upload to Storage via service client ───────────────────────────────────
  const serviceClient = createServiceClient()
  const { error: uploadError } = await serviceClient.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) return { error: `Error al subir imagen: ${uploadError.message}` }

  // ── Get public URL ─────────────────────────────────────────────────────────
  const { data: publicUrlData } = serviceClient.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath)

  const url = publicUrlData.publicUrl

  // ── Insert DB record ───────────────────────────────────────────────────────
  const { data: image, error: insertError } = await supabase
    .from('property_images')
    .insert({
      property_id: property.id,
      entity_type: entityType,
      entity_id: entityId,
      url,
      alt_text_es: altTextEs,
      alt_text_en: altTextEn,
      sort_order: 0,
      is_hero: false,
    })
    .select()
    .single()

  if (insertError || !image) {
    // Best-effort cleanup: remove the uploaded file if DB insert fails
    await serviceClient.storage.from(STORAGE_BUCKET).remove([storagePath])
    return { error: insertError?.message ?? 'Error al guardar imagen en la base de datos' }
  }

  revalidatePath(REVALIDATE_PATH)
  return { image: image as PropertyImage }
}

// ─── deleteImage ──────────────────────────────────────────────────────────────

export interface DeleteImageResult {
  error?: string
}

/**
 * Deletes an image from Storage and removes the DB record.
 * Verifies the image belongs to the active property before proceeding.
 */
export async function deleteImage(imageId: string): Promise<DeleteImageResult> {
  if (!imageId) return { error: 'imageId es requerido' }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'No hay propiedad activa' }

  // ── Verify ownership and retrieve URL ─────────────────────────────────────
  const { data: image, error: readError } = await supabase
    .from('property_images')
    .select('id, property_id, url')
    .eq('id', imageId)
    .eq('property_id', property.id)
    .maybeSingle()

  if (readError) return { error: `Error al leer imagen: ${readError.message}` }
  if (!image) return { error: 'Imagen no encontrada o sin acceso' }

  // ── Extract storage path from public URL ──────────────────────────────────
  const storagePath = extractStoragePath(image.url as string, property.id)

  // ── Delete from Storage ────────────────────────────────────────────────────
  if (storagePath) {
    const serviceClient = createServiceClient()
    const { error: storageError } = await serviceClient.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath])

    if (storageError) {
      console.error('[deleteImage] Storage deletion failed:', storageError.message)
      // Non-fatal — proceed to delete DB record even if storage cleanup fails
    }
  }

  // ── Delete DB record ───────────────────────────────────────────────────────
  const { error: deleteError } = await supabase
    .from('property_images')
    .delete()
    .eq('id', imageId)

  if (deleteError) return { error: deleteError.message }

  revalidatePath(REVALIDATE_PATH)
  return {}
}

// ─── setHeroImage ─────────────────────────────────────────────────────────────

export interface SetHeroImageResult {
  error?: string
}

/**
 * Sets the hero image for a given entity scope.
 *
 * Steps:
 * 1. Unset any existing hero for the same (property_id, entity_type, entity_id) scope.
 * 2. Set the new hero.
 * 3. If entity_type is 'property', also update properties.hero_image_url.
 */
export async function setHeroImage(
  imageId: string,
  entityType: ImageEntityType,
  entityId: string | null,
): Promise<SetHeroImageResult> {
  if (!imageId) return { error: 'imageId es requerido' }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'No hay propiedad activa' }

  // ── Verify the target image belongs to this property ───────────────────────
  const { data: targetImage, error: readError } = await supabase
    .from('property_images')
    .select('id, url, property_id')
    .eq('id', imageId)
    .eq('property_id', property.id)
    .maybeSingle()

  if (readError) return { error: `Error al leer imagen: ${readError.message}` }
  if (!targetImage) return { error: 'Imagen no encontrada o sin acceso' }

  // ── 1. Unset existing hero in the same entity scope ────────────────────────
  let unsetQuery = supabase
    .from('property_images')
    .update({ is_hero: false })
    .eq('property_id', property.id)
    .eq('entity_type', entityType)
    .eq('is_hero', true)

  if (entityId) {
    unsetQuery = unsetQuery.eq('entity_id', entityId)
  } else {
    unsetQuery = unsetQuery.is('entity_id', null)
  }

  const { error: unsetError } = await unsetQuery
  if (unsetError) return { error: `Error al desmarcar héroe anterior: ${unsetError.message}` }

  // ── 2. Set the new hero ────────────────────────────────────────────────────
  const { error: setError } = await supabase
    .from('property_images')
    .update({ is_hero: true })
    .eq('id', imageId)

  if (setError) return { error: `Error al establecer imagen héroe: ${setError.message}` }

  // ── 3. Sync hero_image_url on the property record ─────────────────────────
  if (entityType === 'property') {
    const { error: propUpdateError } = await supabase
      .from('properties')
      .update({ hero_image_url: targetImage.url })
      .eq('id', property.id)

    if (propUpdateError) {
      console.error('[setHeroImage] Failed to sync hero_image_url:', propUpdateError.message)
      // Non-fatal — the is_hero flag is the source of truth
    }
  }

  revalidatePath(REVALIDATE_PATH)
  return {}
}

// ─── reorderImages ────────────────────────────────────────────────────────────

export interface ReorderImagesResult {
  error?: string
}

/**
 * Updates sort_order for a batch of image IDs.
 * orderedIds[0] receives sort_order 0, orderedIds[1] gets 1, and so on.
 * Only updates images that belong to the active property (verified per-record).
 */
export async function reorderImages(orderedIds: string[]): Promise<ReorderImagesResult> {
  if (!orderedIds || orderedIds.length === 0) return {}

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const property = await getActiveProperty(supabase)
  if (!property) return { error: 'No hay propiedad activa' }

  // Update each image in the ordered list, filtering by property_id for safety
  const updates = orderedIds.map((id, index) =>
    supabase
      .from('property_images')
      .update({ sort_order: index })
      .eq('id', id)
      .eq('property_id', property.id),
  )

  const results = await Promise.all(updates)
  const failed = results.find((r) => r.error)

  if (failed?.error) {
    return { error: `Error al reordenar imágenes: ${failed.error.message}` }
  }

  revalidatePath(REVALIDATE_PATH)
  return {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts the storage object path from a Supabase public URL.
 *
 * Public URL format:
 *   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
 *
 * Returns the path segment after the bucket name, or null if parsing fails.
 */
function extractStoragePath(url: string, propertyId: string): string | null {
  try {
    const marker = `/object/public/${STORAGE_BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx === -1) return null
    const path = url.slice(idx + marker.length)
    // Sanity check: path must start with the property's own folder
    if (!path.startsWith(propertyId)) return null
    return path
  } catch {
    return null
  }
}
