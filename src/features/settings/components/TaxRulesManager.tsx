'use client'

import { useState, useTransition } from 'react'
import { createTaxRule, toggleTaxRule, deleteTaxRule } from '@/actions/settings'
import type { TaxRule } from '@/types/hotelero'

interface TaxRulesManagerProps {
  propertyId: string
  initialRules: TaxRule[]
  canEdit: boolean
}

export function TaxRulesManager({
  propertyId,
  initialRules,
  canEdit,
}: TaxRulesManagerProps) {
  const [rules, setRules] = useState<TaxRule[]>(initialRules)
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await createTaxRule({
        property_id: propertyId,
        name,
        value: parseFloat(value) || 0,
      })

      if (result.error) {
        setError(result.error)
        return
      }

      if (result.rule) {
        setRules((prev) => [...prev, result.rule!])
      }
      setName('')
      setValue('')
    })
  }

  const handleToggle = (ruleId: string, currentActive: boolean) => {
    startTransition(async () => {
      const result = await toggleTaxRule(ruleId, !currentActive)
      if (result.error) {
        setError(result.error)
        return
      }
      setRules((prev) => prev.map((r) =>
        r.id === ruleId ? { ...r, is_active: !currentActive } : r,
      ))
    })
  }

  const handleDelete = (ruleId: string) => {
    startTransition(async () => {
      const result = await deleteTaxRule(ruleId)
      if (result.error) {
        setError(result.error)
        return
      }
      setRules((prev) => prev.filter((r) => r.id !== ruleId))
    })
  }

  const inputCls = 'w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-400'

  return (
    <div className="space-y-4">
      {/* Tabla de impuestos */}
      {rules.length === 0 ? (
        <p className="text-sm text-foreground-secondary">
          Sin impuestos configurados. Las reservas no incluirán cargos adicionales.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-foreground-secondary">Nombre</th>
                <th className="text-right px-4 py-2 font-medium text-foreground-secondary">%</th>
                <th className="text-center px-4 py-2 font-medium text-foreground-secondary">Activo</th>
                {canEdit && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rules.map((rule) => (
                <tr key={rule.id} className={`hover:bg-gray-50/50 ${!rule.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2.5 text-foreground font-medium">{rule.name}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                    {Number(rule.value).toFixed(2)}%
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => handleToggle(rule.id, rule.is_active)}
                        disabled={isPending}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                          rule.is_active ? 'bg-accent-600' : 'bg-gray-200'
                        }`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          rule.is_active ? 'translate-x-4.5' : 'translate-x-0.5'
                        }`} />
                      </button>
                    ) : (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        rule.is_active ? 'bg-success-100 text-success-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {rule.is_active ? 'Sí' : 'No'}
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(rule.id)}
                        disabled={isPending}
                        className="text-xs text-error-600 hover:text-error-700 font-medium disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Formulario agregar */}
      {canEdit && (
        <form onSubmit={handleAdd} className="space-y-3 pt-2">
          {error && (
            <div className="rounded-xl bg-error-50 border border-error-200 px-3 py-2 text-sm text-error-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground-secondary mb-1">Nombre del impuesto</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Ej: IVA, City Tax"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground-secondary mb-1">Porcentaje (%)</label>
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                placeholder="Ej: 16"
                className={inputCls}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 rounded-xl border border-border bg-white text-sm font-medium text-foreground-secondary hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Agregando…' : '+ Agregar impuesto'}
          </button>
        </form>
      )}
    </div>
  )
}
