'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  createService,
  updateService,
  deleteService,
} from '@/actions/property-services'
import { SETUP_LABELS } from '@/features/property-setup/constants/setup-labels'
import type { ServiceType } from '@/types/hotelero'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceRow {
  id: string
  service_type: string
  name: string
  short_description_es: string | null
  short_description_en: string | null
  is_active: boolean
}

interface ServiceManagerProps {
  initialServices: ServiceRow[]
  canEdit: boolean
}

interface EditingState {
  id: string
  name: string
  short_description_es: string
  short_description_en: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_TYPE_OPTIONS: Array<{ value: ServiceType | ''; label: string }> = [
  { value: '', label: 'Seleccionar tipo...' },
  { value: 'restaurant', label: 'Restaurante' },
  { value: 'spa', label: 'Spa' },
  { value: 'bar', label: 'Bar' },
  { value: 'daypass', label: 'Day Pass' },
  { value: 'events', label: 'Eventos' },
  { value: 'tours', label: 'Tours' },
  { value: 'custom', label: 'Otro' },
]

const SERVICE_TYPE_LABELS = SETUP_LABELS.serviceTypes

const SERVICE_TYPE_COLORS: Record<string, string> = {
  restaurant: 'bg-orange-100 text-orange-700',
  spa: 'bg-purple-100 text-purple-700',
  bar: 'bg-amber-100 text-amber-700',
  daypass: 'bg-cyan-100 text-cyan-700',
  events: 'bg-blue-100 text-blue-700',
  tours: 'bg-green-100 text-green-700',
  custom: 'bg-gray-100 text-gray-600',
}

const ALL_TAB = '__all__'

const TAB_ORDER: Array<ServiceType | typeof ALL_TAB> = [
  ALL_TAB,
  'restaurant',
  'spa',
  'bar',
  'daypass',
  'events',
  'tours',
  'custom',
]

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-border p-10 text-center" aria-label="Sin servicios">
      <ServiceIcon className="w-10 h-10 text-foreground-muted mx-auto mb-3" aria-hidden="true" />
      <p className="text-foreground font-medium mb-1">No hay servicios configurados</p>
      <p className="text-sm text-foreground-secondary">
        Agrega tu restaurante, spa u otros servicios.
      </p>
    </div>
  )
}

// ─── Add form ─────────────────────────────────────────────────────────────────

interface AddFormProps {
  onSuccess: () => void
  onCancel: () => void
}

