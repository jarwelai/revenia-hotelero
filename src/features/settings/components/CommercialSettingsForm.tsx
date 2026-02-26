'use client'

import { useState, useTransition, useMemo } from 'react'
import { saveCommercialSettings } from '@/actions/settings'
import type { PropertyCommercialSettings, ChargeMode } from '@/types/hotelero'

// ─── Currency helpers ─────────────────────────────────────────────────────────

const POPULAR_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'MXN', 'GTQ', 'COP', 'ARS', 'CLP', 'PEN', 'BRL',
  'CRC', 'HNL', 'NIO', 'DOP', 'PAB', 'UYU', 'BOB', 'PYG', 'CAD', 'AUD',
]

function getAllCurrencies(): string[] {
  try {
    return Intl.supportedValuesOf('currency')
  } catch {
    return POPULAR_CURRENCIES
  }
}

function getCurrencyLabel(code: string, locale = 'es'): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: 'currency' }).of(code)
    return name ? `${code} — ${name}` : code
  } catch {
    return code
  }
}

function CurrencySelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string
  onChange: (v: string) => void
  disabled: boolean
  className: string
}) {
  const options = useMemo(() => {
    const all = getAllCurrencies()
    const popular = POPULAR_CURRENCIES.filter((c) => all.includes(c))
    const rest = all.filter((c) => !POPULAR_CURRENCIES.includes(c))
    return { popular, rest }
  }, [])

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={className}
    >
      <optgroup label="Populares">
        {options.popular.map((c) => (
          <option key={c} value={c}>{getCurrencyLabel(c)}</option>
        ))}
      </optgroup>
      <optgroup label="Todas">
        {options.rest.map((c) => (
          <option key={c} value={c}>{getCurrencyLabel(c)}</option>
        ))}
      </optgroup>
    </select>
  )
}

interface CommercialSettingsFormProps {
  propertyId: string
  initialSettings: PropertyCommercialSettings | null
  canEdit: boolean
}

const DEFAULTS = {
  currency: 'USD',
  prices_include_taxes: false,
  charge_mode: 'per_room' as ChargeMode,
  base_occupancy: 2,
  extra_adult_fee: 0,
  child_policy_enabled: true,
  pet_policy_enabled: false,
  pet_fee: 0,
}

export function CommercialSettingsForm({
  propertyId,
  initialSettings,
  canEdit,
}: CommercialSettingsFormProps) {
  const s = initialSettings ?? DEFAULTS

  const [chargeMode, setChargeMode] = useState<ChargeMode>(s.charge_mode)
  const [baseOccupancy, setBaseOccupancy] = useState(String(s.base_occupancy))
  const [extraAdultFee, setExtraAdultFee] = useState(String(s.extra_adult_fee))
  const [pricesIncludeTaxes, setPricesIncludeTaxes] = useState(s.prices_include_taxes)
  const [childPolicyEnabled, setChildPolicyEnabled] = useState(s.child_policy_enabled)
  const [petPolicyEnabled, setPetPolicyEnabled] = useState(s.pet_policy_enabled ?? false)
  const [petFee, setPetFee] = useState(String(s.pet_fee ?? 0))
  const [currency, setCurrency] = useState(s.currency)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    startTransition(async () => {
      const result = await saveCommercialSettings({
        property_id: propertyId,
        currency,
        prices_include_taxes: pricesIncludeTaxes,
        charge_mode: chargeMode,
        base_occupancy: parseInt(baseOccupancy, 10) || 2,
        extra_adult_fee: parseFloat(extraAdultFee) || 0,
        child_policy_enabled: childPolicyEnabled,
        pet_policy_enabled: petPolicyEnabled,
        pet_fee: parseFloat(petFee) || 0,
      })

      if (result.error) {
        setError(result.error)
        return
      }
      setSuccess(true)
    })
  }

  const inputCls = 'w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:bg-gray-50 disabled:text-foreground-muted'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-xl bg-error-50 border border-error-200 px-4 py-3 text-sm text-error-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-success-50 border border-success-200 px-4 py-3 text-sm text-success-700">
          ✓ Configuración guardada correctamente
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Moneda */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Moneda</label>
          <CurrencySelect
            value={currency}
            onChange={setCurrency}
            disabled={!canEdit}
            className={inputCls}
          />
        </div>

        {/* Modo de cargo */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Modo de cargo</label>
          <select
            value={chargeMode}
            onChange={(e) => setChargeMode(e.target.value as ChargeMode)}
            disabled={!canEdit}
            className={inputCls}
          >
            <option value="per_room">Por habitación</option>
            <option value="per_person">Por persona</option>
          </select>
        </div>

        {/* Ocupación base */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Ocupación base
            <span className="ml-1 text-xs text-foreground-muted">(personas incluidas en tarifa)</span>
          </label>
          <input
            type="number"
            min="1"
            max="20"
            value={baseOccupancy}
            onChange={(e) => setBaseOccupancy(e.target.value)}
            disabled={!canEdit}
            className={inputCls}
          />
        </div>

        {/* Tarifa adulto extra */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Tarifa adulto extra
            <span className="ml-1 text-xs text-foreground-muted">({currency}/noche, si supera ocupación base)</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={extraAdultFee}
            onChange={(e) => setExtraAdultFee(e.target.value)}
            disabled={!canEdit}
            className={inputCls}
          />
        </div>
      </div>

      {/* Checkboxes */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center gap-3">
          <input
            id="prices_include_taxes"
            type="checkbox"
            checked={pricesIncludeTaxes}
            onChange={(e) => setPricesIncludeTaxes(e.target.checked)}
            disabled={!canEdit}
            className="w-4 h-4 rounded border-border text-accent-600 focus:ring-accent-500"
          />
          <label htmlFor="prices_include_taxes" className="text-sm text-foreground">
            Las tarifas ya incluyen impuestos (precios brutos)
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            id="child_policy_enabled"
            type="checkbox"
            checked={childPolicyEnabled}
            onChange={(e) => setChildPolicyEnabled(e.target.checked)}
            disabled={!canEdit}
            className="w-4 h-4 rounded border-border text-accent-600 focus:ring-accent-500"
          />
          <label htmlFor="child_policy_enabled" className="text-sm text-foreground">
            Aplicar política de niños
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            id="pet_policy_enabled"
            type="checkbox"
            checked={petPolicyEnabled}
            onChange={(e) => setPetPolicyEnabled(e.target.checked)}
            disabled={!canEdit}
            className="w-4 h-4 rounded border-border text-accent-600 focus:ring-accent-500"
          />
          <label htmlFor="pet_policy_enabled" className="text-sm text-foreground">
            Aceptar mascotas
          </label>
        </div>
        {petPolicyEnabled && (
          <div className="ml-7">
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Tarifa por mascota
              <span className="ml-1 text-xs text-foreground-muted">({currency}/noche)</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={petFee}
              onChange={(e) => setPetFee(e.target.value)}
              disabled={!canEdit}
              className={inputCls + ' max-w-48'}
            />
          </div>
        )}
      </div>

      {canEdit && (
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Guardando…' : 'Guardar configuración'}
          </button>
        </div>
      )}
    </form>
  )
}
