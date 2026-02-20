'use client'

import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

const TIMEZONES = [
  { value: 'America/Guatemala', label: 'Guatemala (GMT-6)' },
  { value: 'America/Mexico_City', label: 'México Ciudad (GMT-6)' },
  { value: 'America/Cancun', label: 'México Cancún (GMT-5)' },
  { value: 'America/Tegucigalpa', label: 'Honduras (GMT-6)' },
  { value: 'America/El_Salvador', label: 'El Salvador (GMT-6)' },
  { value: 'America/Managua', label: 'Nicaragua (GMT-6)' },
  { value: 'America/Costa_Rica', label: 'Costa Rica (GMT-6)' },
  { value: 'America/Panama', label: 'Panamá (GMT-5)' },
  { value: 'America/Bogota', label: 'Colombia (GMT-5)' },
  { value: 'America/Lima', label: 'Perú (GMT-5)' },
  { value: 'America/Santiago', label: 'Chile (GMT-3/-4)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (GMT-3)' },
  { value: 'America/Sao_Paulo', label: 'Brasil (GMT-3)' },
  { value: 'America/New_York', label: 'Nueva York (GMT-5/-4)' },
  { value: 'America/Los_Angeles', label: 'Los Ángeles (GMT-8/-7)' },
]

const CURRENCIES = [
  { value: 'USD', label: 'USD — Dólar americano' },
  { value: 'GTQ', label: 'GTQ — Quetzal guatemalteco' },
  { value: 'MXN', label: 'MXN — Peso mexicano' },
  { value: 'HNL', label: 'HNL — Lempira hondureño' },
  { value: 'NIO', label: 'NIO — Córdoba nicaragüense' },
  { value: 'CRC', label: 'CRC — Colón costarricense' },
  { value: 'COP', label: 'COP — Peso colombiano' },
  { value: 'PEN', label: 'PEN — Sol peruano' },
  { value: 'ARS', label: 'ARS — Peso argentino' },
  { value: 'BRL', label: 'BRL — Real brasileño' },
  { value: 'EUR', label: 'EUR — Euro' },
]

interface StepCreatePropertyProps {
  propertyName: string
  timezone: string
  currency: string
  onNameChange: (value: string) => void
  onTimezoneChange: (value: string) => void
  onCurrencyChange: (value: string) => void
}

export function StepCreateProperty({
  propertyName,
  timezone,
  currency,
  onNameChange,
  onTimezoneChange,
  onCurrencyChange,
}: StepCreatePropertyProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-heading font-semibold text-foreground">
          Configura tu primer hotel
        </h2>
        <p className="text-sm text-foreground-secondary mt-1">
          Puedes agregar más propiedades desde el panel de administración.
        </p>
      </div>

      <Input
        label="Nombre del hotel"
        placeholder="Ej: Hotel Maya Jade, Posada del Sol"
        value={propertyName}
        onChange={(e) => onNameChange(e.target.value)}
        autoFocus
        required
      />

      <Select
        label="Zona horaria"
        options={TIMEZONES}
        value={timezone}
        onChange={(e) => onTimezoneChange(e.target.value)}
      />

      <Select
        label="Moneda de cobro"
        options={CURRENCIES}
        value={currency}
        onChange={(e) => onCurrencyChange(e.target.value)}
      />
    </div>
  )
}