function AddServiceForm({ onSuccess, onCancel }: AddFormProps) {
  const [serviceType, setServiceType] = useState<ServiceType | ''>('')
  const [name, setName] = useState('')
  const [descEs, setDescEs] = useState('')
  const [descEn, setDescEn] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!serviceType) {
      setFormError('Selecciona el tipo de servicio.')
      return
    }
    if (!name.trim()) {
      setFormError('El nombre es requerido.')
      return
    }

    startTransition(async () => {
      const result = await createService({
        service_type: serviceType as ServiceType,
        name: name.trim(),
        short_description_es: descEs.trim() || undefined,
        short_description_en: descEn.trim() || undefined,
      })

      if (result.error) {
        setFormError(result.error)
        return
      }

      onSuccess()
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-border p-5 space-y-4"
      aria-label="Formulario para agregar servicio"
      noValidate
    >
      <h3 className="text-sm font-semibold text-foreground">Nuevo servicio</h3>

      {formError && (
        <div role="alert" aria-live="assertive" className="px-3 py-2 rounded-xl bg-error-50 border border-error-200 text-sm text-error-700">
          {formError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Tipo de servicio"
          options={SERVICE_TYPE_OPTIONS}
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value as ServiceType | '')}
          disabled={isPending}
          required
        />
        <Input
          label="Nombre"
          placeholder="Ej: Restaurante El Jardin"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          required
        />
        <Input
          label="Descripcion (Espanol)"
          placeholder="Breve descripcion en espanol"
          value={descEs}
          onChange={(e) => setDescEs(e.target.value)}
          disabled={isPending}
        />
        <Input
          label="Description (English)"
          placeholder="Short description in English"
          value={descEn}
          onChange={(e) => setDescEn(e.target.value)}
          disabled={isPending}
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          isLoading={isPending}
          disabled={isPending}
        >
          Agregar servicio
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}

// ─── Edit form (inline) ───────────────────────────────────────────────────────

interface EditFormProps {
  editing: EditingState
  onClose: () => void
  onChange: (field: keyof Omit<EditingState, 'id'>, value: string) => void
  onSave: () => void
  isPending: boolean
}

function EditServiceForm({ editing, onClose, onChange, onSave, isPending }: EditFormProps) {
  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Input
            label="Nombre"
            value={editing.name}
            onChange={(e) => onChange('name', e.target.value)}
            disabled={isPending}
          />
        </div>
        <Input
          label="Descripcion (Espanol)"
          value={editing.short_description_es}
          onChange={(e) => onChange('short_description_es', e.target.value)}
          disabled={isPending}
        />
        <Input
          label="Description (English)"
          value={editing.short_description_en}
          onChange={(e) => onChange('short_description_en', e.target.value)}
          disabled={isPending}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" variant="primary" size="sm" isLoading={isPending} disabled={isPending} onClick={onSave}>
          Guardar
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

// ─── Service card ─────────────────────────────────────────────────────────────

interface ServiceCardProps {
  service: ServiceRow
  canEdit: boolean
  editing: EditingState | null
  togglePending: boolean
  editPending: boolean
  deletePending: boolean
  onEdit: (service: ServiceRow) => void
  onEditClose: () => void
  onEditChange: (field: keyof Omit<EditingState, 'id'>, value: string) => void
  onEditSave: () => void
  onToggleActive: (service: ServiceRow) => void
  onDelete: (service: ServiceRow) => void
}

function ServiceCard({
  service,
  canEdit,
  editing,
  togglePending,
  editPending,
  deletePending,
  onEdit,
  onEditClose,
  onEditChange,
  onEditSave,
  onToggleActive,
  onDelete,
}: ServiceCardProps) {
  const isEditing = editing?.id === service.id
  const typeLabel = SERVICE_TYPE_LABELS[service.service_type] ?? service.service_type
  const typeColor = SERVICE_TYPE_COLORS[service.service_type] ?? 'bg-gray-100 text-gray-600'

  return (
    <article
      className="bg-white rounded-2xl border border-border p-5"
      aria-label={`Servicio: ${service.name}`}
    >
      {/* Card header row */}
      <div className="flex items-start gap-3">
        {/* Name + type badge */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-foreground leading-snug">
              {service.name}
            </h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeColor}`}
              aria-label={`Tipo: ${typeLabel}`}
            >
              {typeLabel}
            </span>
          </div>
          {service.short_description_es && (
            <p className="text-sm text-foreground-secondary line-clamp-2">
              {service.short_description_es}
            </p>
          )}
        </div>

        {/* Active toggle */}
        {canEdit && (
          <button
            type="button"
            role="switch"
            aria-checked={service.is_active}
            aria-label={service.is_active ? 'Desactivar servicio' : 'Activar servicio'}
            onClick={() => onToggleActive(service)}
            disabled={togglePending}
            className={`
              relative shrink-0 mt-0.5 w-10 h-5.5 rounded-full transition-colors duration-200
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed
              ${service.is_active ? 'bg-primary-500' : 'bg-gray-200'}
            `}
          >
            <span
              className={`
                absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm
                transition-transform duration-200
                ${service.is_active ? 'translate-x-[18px]' : 'translate-x-0'}
              `}
              aria-hidden="true"
            />
          </button>
        )}

        {/* Not editable: static active badge */}
        {!canEdit && (
          <span
            className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${service.is_active ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-500'}`}
          >
            {service.is_active ? 'Activo' : 'Inactivo'}
          </span>
        )}
      </div>

      {/* Action buttons */}
      {canEdit && !isEditing && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(service)}
            disabled={editPending || deletePending}
            leftIcon={<PencilIcon className="w-3.5 h-3.5" />}
          >
            Editar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(service)}
            disabled={deletePending || editPending}
            className="text-error-600 hover:bg-error-50"
            leftIcon={<TrashIcon className="w-3.5 h-3.5" />}
          >
            Eliminar
          </Button>
        </div>
      )}

      {/* Inline edit form */}
      {canEdit && isEditing && editing && (
        <EditServiceForm
          editing={editing}
          onClose={onEditClose}
          onChange={onEditChange}
          onSave={onEditSave}
          isPending={editPending}
        />
      )}
    </article>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ServiceManager({ initialServices, canEdit }: ServiceManagerProps) {
  const router = useRouter()

  // ─── UI state ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ServiceType | typeof ALL_TAB>(ALL_TAB)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // ─── Pending states (one per action category) ──────────────────────────
  const [isTogglePending, startToggleTransition] = useTransition()
  const [isEditPending, startEditTransition] = useTransition()
  const [isDeletePending, startDeleteTransition] = useTransition()

  // ─── Derived: filtered services ───────────────────────────────────────
  const visibleServices = activeTab === ALL_TAB
    ? initialServices
    : initialServices.filter((s) => s.service_type === activeTab)

  // ─── Tabs: only show types that have at least one service + "All" ──────
  const presentTypes = new Set(initialServices.map((s) => s.service_type))
  const visibleTabs = TAB_ORDER.filter(
    (t) => t === ALL_TAB || presentTypes.has(t),
  )

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleAddSuccess = () => {
    setShowAddForm(false)
    router.refresh()
  }

  const handleEdit = (service: ServiceRow) => {
    setEditing({
      id: service.id,
      name: service.name,
      short_description_es: service.short_description_es ?? '',
      short_description_en: service.short_description_en ?? '',
    })
  }

  const handleEditChange = (
    field: keyof Omit<EditingState, 'id'>,
    value: string,
  ) => {
    setEditing((prev) => (prev ? { ...prev, [field]: value } : null))
  }

  const handleEditSave = () => {
    if (!editing) return
    setGlobalError(null)

    startEditTransition(async () => {
      const result = await updateService(editing.id, {
        name: editing.name.trim(),
        short_description_es: editing.short_description_es.trim() || undefined,
        short_description_en: editing.short_description_en.trim() || undefined,
      })

      if (result.error) {
        setGlobalError(result.error)
        return
      }

      setEditing(null)
      router.refresh()
    })
  }

  const handleToggleActive = (service: ServiceRow) => {
    setGlobalError(null)

    startToggleTransition(async () => {
      const result = await updateService(service.id, {
        is_active: !service.is_active,
      })

      if (result.error) {
        setGlobalError(result.error)
        return
      }

      router.refresh()
    })
  }

  const handleDelete = (service: ServiceRow) => {
    const confirmed = window.confirm(
      `¿Eliminar el servicio "${service.name}"? Esta accion no se puede deshacer.`,
    )
    if (!confirmed) return

    setGlobalError(null)

    startDeleteTransition(async () => {
      const result = await deleteService(service.id)

      if (result.error) {
        setGlobalError(result.error)
        return
      }

      router.refresh()
    })
  }

  // ─── Render ────────────────────────────────────────────────────────────

  const tabLabel = (tab: ServiceType | typeof ALL_TAB): string =>
    tab === ALL_TAB ? 'Todos' : (SERVICE_TYPE_LABELS[tab] ?? tab)

  return (
    <div className="space-y-5">
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

      {/* Toolbar: type filter tabs + add button */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Filter pills — only rendered when there are services */}
        {initialServices.length > 0 && (
          <nav
            aria-label="Filtrar por tipo de servicio"
            className="flex flex-wrap gap-1.5 flex-1"
          >
            {visibleTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                aria-pressed={activeTab === tab}
                className={`
                  px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1
                  ${activeTab === tab
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                `}
              >
                {tabLabel(tab)}
                {tab !== ALL_TAB && (
                  <span className="ml-1 tabular-nums">
                    ({initialServices.filter((s) => s.service_type === tab).length})
                  </span>
                )}
                {tab === ALL_TAB && (
                  <span className="ml-1 tabular-nums">
                    ({initialServices.length})
                  </span>
                )}
              </button>
            ))}
          </nav>
        )}

        {/* Add service button */}
        {canEdit && !showAddForm && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setShowAddForm(true)}
            leftIcon={<PlusIcon className="w-4 h-4" aria-hidden="true" />}
            className="ml-auto"
          >
            Agregar servicio
          </Button>
        )}
      </div>

      {/* Add form */}
      {showAddForm && (
        <AddServiceForm
          onSuccess={handleAddSuccess}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Service list */}
      {visibleServices.length === 0 && !showAddForm ? (
        <EmptyState />
      ) : (
        <ul
          className="space-y-3"
          aria-label="Lista de servicios"
        >
          {visibleServices.map((service) => (
            <li key={service.id}>
              <ServiceCard
                service={service}
                canEdit={canEdit}
                editing={editing?.id === service.id ? editing : null}
                togglePending={isTogglePending}
                editPending={isEditPending}
                deletePending={isDeletePending}
                onEdit={handleEdit}
                onEditClose={() => setEditing(null)}
                onEditChange={handleEditChange}
                onEditSave={handleEditSave}
                onToggleActive={handleToggleActive}
                onDelete={handleDelete}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Inline icons (avoid Lucide import overhead) ──────────────────────────────

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  )
}

function ServiceIcon({ className, 'aria-hidden': ariaHidden }: { className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }) {
  return (
    <svg className={className} aria-hidden={ariaHidden} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
    </svg>
  )
}
