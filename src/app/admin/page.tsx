'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  listPropertiesWithConfig,
  toggleAiReviewResponses,
  getSystemIntegrationStatus,
} from '@/actions/super-admin'
import type { PropertyWithConfig, SystemIntegrationStatus } from '@/actions/super-admin'
import { SecretConfigModal } from '@/features/admin/components/SecretConfigModal'
import type { ConfigDefinition } from '@/features/admin/components/SecretConfigModal'
import { DeleteConfirmDialog } from '@/features/admin/components/DeleteConfirmDialog'

// ─── Config definitions ────────────────────────────────────────────────────────

const CONFIG_DEFINITIONS: ConfigDefinition[] = [
  {
    id: 'serpapi',
    title: 'SerpAPI Key',
    description: 'Descubrimiento de resenas en Google Maps y TripAdvisor',
    fields: [
      {
        key: 'SERPAPI_KEY',
        label: 'API Key',
        placeholder: 'ej: abc123...',
        type: 'password',
      },
    ],
    instructions:
      '1. Ve a serpapi.com y crea una cuenta\n2. En el Dashboard, copia tu API Key\n3. Pegala aqui y guarda',
    keys: ['SERPAPI_KEY'],
  },
  {
    id: 'google_oauth',
    title: 'Google OAuth',
    description: 'Responder resenas directamente en Google Business',
    fields: [
      {
        key: 'GOOGLE_CLIENT_ID',
        label: 'Client ID',
        placeholder: '123456789.apps.googleusercontent.com',
        type: 'text',
      },
      {
        key: 'GOOGLE_CLIENT_SECRET',
        label: 'Client Secret',
        placeholder: 'GOCSPX-...',
        type: 'password',
      },
    ],
    instructions:
      '1. Ve a console.cloud.google.com\n2. APIs & Services → Credentials\n3. Crea un OAuth 2.0 Client ID (tipo Web)\n4. Agrega redirect URI: https://tu-dominio.com/api/auth/google/callback\n5. Copia Client ID y Client Secret',
    keys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  },
  {
    id: 'encryption',
    title: 'Clave de Cifrado',
    description: 'Almacenamiento seguro de tokens OAuth (64 caracteres hex)',
    fields: [
      {
        key: 'TOKEN_ENCRYPTION_KEY',
        label: 'Clave (64 hex)',
        placeholder: '64 caracteres hexadecimales',
        type: 'password',
        helpText:
          'Exactamente 64 caracteres hexadecimales (0-9, a-f). Genera con: openssl rand -hex 32',
      },
    ],
    instructions:
      '1. Abre una terminal\n2. Ejecuta: openssl rand -hex 32\n3. Copia el resultado (64 caracteres)\n4. Pegalo aqui',
    keys: ['TOKEN_ENCRYPTION_KEY'],
  },
  {
    id: 'openrouter',
    title: 'OpenRouter API',
    description: 'Generacion de respuestas automaticas con IA',
    fields: [
      {
        key: 'OPENROUTER_API_KEY',
        label: 'API Key',
        placeholder: 'sk-or-v1-...',
        type: 'password',
      },
    ],
    instructions:
      '1. Ve a openrouter.ai y crea una cuenta\n2. Settings → API Keys → genera una nueva\n3. Copia la key y pegala aqui',
    keys: ['OPENROUTER_API_KEY'],
  },
  {
    id: 'cron',
    title: 'CRON Secret',
    description: 'Sincronizacion automatica programada de resenas',
    fields: [
      {
        key: 'CRON_SECRET',
        label: 'Secret',
        placeholder: 'mi-secreto-cron-123',
        type: 'password',
        helpText:
          'Cualquier string secreto. Se usa como Bearer token para proteger /api/cron/sync-reviews',
      },
    ],
    instructions:
      '1. Elige un secreto aleatorio (o genera con: openssl rand -hex 16)\n2. Pegalo aqui\n3. Asegurate de usar el mismo secreto en la configuracion del cron job',
    keys: ['CRON_SECRET'],
  },
]

// ─── Status indicator atoms ────────────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${ok ? 'bg-green-500' : 'bg-red-400'}`}
      aria-hidden="true"
    />
  )
}

function ConnectedBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-green-700 font-medium text-xs">
      <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414L8.414 15 3.293 9.879a1 1 0 011.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
      <span className="truncate max-w-[140px]" title={label}>{label}</span>
    </span>
  )
}

