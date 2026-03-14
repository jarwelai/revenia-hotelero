'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { updatePropertyProfile } from '@/actions/property-setup'
import type { PropertyType } from '@/types/hotelero'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PropertyProfileFormProps {
  initialData: {
    name: string
    address?: string | null
    city?: string | null
    state_province?: string | null
    country_iso2?: string | null
    postal_code?: string | null
    phone?: string | null
    email?: string | null
    website?: string | null
    check_in_time?: string | null
    check_out_time?: string | null
    star_rating?: number | null
    property_type?: PropertyType | null
  }
  canEdit: boolean
}

// ─── Static option lists ─────────────────────────────────────────────────────

const PROPERTY_TYPE_OPTIONS = [
  { value: '', label: 'Seleccionar tipo...' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'hostal', label: 'Hostal' },
  { value: 'boutique', label: 'Hotel Boutique' },
  { value: 'resort', label: 'Resort' },
  { value: 'posada', label: 'Posada' },
  { value: 'apart-hotel', label: 'Apart-Hotel' },
  { value: 'villa', label: 'Villa' },
  { value: 'cabin', label: 'Cabana' },
]

const STAR_RATING_OPTIONS = [
  { value: '', label: 'Sin clasificacion' },
  { value: '1', label: '1 estrella' },
  { value: '2', label: '2 estrellas' },
  { value: '3', label: '3 estrellas' },
  { value: '4', label: '4 estrellas' },
  { value: '5', label: '5 estrellas' },
]

const COUNTRY_OPTIONS = [
  { value: '', label: 'Seleccionar pais...' },
  { value: 'GT', label: 'Guatemala' },
  { value: 'MX', label: 'Mexico' },
  { value: 'HN', label: 'Honduras' },
  { value: 'SV', label: 'El Salvador' },
  { value: 'NI', label: 'Nicaragua' },
  { value: 'CR', label: 'Costa Rica' },
  { value: 'PA', label: 'Panama' },
  { value: 'CO', label: 'Colombia' },
  { value: 'PE', label: 'Peru' },
  { value: 'CL', label: 'Chile' },
  { value: 'AR', label: 'Argentina' },
  { value: 'BR', label: 'Brasil' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'ES', label: 'Espana' },
]

// ─── Section card wrapper ────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-white rounded-2xl border border-border p-5 md:p-6 space-y-4">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PropertyProfileForm({
  initialData,
  canEdit,
}: PropertyProfileFormProps) {
  // ─── Form state ─────────────────────────────────────────────────────────
  const [name, setName] = useState(initialData.name)
  const [propertyType, setPropertyType] = useState(initialData.property_type ?? '')
  const [starRating, setStarRating] = useState(
    initialData.star_rating != null ? String(initialData.star_rating) : '',
  )

  const [address, setAddress] = useState(initialData.address ?? '')
  const [city, setCity] = useState(initialData.city ?? '')
  const [stateProvince, setStateProvince] = useState(initialData.state_province ?? '')
  const [countryIso2, setCountryIso2] = useState(initialData.country_iso2 ?? '')
  const [postalCode, setPostalCode] = useState(initialData.postal_code ?? '')

  const [phone, setPhone] = useState(initialData.phone ?? '')
  const [email, setEmail] = useState(initialData.email ?? '')
  const [website, setWebsite] = useState(initialData.website ?? '')

  const [checkInTime, setCheckInTime] = useState(initialData.check_in_time ?? '')
  const [checkOutTime, setCheckOutTime] = useState(initialData.check_out_time ?? '')

  // ─── Feedback state ──────────────────────────────────────────────────────
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  // ─── Submit handler ──────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setSubmitSuccess(false)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('name', name.trim())
      formData.set('property_type', propertyType)
      formData.set('star_rating', starRating)
      formData.set('address', address.trim())
      formData.set('city', city.trim())
      formData.set('state_province', stateProvince.trim())
      formData.set('country_iso2', countryIso2)
      formData.set('postal_code', postalCode.trim())
      formData.set('phone', phone.trim())
      formData.set('email', email.trim())
      formData.set('website', website.trim())
      formData.set('check_in_time', checkInTime)
      formData.set('check_out_time', checkOutTime)

      const result = await updatePropertyProfile(formData)

      if (result.error) {
        setSubmitError(result.error)
        return
      }

      setSubmitSuccess(true)
    })
  }

  const disabled = !canEdit || isPending

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Feedback messages */}
      {submitError && (
        <div
          role="alert"
          aria-live="assertive"
          className="px-4 py-3 rounded-xl bg-error-50 border border-error-200 text-sm text-error-700"
        >
          {submitError}
        </div>
      )}
      {submitSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="px-4 py-3 rounded-xl bg-success-50 border border-success-200 text-sm text-success-700"
        >
          Cambios guardados correctamente.
        </div>
      )}

      {/* Section 1: Informacion basica */}
      <SectionCard title="Informacion basica">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input
              label="Nombre del hotel"
              placeholder="Ej: Hotel Paraiso"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={disabled}
              required
            />
          </div>
          <Select
            label="Tipo de propiedad"
            options={PROPERTY_TYPE_OPTIONS}
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            disabled={disabled}
          />
          <Select
            label="Clasificacion por estrellas"
            options={STAR_RATING_OPTIONS}
            value={starRating}
            onChange={(e) => setStarRating(e.target.value)}
            disabled={disabled}
          />
        </div>
      </SectionCard>

      {/* Section 2: Ubicacion */}
      <SectionCard title="Ubicacion">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input
              label="Direccion"
              placeholder="Ej: 5a Avenida 12-34 Zona 1"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={disabled}
            />
          </div>
          <Input
            label="Ciudad"
            placeholder="Ej: Ciudad de Guatemala"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={disabled}
          />
          <Input
            label="Estado / Provincia / Departamento"
            placeholder="Ej: Guatemala"
            value={stateProvince}
            onChange={(e) => setStateProvince(e.target.value)}
            disabled={disabled}
          />
          <Select
            label="Pais"
            options={COUNTRY_OPTIONS}
            value={countryIso2}
            onChange={(e) => setCountryIso2(e.target.value)}
            disabled={disabled}
          />
          <Input
            label="Codigo postal"
            placeholder="Ej: 01001"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            disabled={disabled}
          />
        </div>
      </SectionCard>

      {/* Section 3: Contacto */}
      <SectionCard title="Contacto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Telefono"
            placeholder="+502 2234 5678"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={disabled}
          />
          <Input
            label="Correo electronico"
            placeholder="reservas@mihotel.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={disabled}
          />
          <div className="sm:col-span-2">
            <Input
              label="Sitio web"
              placeholder="https://www.mihotel.com"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>
      </SectionCard>

      {/* Section 4: Horarios */}
      <SectionCard title="Horarios">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Hora de check-in"
            type="time"
            value={checkInTime}
            onChange={(e) => setCheckInTime(e.target.value)}
            disabled={disabled}
          />
          <Input
            label="Hora de check-out"
            type="time"
            value={checkOutTime}
            onChange={(e) => setCheckOutTime(e.target.value)}
            disabled={disabled}
          />
        </div>
      </SectionCard>

      {/* Submit */}
      {canEdit && (
        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isPending}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            Guardar cambios
          </Button>
        </div>
      )}
    </form>
  )
}
