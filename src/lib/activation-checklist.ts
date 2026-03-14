import { createServiceClient } from '@/lib/supabase/server'
import type { ActivationChecklist, ActivationChecklistItem } from '@/types/hotelero'

export async function computeActivationChecklist(propertyId: string): Promise<ActivationChecklist> {
  const supabase = createServiceClient()

  const [
    propertyResult,
    roomTypesResult,
    roomsResult,
    rateIntervalsResult,
    commercialResult,
    taxRulesResult,
    contentSlotsResult,
    paymentProvidersResult,
    amenitiesResult,
    imagesResult,
    servicesResult,
  ] = await Promise.all([
    supabase
      .from('properties')
      .select('name, address, phone, is_published')
      .eq('id', propertyId)
      .single(),

    supabase
      .from('room_types')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId),

    supabase
      .from('rooms')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId),

    supabase
      .from('rate_plan_intervals')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId),

    supabase
      .from('property_commercial_settings')
      .select('property_id')
      .eq('property_id', propertyId)
      .maybeSingle(),

    supabase
      .from('tax_rules')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId),

    supabase
      .from('public_content_slots')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId),

    supabase
      .from('property_payment_providers')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('is_enabled', true),

    supabase
      .from('property_amenities')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId),

    supabase
      .from('property_images')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId),

    supabase
      .from('property_services')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('is_active', true),
  ])

  const property = propertyResult.data

  const items: ActivationChecklistItem[] = [
    {
      key: 'identity',
      label_es: 'Identidad del hotel',
      label_en: 'Hotel identity',
      weight: 0.10,
      completed: Boolean(
        property?.name && property?.address && property?.phone
      ),
    },
    {
      key: 'rooms',
      label_es: 'Habitaciones',
      label_en: 'Rooms',
      weight: 0.10,
      completed: (roomTypesResult.count ?? 0) > 0 && (roomsResult.count ?? 0) > 0,
    },
    {
      key: 'amenities',
      label_es: 'Amenidades',
      label_en: 'Amenities',
      weight: 0.05,
      completed: (amenitiesResult.count ?? 0) > 0,
    },
    {
      key: 'gallery',
      label_es: 'Galería de fotos',
      label_en: 'Photo gallery',
      weight: 0.05,
      completed: (imagesResult.count ?? 0) > 0,
    },
    {
      key: 'services',
      label_es: 'Servicios',
      label_en: 'Services',
      weight: 0.05,
      completed: (servicesResult.count ?? 0) > 0,
    },
    {
      key: 'rates',
      label_es: 'Tarifas base',
      label_en: 'Base rates',
      weight: 0.10,
      completed: (rateIntervalsResult.count ?? 0) > 0,
    },
    {
      key: 'pricing',
      label_es: 'Configuración comercial',
      label_en: 'Commercial settings',
      weight: 0.10,
      completed: commercialResult.data !== null,
    },
    {
      key: 'taxes',
      label_es: 'Impuestos',
      label_en: 'Taxes',
      weight: 0.10,
      completed: (taxRulesResult.count ?? 0) > 0,
    },
    {
      key: 'content',
      label_es: 'Contenido público',
      label_en: 'Public content',
      weight: 0.10,
      completed: (contentSlotsResult.count ?? 0) > 0,
    },
    {
      key: 'payments',
      label_es: 'Pagos configurados',
      label_en: 'Payment setup',
      weight: 0.15,
      completed: (paymentProvidersResult.count ?? 0) > 0,
    },
    {
      key: 'published',
      label_es: 'Publicado',
      label_en: 'Published',
      weight: 0.10,
      completed: property?.is_published === true,
    },
  ]

  const score = items.reduce(
    (acc, item) => acc + item.weight * (item.completed ? 1 : 0),
    0
  )

  return {
    items,
    score,
    ready_to_publish: score >= 0.8,
  }
}
