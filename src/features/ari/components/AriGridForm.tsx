'use client'

import { useState, useTransition } from 'react'
import { previewBulkAriUpdate, commitBulkAriUpdate } from '@/actions/ari'
import type { BulkPreviewItem } from '@/actions/ari'
import type { AriCell, AriGrid } from '@/types/hotelero'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInRange(dateFrom: string, dateTo: string): string[] {
  const days: string[] = []
  let cursor = new Date(dateFrom + 'T00:00:00Z')
  const end = new Date(dateTo + 'T00:00:00Z')
  while (cursor.getTime() < end.getTime()) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor = new Date(cursor.getTime() + 86_400_000)
  }
  return days
}

function formatDayShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

function formatCellValue(cell: AriCell): string {
  if (cell.closed) return '🔒'
  if (cell.base_rate == null) return '—'
  return `$${cell.base_rate}`
}

// ─── AriGridForm ──────────────────────────────────────────────────────────────

interface AriGridFormProps {
  ariGrid: AriGrid
  propertyId: string
}

export function AriGridForm({ ariGrid, propertyId }: AriGridFormProps) {
  const { grid, ratePlanId, dateFrom, dateTo, roomTypes } = ariGrid

  // Form state
  const [selectedRoomTypes, setSelectedRoomTypes] = useState<string[]>(roomTypes.map((rt) => rt.id))
  const [startDate, setStartDate] = useState(dateFrom)
  const [endDate, setEndDate] = useState(dateTo)
  const [baseRate, setBaseRate] = useState<string>('')
  const [minLos, setMinLos] = useState<string>('')
  const [closed, setClosed] = useState(false)

  // Preview + commit state
  const [preview, setPreview] = useState<BulkPreviewItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPreviewing, startPreview] = useTransition()
  const [isCommitting, startCommit] = useTransition()

  const days = getDaysInRange(dateFrom, dateTo)

  const toggleRoomType = (id: string) => {
    setSelectedRoomTypes((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    )
  }

  const handlePreview = () => {
    setError(null)
    setPreview(null)
    setSuccess(false)
    if (!ratePlanId) { setError('No hay plan BAR configurado'); return }
    startPreview(async () => {
      const result = await previewBulkAriUpdate({
        property_id: propertyId,
        room_type_ids: selectedRoomTypes,
        rate_plan_id: ratePlanId,
        start_date: startDate,
        end_date: endDate,
        base_rate: baseRate !== '' ? parseFloat(baseRate) : null,
        min_los: minLos !== '' ? parseInt(minLos, 10) : null,
        closed,
      })
      if (result.error) { setError(result.error); return }
      setPreview(result.items ?? [])
    })
  }

  const handleCommit = () => {
    setError(null)
    if (!ratePlanId) return
    startCommit(async () => {
      const result = await commitBulkAriUpdate({
        property_id: propertyId,
        room_type_ids: selectedRoomTypes,
        rate_plan_id: ratePlanId,
        start_date: startDate,
        end_date: endDate,
        base_rate: baseRate !== '' ? parseFloat(baseRate) : null,
        min_los: minLos !== '' ? parseInt(minLos, 10) : null,
        closed,
      })
      if (result.error) { setError(result.error); return }
      setSuccess(true)
      setPreview(null)
    })
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Grid de tarifas */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Grid BAR
          <span className="ml-2 text-sm font-normal text-foreground-secondary">14 días</span>
        </h2>

        {roomTypes.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
            <p className="text-foreground-secondary">No hay tipos de habitación configurados</p>
          </div>
        ) : (
          <div className="overflow-auto rounded-2xl border border-border">
            <table className="text-xs min-w-full">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-foreground-secondary sticky left-0 bg-gray-50 min-w-[140px]">
                    Tipo
                  </th>
                  {days.map((day) => (
                    <th key={day} className="text-center px-1 py-2 font-medium text-foreground-secondary min-w-[56px]">
                      {formatDayShort(day)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {roomTypes.map((rt) => (
                  <tr key={rt.id} className="hover:bg-gray-50/50">
                    <td className="px-3 py-2 font-medium text-foreground sticky left-0 bg-white border-r border-border">
                      {rt.name}
                    </td>
                    {days.map((day) => {
                      const cell = grid[rt.id]?.[day]
                      const isClosedDay = cell?.closed ?? false
                      return (
                        <td
                          key={day}
                          className={`text-center px-1 py-2 tabular-nums ${
                            isClosedDay
                              ? 'text-error-600 bg-error-50'
                              : cell?.base_rate != null
                                ? 'text-foreground'
                                : 'text-foreground-muted'
                          }`}
                        >
                          {cell ? formatCellValue(cell) : '—'}
                          {cell?.min_los && (
                            <span className="ml-0.5 text-foreground-muted">{cell.min_los}n</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Formulario bulk update */}
      <div className="rounded-2xl border border-border p-6 bg-surface">
        <h2 className="text-lg font-semibold text-foreground mb-4">Actualizar tarifas</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Tipos de habitación */}
          <div className="lg:col-span-3">
            <label className="block text-sm font-medium text-foreground-secondary mb-2">
              Tipos de habitación
            </label>
            <div className="flex flex-wrap gap-2">
              {roomTypes.map((rt) => (
                <button
                  key={rt.id}
                  type="button"
                  onClick={() => toggleRoomType(rt.id)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                    selectedRoomTypes.includes(rt.id)
                      ? 'bg-accent-600 text-white border-accent-600'
                      : 'bg-white text-foreground-secondary border-border hover:bg-gray-50'
                  }`}
                >
                  {rt.name}
                </button>
              ))}
            </div>
          </div>

          {/* Fechas */}
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-1">Fecha inicio</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-1">Fecha fin (excl.)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>

          {/* Tarifa */}
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-1">Tarifa base (USD)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={baseRate}
              onChange={(e) => setBaseRate(e.target.value)}
              placeholder="Ej: 120.00"
              className="w-full rounded-xl border border-border px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>

          {/* MinLOS */}
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-1">Min. noches</label>
            <input
              type="number"
              min="1"
              value={minLos}
              onChange={(e) => setMinLos(e.target.value)}
              placeholder="Sin mínimo"
              className="w-full rounded-xl border border-border px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>

          {/* Closed */}
          <div className="flex items-center gap-3 mt-5">
            <input
              id="closed"
              type="checkbox"
              checked={closed}
              onChange={(e) => setClosed(e.target.checked)}
              className="w-4 h-4 rounded border-border text-accent-600 focus:ring-accent-500"
            />
            <label htmlFor="closed" className="text-sm font-medium text-foreground-secondary">
              Cerrar venta (closed)
            </label>
          </div>
        </div>

        {/* Errores */}
        {error && (
          <div className="mt-4 rounded-xl bg-error-50 border border-error-200 p-3">
            <p className="text-sm text-error-700">{error}</p>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mt-4 rounded-xl bg-success-50 border border-success-200 p-3">
            <p className="text-sm text-success-700">✓ Tarifas actualizadas correctamente. Recarga la página para ver el grid actualizado.</p>
          </div>
        )}

        {/* Preview */}
        {preview && preview.length > 0 && (
          <div className="mt-4 rounded-xl bg-surface border border-border p-4">
            <p className="text-sm font-medium text-foreground mb-2">Vista previa de cambios:</p>
            <ul className="space-y-1">
              {preview.map((item) => (
                <li key={item.room_type_id} className="text-sm text-foreground-secondary">
                  <span className="font-medium text-foreground">{item.room_type_name}</span>
                  {' · '}{item.start_date} → {item.end_date}
                  {' · '}
                  {item.closed ? (
                    <span className="text-error-600">Cerrado</span>
                  ) : (
                    <>
                      {item.base_rate != null ? `$${item.base_rate}` : '—'}
                      {item.min_los ? ` · ${item.min_los}n mín.` : ''}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={handlePreview}
            disabled={isPreviewing || selectedRoomTypes.length === 0}
            className="px-5 py-2 rounded-xl border border-border bg-white text-foreground-secondary text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {isPreviewing ? 'Calculando...' : 'Previsualizar'}
          </button>
          <button
            type="button"
            onClick={handleCommit}
            disabled={isCommitting || selectedRoomTypes.length === 0 || !ratePlanId}
            className="px-5 py-2 rounded-xl bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
          >
            {isCommitting ? 'Aplicando...' : 'Aplicar tarifas'}
          </button>
        </div>
      </div>
    </div>
  )
}
