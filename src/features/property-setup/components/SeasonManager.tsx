'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createSeason, updateSeason, deleteSeason } from '@/actions/seasons'
import type { CreateSeasonInput } from '@/actions/seasons'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoomTypeBasic {
  id: string
  name: string
  base_price: number | null
}

interface SeasonRow {
  id: string
  name: string
  start_date: string
  end_date: string
  color: string
  pricing_overrides: { rates?: Record<string, number> }
  restrictions: { min_los?: number; closed_room_types?: string[] }
  priority: number
  is_active: boolean
}

interface SeasonManagerProps {
  initialSeasons: SeasonRow[]
  roomTypes: RoomTypeBasic[]
  canEdit: boolean
  currency: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateRange(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  return `${fmt(start)} — ${fmt(end)}`
}

function formatCurrency(amount: number, currency: string): string {
  return amount.toLocaleString('es-MX', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })
}

function buildEmptyForm(): FormState {
  return {
    name: '',
    start_date: '',
    end_date: '',
    color: PRESET_COLORS[0],
    priority: 10,
    rates: {},
    min_los: '',
    closed_room_types: [],
  }
}

interface FormState {
  name: string
  start_date: string
  end_date: string
  color: string
  priority: number
  rates: Record<string, string>
  min_los: string
  closed_room_types: string[]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (color: string) => void
  disabled?: boolean
}) {
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-foreground mb-2">
        Color de temporada
      </legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color de temporada">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={value === color}
            aria-label={`Color ${color}`}
            disabled={disabled}
            onClick={() => onChange(color)}
            className={`
              w-8 h-8 rounded-full transition-all duration-150 shrink-0
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-500
              disabled:opacity-50 disabled:cursor-not-allowed
              ${value === color ? 'ring-2 ring-offset-2 ring-gray-700 scale-110' : 'hover:scale-105'}
            `}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </fieldset>
  )
}

