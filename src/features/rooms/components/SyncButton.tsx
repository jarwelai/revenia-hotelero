'use client'

import { useState } from 'react'
import { syncIcal } from '@/actions/sync'

interface Props {
  roomId: string
  hasIcalUrl: boolean
}

export function SyncButton({ roomId, hasIcalUrl }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success?: boolean
    synced?: number
    skipped?: number
    errors?: string[]
    error?: string
  } | null>(null)

  async function handleSync(formData: FormData) {
    setLoading(true)
    setResult(null)

    const res = await syncIcal(formData)
    setResult(res ?? { error: 'Sin respuesta del servidor' })
    setLoading(false)
  }

  if (!hasIcalUrl) {
    return (
      <span className="text-xs text-foreground-muted italic">Sin iCal URL</span>
    )
  }

  return (
    <div className="space-y-1">
      <form action={handleSync}>
        <input type="hidden" name="room_id" value={roomId} />
        <button
          type="submit"
          disabled={loading}
          className="text-sm font-medium text-accent-600 hover:text-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Sincronizando...' : 'Sync Now'}
        </button>
      </form>

      {result && (
        <div className={`text-xs rounded px-2 py-1 ${result.error
          ? 'bg-error-50 text-error-700'
          : 'bg-success-50 text-success-700'
        }`}>
          {result.error
            ? result.error
            : `✓ ${result.synced} sincronizadas${result.skipped ? `, ${result.skipped} omitidas` : ''}`
          }
        </div>
      )}
    </div>
  )
}
