/**
 * PaymentSettingsPanel — Admin UI
 *
 * Panel de configuración de pasarelas de pago por propiedad.
 * Carga y guarda configuración real desde property_payment_providers.
 *
 * Sprint 3E: se agregarán API keys reales.
 */

'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  getPropertyPaymentProviders,
  savePropertyPaymentProvider,
  deletePropertyPaymentProvider,
} from '@/actions/admin-payments'
import type { PropertyPaymentProvider, GatewayProvider } from '@/types/hotelero'

interface Props {
  propertyId: string
}

const PROVIDER_META: Record<GatewayProvider, { name: string; description: string }> = {
  stripe: {
    name: 'Stripe',
    description: 'Pagos internacionales — tarjetas de crédito/débito globales. Para huéspedes no guatemaltecos.',
  },
  recurrente: {
    name: 'Recurrente',
    description: 'Pagos guatemaltecos — GTQ, tarjetas locales. Para huéspedes de Guatemala.',
  },
}

const ALL_PROVIDERS: GatewayProvider[] = ['recurrente', 'stripe']

export function PaymentSettingsPanel({ propertyId }: Props) {
  const [providers, setProviders] = useState<PropertyPaymentProvider[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // ── Carga inicial ────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    getPropertyPaymentProviders(propertyId).then((result) => {
      if (cancelled) return
      if (result.error) setLoadError(result.error)
      else setProviders(result.providers)
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [propertyId])

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function clearMessages() {
    setActionError(null)
    setSuccessMsg(null)
  }

  function findRecord(p: GatewayProvider): PropertyPaymentProvider | undefined {
    return providers.find((r) => r.provider === p)
  }

  // ── Toggle enable/disable ────────────────────────────────────────────────────

  function handleToggle(providerKey: GatewayProvider) {
    clearMessages()
    const existing = findRecord(providerKey)
    const nextEnabled = !(existing?.is_enabled ?? false)

    startTransition(async () => {
      const result = await savePropertyPaymentProvider({
        property_id: propertyId,
        provider:    providerKey,
        is_enabled:  nextEnabled,
        is_default:  existing?.is_default ?? false,
        config_json: existing?.config_json ?? {},
      })

      if (result.error) { setActionError(result.error); return }

      if (result.provider) {
        setProviders((prev) => {
          const idx = prev.findIndex((p) => p.provider === providerKey)
          if (idx === -1) return [...prev, result.provider!]
          return prev.map((p) => p.provider === providerKey ? result.provider! : p)
        })
        setSuccessMsg(`${PROVIDER_META[providerKey].name} ${nextEnabled ? 'activado' : 'desactivado'}.`)
      }
    })
  }

  // ── Marcar como default ───────────────────────────────────────────────────────

  function handleSetDefault(providerKey: GatewayProvider) {
    clearMessages()
    const existing = findRecord(providerKey)

    startTransition(async () => {
      const result = await savePropertyPaymentProvider({
        property_id: propertyId,
        provider:    providerKey,
        is_enabled:  true,
        is_default:  true,
        config_json: existing?.config_json ?? {},
      })

      if (result.error) { setActionError(result.error); return }

      setProviders((prev) =>
        prev.map((p) => ({ ...p, is_default: p.provider === providerKey })),
      )
      setSuccessMsg(`${PROVIDER_META[providerKey].name} marcado como predeterminado.`)
    })
  }

  // ── Eliminar configuración ────────────────────────────────────────────────────

  function handleDelete(providerKey: GatewayProvider) {
    clearMessages()
    const existing = findRecord(providerKey)
    if (!existing) return

    startTransition(async () => {
      const result = await deletePropertyPaymentProvider(existing.id)
      if (result.error) { setActionError(result.error); return }
      setProviders((prev) => prev.filter((p) => p.provider !== providerKey))
      setSuccessMsg(`Configuración de ${PROVIDER_META[providerKey].name} eliminada.`)
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-foreground-secondary animate-pulse">
        Cargando configuración de pagos...
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
        Error al cargar: {loadError}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Pasarelas de pago</h2>
        <p className="text-sm text-foreground-secondary mt-1">
          Configura qué proveedores de pago están disponibles para los huéspedes de esta propiedad.
        </p>
      </div>

      {/* Feedback */}
      {successMsg && (
        <p className="px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700">
          {successMsg}
        </p>
      )}
      {actionError && (
        <p className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {/* Provider cards */}
      <div className="space-y-4">
        {ALL_PROVIDERS.map((providerKey) => {
          const record    = findRecord(providerKey)
          const meta      = PROVIDER_META[providerKey]
          const isEnabled = record?.is_enabled ?? false
          const isDefault = record?.is_default ?? false

          return (
            <div
              key={providerKey}
              className={`p-4 rounded-2xl border transition-colors ${
                isEnabled ? 'border-primary-200 bg-primary-50/30' : 'border-border bg-surface'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground text-sm">{meta.name}</p>
                    {isDefault && isEnabled && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-100 text-primary-700">
                        Por defecto
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground-secondary">{meta.description}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggle(providerKey)}
                  disabled={isPending}
                  className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${
                    isEnabled ? 'bg-primary-600' : 'bg-border'
                  }`}
                  aria-label={`${isEnabled ? 'Desactivar' : 'Activar'} ${meta.name}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      isEnabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {isEnabled && (
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/60">
                  {!isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(providerKey)}
                      disabled={isPending}
                      className="text-xs text-primary-600 hover:text-primary-700 disabled:opacity-50 transition-colors"
                    >
                      Marcar como predeterminado
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(providerKey)}
                    disabled={isPending}
                    className="text-xs text-red-500 hover:text-red-600 disabled:opacity-50 transition-colors ml-auto"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* API Keys placeholder */}
      <div className="p-4 rounded-2xl border border-dashed border-border text-xs text-foreground-muted space-y-1">
        <p className="font-medium">Credenciales de API — próximamente (Sprint 3E)</p>
        <p>Stripe Secret Key y Recurrente API Key se configurarán de forma segura en el siguiente sprint.</p>
      </div>
    </div>
  )
}
