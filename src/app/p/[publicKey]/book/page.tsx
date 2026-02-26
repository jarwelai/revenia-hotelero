import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getPublicPropertySettings } from '@/actions/public-content'
import { resolvePublicLang } from '@/lib/public'
import { BookWidget } from '@/features/public-booking/components/BookWidget'
import { SelectRoomButton } from '@/features/public-booking/components/SelectRoomButton'
import { LanguageSwitcher } from '@/components/public/LanguageSwitcher'
import { searchPublicRoomTypes } from '@/actions/public-search'
import type { PublicRoomTypeSearchResult } from '@/lib/public/search'

interface PageProps {
  params: Promise<{ publicKey: string }>
  searchParams: Promise<{
    lang?: string
    expired?: string
    checkIn?: string
    checkOut?: string
    adults?: string
    children?: string
    pets?: string
  }>
}

export default async function PublicBookPage({ params, searchParams }: PageProps) {
  const { publicKey } = await params
  const {
    lang: queryLang,
    expired,
    checkIn,
    checkOut,
    adults: adultsStr,
    children: childrenStr,
    pets: petsStr,
  } = await searchParams

  const supabase = createServiceClient()
  const { data: property } = await supabase
    .from('properties')
    .select('id, name')
    .eq('public_key', publicKey)
    .maybeSingle()

  if (!property) notFound()

  const publicSettings = await getPublicPropertySettings(publicKey)
  const lang = resolvePublicLang(publicSettings?.default_lang ?? 'es', queryLang)
  const displayName = publicSettings?.public_brand_name ?? property.name

  // Verificar si la propiedad tiene precios por niño
  const { count: childRulesCount } = await supabase
    .from('child_pricing_rules')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', property.id)

  const hasChildPricing = (childRulesCount ?? 0) > 0

  // Obtener configuracion de politica de mascotas
  const { data: commercialSettings } = await supabase
    .from('property_commercial_settings')
    .select('pet_policy_enabled')
    .eq('property_id', property.id)
    .maybeSingle()

  const hasPetPolicy = commercialSettings?.pet_policy_enabled ?? false

  // Parsear defaults de searchParams
  const defaultAdults = adultsStr ? (parseInt(adultsStr, 10) || 2) : 2
  const defaultChildrenAges: number[] = childrenStr
    ? childrenStr.split(',').map(Number).filter((n) => !isNaN(n) && n >= 0)
    : []
  const defaultPetCount = petsStr ? (parseInt(petsStr, 10) || 0) : 0
  const defaultHasPets = defaultPetCount > 0

  // Búsqueda con fechas específicas si se proporcionan
  let searchResults: PublicRoomTypeSearchResult[] | null = null
  let searchError: string | null = null

  if (checkIn && checkOut && adultsStr) {
    const adults = parseInt(adultsStr, 10) || 1
    const result = await searchPublicRoomTypes({
      publicKey,
      checkIn,
      checkOut,
      adults,
      childrenAges: defaultChildrenAges,
      lang,
    })
    searchResults = result.results ?? null
    searchError = result.error ?? null
  }

  const fmt = (val: number, currency: string) =>
    new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-ES', { style: 'currency', currency }).format(val)

  const esHref = `/p/${publicKey}/book?lang=es${expired === '1' ? '&expired=1' : ''}`
  const enHref = `/p/${publicKey}/book?lang=en${expired === '1' ? '&expired=1' : ''}`

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">{displayName}</h1>
            <p className="mt-1 text-foreground-secondary">
              {lang === 'en' ? 'Book your stay' : 'Reserva tu estancia'}
            </p>
          </div>
          <LanguageSwitcher currentLang={lang} esHref={esHref} enHref={enHref} />
        </div>

        {expired === '1' && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            {lang === 'en'
              ? 'Your quote has expired. Please start a new search.'
              : 'Tu cotización ha expirado. Por favor inicia una nueva búsqueda.'}
          </div>
        )}

        <BookWidget
          publicKey={publicKey}
          lang={lang}
          hasChildPricing={hasChildPricing}
          hasPetPolicy={hasPetPolicy}
          defaultCheckIn={checkIn}
          defaultCheckOut={checkOut}
          defaultAdults={defaultAdults}
          defaultChildrenAges={defaultChildrenAges}
          defaultHasPets={defaultHasPets}
          defaultPetCount={defaultPetCount}
        />

        {searchError && (
          <div className="mt-6 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {searchError}
          </div>
        )}

        {searchResults !== null && (
          <div className="mt-6 space-y-3">
            <h2 className="text-sm font-semibold text-foreground-secondary uppercase tracking-wide">
              {lang === 'en' ? 'Available room types' : 'Tipos de habitación disponibles'}
            </h2>

            {searchResults.length === 0 ? (
              <p className="text-sm text-foreground-secondary">
                {lang === 'en'
                  ? 'No availability for the selected dates.'
                  : 'Sin disponibilidad para las fechas seleccionadas.'}
              </p>
            ) : (
              searchResults.map((rt) => (
                <div key={rt.room_type_id} className="p-4 rounded-xl bg-white border border-border shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{rt.name}</p>
                      {rt.description && (
                        <p className="text-xs text-foreground-secondary mt-0.5 line-clamp-2">{rt.description}</p>
                      )}
                      {rt.amenities && rt.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {rt.amenities.slice(0, 5).map((amenity) => (
                            <span
                              key={amenity}
                              className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-foreground-muted"
                            >
                              {amenity}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-foreground-muted mt-1.5">
                        {rt.available_units}{' '}
                        {lang === 'en'
                          ? 'available'
                          : rt.available_units === 1 ? 'disponible' : 'disponibles'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-foreground">{fmt(rt.total_for_stay, rt.currency)}</p>
                      <p className="text-xs text-foreground-muted">
                        {lang === 'en' ? 'total stay' : 'estancia total'}
                      </p>
                    </div>
                  </div>
                  <SelectRoomButton
                    publicKey={publicKey}
                    lang={lang}
                    roomTypeId={rt.room_type_id}
                    checkIn={checkIn!}
                    checkOut={checkOut!}
                    adults={parseInt(adultsStr!, 10) || 1}
                    childrenAges={defaultChildrenAges}
                    hasPets={defaultHasPets}
                    petCount={defaultPetCount}
                  />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
