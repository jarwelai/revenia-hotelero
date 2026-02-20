'use client'

import { useState, useTransition, useRef } from 'react'
import { createBlock, deleteBlock } from '@/actions/calendar'
import type { TapeChartData, TapeChartRoom, TapeChartBooking, TapeChartBlock } from '@/types/hotelero'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_WIDTH = 44   // px por columna de día
const ROW_HEIGHT = 40  // px por fila de room
const ROOM_COL = 160   // px para columna de nombres

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

function dayIndex(dateStr: string, dateFrom: string): number {
  const a = new Date(dateFrom + 'T00:00:00Z').getTime()
  const b = new Date(dateStr + 'T00:00:00Z').getTime()
  return Math.round((b - a) / 86_400_000)
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10)
}

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface BookingBarProps {
  booking: TapeChartBooking
  totalDays: number
  dateFrom: string
}

interface BlockBarProps {
  block: TapeChartBlock
  totalDays: number
  dateFrom: string
  onDelete: (id: string) => void
}

interface CreateBlockModalProps {
  propertyId: string
  rooms: TapeChartRoom[]
  preselectedRoomId?: string
  preselectedDate?: string
  onClose: () => void
}

// ─── BookingBar ───────────────────────────────────────────────────────────────

function BookingBar({ booking, totalDays, dateFrom }: BookingBarProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  const startCol = Math.max(0, dayIndex(booking.check_in, dateFrom))
  const endCol = Math.min(totalDays, dayIndex(booking.check_out, dateFrom))
  if (startCol >= endCol) return null

  const left = startCol * DAY_WIDTH
  const width = (endCol - startCol) * DAY_WIDTH - 4

  const colorClass = booking.status === 'confirmed'
    ? 'bg-accent-600 text-white'
    : 'bg-warning-300 text-warning-900'

  return (
    <div
      style={{ position: 'absolute', left, width, top: 5, height: ROW_HEIGHT - 10 }}
      className={`${colorClass} rounded-md text-xs px-1.5 flex items-center overflow-hidden cursor-pointer z-10`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      title={`${booking.guest_name} · ${booking.check_in} → ${booking.check_out} · ${booking.status}`}
    >
      <span className="truncate font-medium">{booking.guest_name}</span>
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-1 z-20 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap pointer-events-none">
          {booking.guest_name}<br />
          {booking.check_in} → {booking.check_out}<br />
          {booking.status === 'confirmed' ? 'Confirmada' : 'En espera'}
        </div>
      )}
    </div>
  )
}

// ─── BlockBar ─────────────────────────────────────────────────────────────────

function BlockBar({ block, totalDays, dateFrom, onDelete }: BlockBarProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [, startTransition] = useTransition()

  const startCol = Math.max(0, dayIndex(block.start_date, dateFrom))
  const endCol = Math.min(totalDays, dayIndex(block.end_date, dateFrom))
  if (startCol >= endCol) return null

  const left = startCol * DAY_WIDTH
  const width = (endCol - startCol) * DAY_WIDTH - 4

  const handleDelete = () => {
    if (!confirm('¿Eliminar este bloqueo?')) return
    startTransition(async () => {
      await deleteBlock(block.id)
      onDelete(block.id)
    })
  }

  return (
    <div
      style={{ position: 'absolute', left, width, top: 5, height: ROW_HEIGHT - 10 }}
      className="bg-secondary-200 text-secondary-800 border border-secondary-400 rounded-md text-xs px-1.5 flex items-center justify-between overflow-hidden z-10 group cursor-default"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="truncate">{block.reason ?? 'Bloqueado'}</span>
      <button
        onClick={handleDelete}
        className="ml-1 opacity-0 group-hover:opacity-100 text-secondary-700 hover:text-error-600 transition-opacity flex-shrink-0"
        title="Eliminar bloqueo"
      >
        ✕
      </button>
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-1 z-20 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap pointer-events-none">
          {block.reason ?? 'Bloqueo manual'}<br />
          {block.start_date} → {block.end_date}
        </div>
      )}
    </div>
  )
}

// ─── CreateBlockModal ─────────────────────────────────────────────────────────

