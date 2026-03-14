'use client'

import type { GoogleConnection } from '@/types/hotelero'

interface GoogleConnectionCardProps {
  propertyId: string
  connection: GoogleConnection | null
}

// ─── Google SVG icon ──────────────────────────────────────────────────────────

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

// ─── Sync status indicator ────────────────────────────────────────────────────

function SyncStatusBadge({
  syncEnabled,
  lastSyncedAt,
  lastSyncError,
}: {
  syncEnabled: boolean
  lastSyncedAt: string | null
  lastSyncError: string | null
}) {
  if (lastSyncError) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-error-600">
        <span className="w-1.5 h-1.5 rounded-full bg-error-500 shrink-0" aria-hidden="true" />
        Error de sincronizacion
      </span>
    )
  }

  if (!syncEnabled) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground-muted">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" aria-hidden="true" />
        Sincronizacion pausada
      </span>
    )
  }

  if (lastSyncedAt) {
    const formatted = (() => {
      try {
        return new Date(lastSyncedAt).toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      } catch {
        return lastSyncedAt
      }
    })()

    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-success-600">
        <span className="w-1.5 h-1.5 rounded-full bg-success-500 shrink-0" aria-hidden="true" />
        Sincronizado {formatted}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-600">
      <span className="w-1.5 h-1.5 rounded-full bg-warning-400 shrink-0" aria-hidden="true" />
      Sin sincronizar aun
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GoogleConnectionCard({ propertyId, connection }: GoogleConnectionCardProps) {
  const handleDisconnect = () => {
    window.alert('La funcionalidad de desconexion estara disponible proximamente.')
  }

  // ── Not connected state ────────────────────────────────────────────────────
  if (!connection) {
    return (
      <div className="bg-white rounded-2xl border border-border p-5 shadow-card">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center">
            <GoogleIcon className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground font-heading">
              Google Business Profile
            </h3>
            <p className="mt-1 text-sm text-foreground-secondary">
              Conecta para responder resenas de Google directamente desde el dashboard.
            </p>

            <a
              href={`/api/auth/google?propertyId=${propertyId}`}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-xl hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 transition-colors"
            >
              <GoogleIcon className="w-4 h-4" />
              Conectar con Google
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── Connected state ────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-border p-5 shadow-card">
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center">
          <GoogleIcon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground font-heading">
                Google Business Profile
              </h3>

              {connection.google_email && (
                <p className="mt-0.5 text-sm text-foreground-secondary truncate">
                  {connection.google_email}
                </p>
              )}

              {connection.google_location_name && (
                <p className="mt-0.5 text-xs text-foreground-muted truncate">
                  {connection.google_location_name}
                </p>
              )}
            </div>

            <button
              onClick={handleDisconnect}
              className="shrink-0 px-3 py-1.5 text-xs font-medium text-error-600 border border-error-200 rounded-lg hover:bg-error-50 focus:outline-none focus:ring-2 focus:ring-error-400 focus:ring-offset-1 transition-colors"
              aria-label="Desconectar cuenta de Google"
            >
              Desconectar
            </button>
          </div>

          <SyncStatusBadge
            syncEnabled={connection.sync_enabled}
            lastSyncedAt={connection.last_synced_at}
            lastSyncError={connection.last_sync_error}
          />
        </div>
      </div>
    </div>
  )
}