function SeasonForm({
  roomTypes,
  initialValues,
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
  currency,
}: {
  roomTypes: RoomTypeBasic[]
  initialValues: FormState
  onSubmit: (form: FormState) => void
  onCancel: () => void
  isPending: boolean
  submitLabel: string
  currency: string
}) {
  const [form, setForm] = useState<FormState>(initialValues)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const toggleClosed = (roomTypeId: string) => {
    setForm((prev) => {
      const already = prev.closed_room_types.includes(roomTypeId)
      return {
        ...prev,
        closed_room_types: already
          ? prev.closed_room_types.filter((id) => id !== roomTypeId)
          : [...prev.closed_room_types, roomTypeId],
      }
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Basic fields */}
      <section aria-label="Datos basicos de la temporada">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input
              label="Nombre de la temporada"
              placeholder="Ej: Temporada alta diciembre"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              disabled={isPending}
              required
            />
          </div>
          <Input
            label="Fecha de inicio"
            type="date"
            value={form.start_date}
            onChange={(e) => set('start_date', e.target.value)}
            disabled={isPending}
            required
          />
          <Input
            label="Fecha de fin"
            type="date"
            value={form.end_date}
            onChange={(e) => set('end_date', e.target.value)}
            disabled={isPending}
            required
          />
          <div className="sm:col-span-2">
            <ColorPicker
              value={form.color}
              onChange={(c) => set('color', c)}
              disabled={isPending}
            />
          </div>
          <Input
            label="Prioridad"
            type="number"
            min={1}
            max={999}
            value={String(form.priority)}
            onChange={(e) => set('priority', Number(e.target.value) || 10)}
            disabled={isPending}
            hint="Mayor numero = mayor prioridad. Usado cuando se solapan temporadas."
          />
        </div>
      </section>

      {/* Per room-type rates */}
      {roomTypes.length > 0 && (
        <section aria-label="Tarifas por tipo de habitacion">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Tarifas por tipo de habitacion
          </h3>
          <p className="text-xs text-foreground-muted mb-4">
            Deja vacio para heredar la tarifa base del tipo de habitacion.
          </p>
          <div className="space-y-3">
            {roomTypes.map((rt) => (
              <div
                key={rt.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3 py-3 border-b border-border last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{rt.name}</p>
                  {rt.base_price != null && (
                    <p className="text-xs text-foreground-muted mt-0.5">
                      Tarifa base: {formatCurrency(rt.base_price, currency)}
                    </p>
                  )}
                </div>
                <span
                  className="hidden sm:block text-foreground-muted"
                  aria-hidden="true"
                >
                  →
                </span>
                <Input
                  aria-label={`Tarifa de temporada para ${rt.name}`}
                  type="number"
                  min={0}
                  step={1}
                  placeholder={rt.base_price != null ? String(rt.base_price) : 'Heredar'}
                  value={form.rates[rt.id] ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      rates: { ...prev.rates, [rt.id]: e.target.value },
                    }))
                  }
                  disabled={isPending}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Restrictions */}
      <section aria-label="Restricciones de la temporada">
        <h3 className="text-sm font-semibold text-foreground mb-3">Restricciones</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Minimo de noches (min_los)"
            type="number"
            min={1}
            placeholder="Sin minimo"
            value={form.min_los}
            onChange={(e) => set('min_los', e.target.value)}
            disabled={isPending}
          />
        </div>

        {roomTypes.length > 0 && (
          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-foreground mb-2">
              Tipos de habitacion cerrados en esta temporada
            </legend>
            <div className="space-y-2">
              {roomTypes.map((rt) => (
                <label
                  key={rt.id}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={form.closed_room_types.includes(rt.id)}
                    onChange={() => toggleClosed(rt.id)}
                    disabled={isPending}
                    className="w-4 h-4 rounded border-border text-primary-500 focus:ring-accent-500 transition-colors"
                  />
                  <span className="text-sm text-foreground group-hover:text-foreground transition-colors">
                    {rt.name}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </section>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={onCancel}
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isPending}
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

// ─── SeasonCard ───────────────────────────────────────────────────────────────

function SeasonCard({
  season,
  roomTypes,
  canEdit,
  onToggleActive,
  onDelete,
  onEdit,
  isPendingId,
  currency,
}: {
  season: SeasonRow
  roomTypes: RoomTypeBasic[]
  canEdit: boolean
  onToggleActive: (id: string, next: boolean) => void
  onDelete: (id: string) => void
  onEdit: (season: SeasonRow) => void
  isPendingId: string | null
  currency: string
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isThisPending = isPendingId === season.id

  return (
    <article
      className="bg-white rounded-2xl border border-border p-5 space-y-4"
      aria-label={`Temporada: ${season.name}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Color dot */}
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: season.color }}
            aria-hidden="true"
          />
          <h2 className="text-base font-semibold text-foreground truncate">
            {season.name}
          </h2>
        </div>

        {/* Priority badge */}
        <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium tabular-nums">
          P{season.priority}
        </span>
      </div>

      {/* Date range */}
      <p className="text-sm text-foreground-secondary">
        <CalendarIcon className="inline w-3.5 h-3.5 mr-1 -mt-0.5 text-foreground-muted" aria-hidden="true" />
        {formatDateRange(season.start_date, season.end_date)}
      </p>

      {/* Rate overrides summary */}
      {season.pricing_overrides?.rates && Object.keys(season.pricing_overrides.rates).length > 0 && (
        <div className="text-xs text-foreground-muted space-y-1">
          {Object.entries(season.pricing_overrides.rates).map(([rtId, rate]) => {
            const rt = roomTypes.find((r) => r.id === rtId)
            return rt ? (
              <span key={rtId} className="inline-flex items-center gap-1 mr-2">
                <span
                  className="w-2 h-2 rounded-full bg-primary-400 shrink-0"
                  aria-hidden="true"
                />
                {rt.name}: {formatCurrency(rate, currency)}
              </span>
            ) : null
          })}
        </div>
      )}

      {/* Restrictions row */}
      {(season.restrictions?.min_los || (season.restrictions?.closed_room_types ?? []).length > 0) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground-muted">
          {season.restrictions.min_los && (
            <span>Min. noches: {season.restrictions.min_los}</span>
          )}
          {(season.restrictions.closed_room_types ?? []).length > 0 && (
            <span>
              Cerrados:{' '}
              {(season.restrictions.closed_room_types ?? [])
                .map((id) => roomTypes.find((r) => r.id === id)?.name ?? id)
                .join(', ')}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border">
          {/* Active toggle */}
          <label className="flex items-center gap-2 cursor-pointer group" aria-label={`${season.is_active ? 'Desactivar' : 'Activar'} temporada`}>
            <button
              type="button"
              role="switch"
              aria-checked={season.is_active}
              disabled={isThisPending}
              onClick={() => onToggleActive(season.id, !season.is_active)}
              className={`
                relative inline-flex w-9 h-5 rounded-full transition-colors duration-200
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
                ${season.is_active ? 'bg-primary-500' : 'bg-gray-300'}
              `}
            >
              <span
                className={`
                  inline-block w-4 h-4 rounded-full bg-white shadow-sm
                  transform transition-transform duration-200 mt-0.5
                  ${season.is_active ? 'translate-x-4' : 'translate-x-0.5'}
                `}
              />
            </button>
            <span className="text-xs text-foreground-secondary select-none">
              {season.is_active ? 'Activa' : 'Inactiva'}
            </span>
          </label>

          <div className="flex items-center gap-2">
            {/* Edit button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isThisPending}
              onClick={() => onEdit(season)}
              aria-label={`Editar temporada ${season.name}`}
            >
              <EditIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="ml-1">Editar</span>
            </Button>

            {/* Delete button / confirm */}
            {confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-error-600 font-medium">Confirmar</span>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  isLoading={isThisPending}
                  disabled={isThisPending}
                  onClick={() => {
                    setConfirmDelete(false)
                    onDelete(season.id)
                  }}
                  aria-label={`Confirmar eliminacion de ${season.name}`}
                >
                  Eliminar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isThisPending}
                  onClick={() => setConfirmDelete(false)}
                >
                  No
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isThisPending}
                onClick={() => setConfirmDelete(true)}
                aria-label={`Eliminar temporada ${season.name}`}
                className="text-error-600 hover:text-error-700 hover:bg-error-50"
              >
                <TrashIcon className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="ml-1">Eliminar</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

// ─── SeasonManager ────────────────────────────────────────────────────────────

export function SeasonManager({ initialSeasons, roomTypes, canEdit, currency }: SeasonManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [seasons, setSeasons] = useState<SeasonRow[]>(initialSeasons)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [overlapWarnings, setOverlapWarnings] = useState<string[]>([])

  const clearFeedback = () => {
    setGlobalError(null)
    setOverlapWarnings([])
  }

  // Form mode: 'none' | 'create' | season id (for edit)
  const [formMode, setFormMode] = useState<'none' | 'create' | string>('none')
  const [editTarget, setEditTarget] = useState<SeasonRow | null>(null)

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleOpenCreate = () => {
    setEditTarget(null)
    setFormMode('create')
    setGlobalError(null)
  }

  const handleOpenEdit = (season: SeasonRow) => {
    setEditTarget(season)
    setFormMode(season.id)
    setGlobalError(null)
  }

  const handleCancel = () => {
    setFormMode('none')
    setEditTarget(null)
    setGlobalError(null)
  }

  const buildPayload = (form: FormState): CreateSeasonInput => {
    const rates: Record<string, number> = {}
    for (const [rtId, val] of Object.entries(form.rates)) {
      const parsed = parseFloat(val)
      if (!isNaN(parsed) && parsed >= 0) rates[rtId] = parsed
    }

    const min_los = form.min_los ? parseInt(form.min_los, 10) : undefined

    return {
      name: form.name.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      color: form.color,
      priority: form.priority,
      pricing_overrides: Object.keys(rates).length > 0 ? { rates } : {},
      restrictions: {
        ...(min_los && min_los > 0 ? { min_los } : {}),
        ...(form.closed_room_types.length > 0 ? { closed_room_types: form.closed_room_types } : {}),
      },
    }
  }

  const handleCreate = (form: FormState) => {
    clearFeedback()
    startTransition(async () => {
      const result = await createSeason(buildPayload(form))
      if (result.error) {
        setGlobalError(result.error)
        return
      }
      if (result.warnings?.length) setOverlapWarnings(result.warnings)
      if (result.season) {
        setSeasons((prev) => [...prev, result.season as SeasonRow].sort(
          (a, b) => a.start_date.localeCompare(b.start_date)
        ))
      }
      setFormMode('none')
      router.refresh()
    })
  }

  const handleUpdate = (form: FormState) => {
    if (!editTarget) return
    clearFeedback()
    setPendingId(editTarget.id)
    startTransition(async () => {
      const result = await updateSeason(editTarget.id, buildPayload(form))
      setPendingId(null)
      if (result.error) {
        setGlobalError(result.error)
        return
      }
      if (result.warnings?.length) setOverlapWarnings(result.warnings)
      if (result.season) {
        setSeasons((prev) =>
          prev
            .map((s) => (s.id === editTarget.id ? (result.season as SeasonRow) : s))
            .sort((a, b) => a.start_date.localeCompare(b.start_date))
        )
      }
      setFormMode('none')
      setEditTarget(null)
      router.refresh()
    })
  }

  const handleToggleActive = (id: string, next: boolean) => {
    clearFeedback()
    setPendingId(id)
    startTransition(async () => {
      const result = await updateSeason(id, { is_active: next })
      setPendingId(null)
      if (result.error) {
        setGlobalError(result.error)
        return
      }
      setSeasons((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_active: next } : s))
      )
      router.refresh()
    })
  }

  const handleDelete = (id: string) => {
    clearFeedback()
    setPendingId(id)
    startTransition(async () => {
      const result = await deleteSeason(id)
      setPendingId(null)
      if (result.error) {
        setGlobalError(result.error)
        return
      }
      setSeasons((prev) => prev.filter((s) => s.id !== id))
      router.refresh()
    })
  }

  // Build initial values for the edit form from an existing season
  const buildEditInitials = (season: SeasonRow): FormState => {
    const ratesForForm: Record<string, string> = {}
    for (const [rtId, rate] of Object.entries(season.pricing_overrides?.rates ?? {})) {
      ratesForForm[rtId] = String(rate)
    }
    return {
      name: season.name,
      start_date: season.start_date,
      end_date: season.end_date,
      color: season.color,
      priority: season.priority,
      rates: ratesForForm,
      min_los: season.restrictions?.min_los != null ? String(season.restrictions.min_los) : '',
      closed_room_types: season.restrictions?.closed_room_types ?? [],
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Global error */}
      {globalError && (
        <div
          role="alert"
          aria-live="assertive"
          className="px-4 py-3 rounded-xl bg-error-50 border border-error-200 text-sm text-error-700"
        >
          {globalError}
        </div>
      )}

      {/* Overlap warnings */}
      {overlapWarnings.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800"
        >
          <p className="font-medium mb-1">Solapamiento de temporadas detectado</p>
          <ul className="list-disc list-inside space-y-0.5">
            {overlapWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Section header + create button */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Temporadas</h2>
          <p className="text-sm text-foreground-secondary mt-0.5">
            {seasons.length === 0
              ? 'No hay temporadas definidas aun.'
              : `${seasons.length} ${seasons.length === 1 ? 'temporada' : 'temporadas'} configuradas`}
          </p>
        </div>
        {canEdit && formMode === 'none' && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleOpenCreate}
            disabled={isPending}
            leftIcon={<PlusIcon className="w-4 h-4" aria-hidden="true" />}
          >
            Nueva temporada
          </Button>
        )}
      </div>

      {/* Create form */}
      {canEdit && formMode === 'create' && (
        <section
          className="bg-white rounded-2xl border border-border p-5 sm:p-6"
          aria-label="Formulario nueva temporada"
        >
          <h3 className="text-base font-semibold text-foreground mb-5">
            Nueva temporada
          </h3>
          <SeasonForm
            roomTypes={roomTypes}
            initialValues={buildEmptyForm()}
            onSubmit={handleCreate}
            onCancel={handleCancel}
            isPending={isPending}
            submitLabel="Crear temporada"
            currency={currency}
          />
        </section>
      )}

      {/* Season list */}
      {seasons.length === 0 && formMode !== 'create' ? (
        <section
          className="bg-white rounded-2xl border border-border p-10 text-center"
          aria-label="Sin temporadas"
        >
          <CalendarEmptyIcon className="w-10 h-10 text-foreground-muted mx-auto mb-3" aria-hidden="true" />
          <p className="text-foreground font-medium mb-1">Sin temporadas configuradas</p>
          <p className="text-sm text-foreground-secondary mb-5">
            Crea una temporada para aplicar tarifas y restricciones especiales en rangos de fechas.
          </p>
          {canEdit && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleOpenCreate}
              disabled={isPending}
            >
              Crear primera temporada
            </Button>
          )}
        </section>
      ) : (
        <div className="space-y-4" role="list" aria-label="Lista de temporadas">
          {seasons.map((season) => (
            <div key={season.id} role="listitem">
              {/* Inline edit form for this season */}
              {canEdit && formMode === season.id && editTarget?.id === season.id ? (
                <section
                  className="bg-white rounded-2xl border border-primary-200 p-5 sm:p-6"
                  aria-label={`Editar temporada ${season.name}`}
                >
                  <h3 className="text-base font-semibold text-foreground mb-5">
                    Editar: {season.name}
                  </h3>
                  <SeasonForm
                    roomTypes={roomTypes}
                    initialValues={buildEditInitials(season)}
                    onSubmit={handleUpdate}
                    onCancel={handleCancel}
                    isPending={isPending}
                    submitLabel="Guardar cambios"
                    currency={currency}
                  />
                </section>
              ) : (
                <SeasonCard
                  season={season}
                  roomTypes={roomTypes}
                  canEdit={canEdit}
                  onToggleActive={handleToggleActive}
                  onDelete={handleDelete}
                  onEdit={handleOpenEdit}
                  isPendingId={pendingId}
                  currency={currency}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Inline icons ──────────────────────────────────────────────────────────────

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
      />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
      />
    </svg>
  )
}

function CalendarEmptyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}