function CreateBlockModal({ propertyId, rooms, preselectedRoomId, preselectedDate, onClose }: CreateBlockModalProps) {
  const [roomId, setRoomId] = useState(preselectedRoomId ?? (rooms[0]?.id ?? ''))
  const [startDate, setStartDate] = useState(preselectedDate ?? '')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createBlock({ property_id: propertyId, room_id: roomId, start_date: startDate, end_date: endDate, reason: reason || null })
      if (result.error) { setError(result.error); return }
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-elevated w-full max-w-sm p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Crear bloqueo</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-1">Habitación</label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-accent-500"
              required
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name} ({r.room_type_name})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-1">Inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-accent-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-1">Fin (excl.)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-accent-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-1">Motivo (opcional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Mantenimiento"
              className="w-full rounded-xl border border-border px-3 py-2 text-sm text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>
          {error && (
            <p className="text-sm text-error-700 bg-error-50 border border-error-200 rounded-xl px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground-secondary hover:bg-surface transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-xl bg-accent-600 hover:bg-accent-700 text-white px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
            >
              {pending ? 'Guardando...' : 'Crear bloqueo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── TapeChart ────────────────────────────────────────────────────────────────

interface TapeChartProps {
  data: TapeChartData
  propertyId: string
}

export function TapeChart({ data, propertyId }: TapeChartProps) {
  const { rooms, dateFrom, dateTo } = data
  const [bookings, setBookings] = useState<TapeChartBooking[]>(data.bookings)
  const [blocks, setBlocks] = useState<TapeChartBlock[]>(data.blocks)
  const [modal, setModal] = useState<{ roomId?: string; date?: string } | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  const days = getDaysInRange(dateFrom, dateTo)
  const totalDays = days.length
  const totalWidth = totalDays * DAY_WIDTH

  // Agrupar rooms por tipo para headers
  const typeOrder: string[] = []
  const typeGroups: Record<string, TapeChartRoom[]> = {}
  for (const room of rooms) {
    const typeName = room.room_type_name
    if (!typeGroups[typeName]) {
      typeGroups[typeName] = []
      typeOrder.push(typeName)
    }
    typeGroups[typeName].push(room)
  }

  const handleDeleteBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id))
  }

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>, roomId: string) => {
    if ((e.target as HTMLElement).closest('[data-bar]')) return  // click en barra, no en zona libre
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const colIndex = Math.floor(clickX / DAY_WIDTH)
    const clickedDate = days[Math.min(colIndex, totalDays - 1)]
    if (clickedDate) setModal({ roomId, date: clickedDate })
  }

  return (
    <div className="overflow-auto rounded-2xl border border-border bg-white shadow-card">
      {/* Header: nombres de días */}
      <div className="flex sticky top-0 z-20 bg-white border-b border-border">
        <div
          style={{ width: ROOM_COL, minWidth: ROOM_COL }}
          className="flex-shrink-0 px-3 py-2 text-xs font-medium text-foreground-secondary bg-gray-50 border-r border-border"
        >
          Habitación
        </div>
        <div className="flex" style={{ width: totalWidth }}>
          {days.map((day) => (
            <div
              key={day}
              style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
              className={`flex-shrink-0 text-center text-xs py-2 border-r border-border/50 ${
                isToday(day) ? 'bg-warning-50 font-semibold text-warning-700' : 'text-foreground-secondary'
              }`}
            >
              {formatDayLabel(day)}
            </div>
          ))}
        </div>
      </div>

      {/* Filas de rooms agrupadas por tipo */}
      {typeOrder.map((typeName) => (
        <div key={typeName}>
          {/* Cabecera de tipo */}
          <div className="flex bg-gray-50 border-b border-border/50">
            <div
              style={{ width: ROOM_COL, minWidth: ROOM_COL }}
              className="flex-shrink-0 px-3 py-1.5 text-[11px] font-semibold text-foreground-secondary uppercase tracking-wider border-r border-border"
            >
              {typeName}
            </div>
            <div style={{ width: totalWidth }} className="flex-shrink-0 border-b border-border/30" />
          </div>

          {/* Filas de rooms */}
          {typeGroups[typeName].map((room) => {
            const roomBookings = bookings.filter((b) => b.room_id === room.id)
            const roomBlocks = blocks.filter((b) => b.room_id === room.id)

            return (
              <div key={room.id} className="flex border-b border-border/40 hover:bg-gray-50/50">
                {/* Nombre de habitación */}
                <div
                  style={{ width: ROOM_COL, minWidth: ROOM_COL, height: ROW_HEIGHT }}
                  className="flex-shrink-0 flex items-center px-3 text-sm text-foreground border-r border-border"
                >
                  <span className="truncate">{room.name}</span>
                </div>

                {/* Timeline de esta room */}
                <div
                  ref={timelineRef}
                  style={{ width: totalWidth, height: ROW_HEIGHT, position: 'relative' }}
                  className="flex-shrink-0 cursor-pointer"
                  onClick={(e) => handleTimelineClick(e, room.id)}
                >
                  {/* Grid lines de fondo */}
                  {days.map((day, i) => (
                    <div
                      key={day}
                      style={{
                        position: 'absolute',
                        left: i * DAY_WIDTH,
                        width: DAY_WIDTH,
                        height: ROW_HEIGHT,
                        borderRight: '1px solid #f1f5f9',
                      }}
                      className={isToday(day) ? 'bg-warning-50/60' : ''}
                    />
                  ))}

                  {/* Barras de booking */}
                  {roomBookings.map((booking) => (
                    <div key={booking.id} data-bar="true">
                      <BookingBar
                        booking={booking}
                        totalDays={totalDays}
                        dateFrom={dateFrom}
                      />
                    </div>
                  ))}

                  {/* Barras de block */}
                  {roomBlocks.map((block) => (
                    <div key={block.id} data-bar="true">
                      <BlockBar
                        block={block}
                        totalDays={totalDays}
                        dateFrom={dateFrom}
                        onDelete={handleDeleteBlock}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {/* Leyenda */}
      <div className="flex items-center gap-4 px-4 py-3 border-t border-border text-xs text-foreground-secondary bg-gray-50">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-accent-600 inline-block" />
          Confirmada
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-warning-300 border border-warning-400 inline-block" />
          En espera
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-secondary-200 border border-secondary-400 inline-block" />
          Bloqueo
        </div>
        <div className="ml-auto text-foreground-muted italic">
          Click en zona libre para crear bloqueo
        </div>
      </div>

      {/* Modal crear block */}
      {modal && (
        <CreateBlockModal
          propertyId={propertyId}
          rooms={rooms}
          preselectedRoomId={modal.roomId}
          preselectedDate={modal.date}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