function NotConnectedBadge() {
  return (
    <span className="text-gray-400 text-xs">No configurado</span>
  )
}

// ─── Toggle switch ─────────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  enabled: boolean
  onToggle: () => void
  disabled: boolean
  label: string
}

function ToggleSwitch({ enabled, onToggle, disabled, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={label}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
        enabled ? 'bg-green-500' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

// ─── Env card ──────────────────────────────────────────────────────────────────

interface EnvCardProps {
  configured: boolean
  config: ConfigDefinition
  onConfigure: () => void
  onEdit: () => void
  onDelete: () => void
}

function EnvCard({ configured, config, onConfigure, onEdit, onDelete }: EnvCardProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
        configured ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
      }`}
    >
      {/* Status icon */}
      <div className="mt-0.5 flex-shrink-0">
        {configured ? (
          <svg
            className="w-5 h-5 text-green-600"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-label="Configurado"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            className="w-5 h-5 text-red-500"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-label="No configurado"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${configured ? 'text-green-800' : 'text-red-700'}`}>
          {config.title}
        </p>
        <p className={`text-xs mt-0.5 ${configured ? 'text-green-600' : 'text-red-500'}`}>
          {config.description}
        </p>

        {configured ? (
          /* Edit + Delete action buttons */
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Editar ${config.title}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-900 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              Editar
            </button>
            <span className="text-green-300" aria-hidden="true">|</span>
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Eliminar ${config.title}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              Eliminar
            </button>
          </div>
        ) : (
          /* Configure now link */
          <button
            type="button"
            onClick={onConfigure}
            className="mt-1.5 text-xs font-medium text-red-600 underline underline-offset-2 hover:text-red-800 transition-colors"
          >
            Configurar ahora
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const [properties, setProperties] = useState<PropertyWithConfig[]>([])
  const [systemStatus, setSystemStatus] = useState<SystemIntegrationStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const [activeModal, setActiveModal] = useState<{
    config: ConfigDefinition
    mode: 'create' | 'edit'
  } | null>(null)

  const [deleteDialog, setDeleteDialog] = useState<{
    config: ConfigDefinition
  } | null>(null)

  async function loadData() {
    const [propertiesResult, statusResult] = await Promise.all([
      listPropertiesWithConfig(),
      getSystemIntegrationStatus(),
    ])

    if (propertiesResult.error) {
      setError(propertiesResult.error)
    } else {
      setProperties(propertiesResult.properties ?? [])
    }

    if (statusResult.error && statusResult.error !== 'No autorizado') {
      setError(prev => prev ?? statusResult.error ?? null)
    } else {
      setSystemStatus(statusResult)
    }
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [])

  function handleToggle(propertyId: string, currentValue: boolean) {
    startTransition(async () => {
      try {
        const result = await toggleAiReviewResponses(propertyId, !currentValue)
        if (result.error) {
          setError(result.error)
          return
        }
        setProperties(prev =>
          prev.map(p =>
            p.id === propertyId
              ? { ...p, ai_review_responses_enabled: !currentValue }
              : p,
          ),
        )
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error inesperado')
      }
    })
  }

  async function handleSaved() {
    await loadData()
  }

  async function handleDeleted() {
    await loadData()
  }

  function getConfiguredState(config: ConfigDefinition): boolean {
    if (!systemStatus) return false
    switch (config.id) {
      case 'serpapi':
        return systemStatus.serpapi_configured
      case 'google_oauth':
        return systemStatus.google_oauth_configured
      case 'encryption':
        return systemStatus.encryption_key_configured
      case 'openrouter':
        return systemStatus.openrouter_configured
      case 'cron':
        return systemStatus.cron_secret_configured
      default:
        return false
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* ── Section 1: System Integration Status ── */}
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Estado del Sistema</h2>
          <p className="text-sm text-gray-500 mt-1">
            Variables de entorno requeridas para el modulo de resenas.
          </p>
        </div>

        {systemStatus && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {CONFIG_DEFINITIONS.map(config => {
                const configured = getConfiguredState(config)
                return (
                  <EnvCard
                    key={config.id}
                    configured={configured}
                    config={config}
                    onConfigure={() => setActiveModal({ config, mode: 'create' })}
                    onEdit={() => setActiveModal({ config, mode: 'edit' })}
                    onDelete={() => setDeleteDialog({ config })}
                  />
                )
              })}
            </div>

            {systemStatus.super_admin_emails.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Super Admins configurados
                </p>
                <div className="flex flex-wrap gap-2">
                  {systemStatus.super_admin_emails.map(email => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full"
                    >
                      <StatusDot ok={true} />
                      {email}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Error banner ── */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Section 2: Properties Table ── */}
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Propiedades — Integracion de Resenas</h2>
          <p className="text-sm text-gray-500 mt-1">
            Estado de conexion por propiedad y control de feature flags.
          </p>
        </div>

        {properties.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay propiedades registradas.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Propiedad
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Organizacion
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Google Maps
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        TripAdvisor
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Google OAuth
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Auto-Publicar
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Resenas
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        IA Respuestas
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {properties.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {p.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {p.org_name}
                        </td>
                        <td className="px-4 py-3">
                          {p.google_source_connected ? (
                            <ConnectedBadge label={p.google_source_place_name ?? 'Conectado'} />
                          ) : (
                            <NotConnectedBadge />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {p.tripadvisor_source_connected ? (
                            <ConnectedBadge label={p.tripadvisor_source_place_name ?? 'Conectado'} />
                          ) : (
                            <NotConnectedBadge />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {p.google_oauth_connected ? (
                            <ConnectedBadge label={p.google_oauth_email ?? 'Conectado'} />
                          ) : (
                            <NotConnectedBadge />
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {p.auto_publish_enabled ? (
                            <span className="inline-block text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                              Activo
                            </span>
                          ) : (
                            <span className="inline-block text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                              Inactivo
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-gray-900 font-medium">
                            {p.total_reviews}
                          </span>
                          {p.total_imported_reviews > 0 && (
                            <span className="text-xs text-gray-400 ml-1">
                              ({p.total_imported_reviews} importadas)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ToggleSwitch
                            enabled={p.ai_review_responses_enabled}
                            onToggle={() => handleToggle(p.id, p.ai_review_responses_enabled)}
                            disabled={isPending}
                            label={
                              p.ai_review_responses_enabled
                                ? 'Desactivar IA Respuestas'
                                : 'Activar IA Respuestas'
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile / tablet cards */}
            <div className="lg:hidden space-y-3">
              {properties.map(p => (
                <div
                  key={p.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{p.org_name}</p>
                    </div>
                    <ToggleSwitch
                      enabled={p.ai_review_responses_enabled}
                      onToggle={() => handleToggle(p.id, p.ai_review_responses_enabled)}
                      disabled={isPending}
                      label={
                        p.ai_review_responses_enabled
                          ? 'Desactivar IA Respuestas'
                          : 'Activar IA Respuestas'
                      }
                    />
                  </div>

                  {/* Integration grid */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                    <div>
                      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">
                        Google Maps
                      </p>
                      {p.google_source_connected ? (
                        <ConnectedBadge label={p.google_source_place_name ?? 'Conectado'} />
                      ) : (
                        <NotConnectedBadge />
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">
                        TripAdvisor
                      </p>
                      {p.tripadvisor_source_connected ? (
                        <ConnectedBadge label={p.tripadvisor_source_place_name ?? 'Conectado'} />
                      ) : (
                        <NotConnectedBadge />
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">
                        Google OAuth
                      </p>
                      {p.google_oauth_connected ? (
                        <ConnectedBadge label={p.google_oauth_email ?? 'Conectado'} />
                      ) : (
                        <NotConnectedBadge />
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">
                        Auto-Publicar
                      </p>
                      {p.auto_publish_enabled ? (
                        <span className="inline-block text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          Activo
                        </span>
                      ) : (
                        <span className="inline-block text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          Inactivo
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Reviews count */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                      Resenas
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{p.total_reviews}</span>
                      {p.total_imported_reviews > 0 && (
                        <span className="text-xs text-gray-400 ml-1">
                          ({p.total_imported_reviews} importadas)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── Modals ── */}
      {activeModal && (
        <SecretConfigModal
          open={true}
          onClose={() => setActiveModal(null)}
          onSaved={handleSaved}
          config={activeModal.config}
          mode={activeModal.mode}
        />
      )}

      {deleteDialog && (
        <DeleteConfirmDialog
          open={true}
          onClose={() => setDeleteDialog(null)}
          onDeleted={handleDeleted}
          configTitle={deleteDialog.config.title}
          keys={deleteDialog.config.keys}
        />
      )}
    </div>
  )
}
