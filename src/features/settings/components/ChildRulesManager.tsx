'use client'

import { useState, useTransition } from 'react'
import { createChildRule, deleteChildRule } from '@/actions/settings'
import type { ChildPricingRule } from '@/types/hotelero'

interface ChildRulesManagerProps {
  propertyId: string
  initialRules: ChildPricingRule[]
  canEdit: boolean
}

export function ChildRulesManager({
  propertyId,
  initialRules,
  canEdit,
}: ChildRulesManagerProps) {
  const [rules, setRules] = useState<ChildPricingRule[]>(initialRules)
  const [minAge, setMinAge] = useState('')
  const [maxAge, setMaxAge] = useState('')
  const [feeValue, setFeeValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await createChildRule({
        property_id: propertyId,
        min_age: parseInt(minAge, 10),
        max_age: parseInt(maxAge, 10),
        fee_value: parseFloat(feeValue) || 0,
        applies_per_night: true,
      })

      if (result.error) {
        setError(result.error)
        return
      }

      if (result.rule) {
        setRules((prev) => [...prev, result.rule!].sort((a, b) => a.min_age - b.min_age))
      }
      setMinAge('')
      setMaxAge('')
      setFeeValue('')
    })
  }

  const handleDelete = (ruleId: string) => {
    startTransition(async () => {
      const result = await deleteChildRule(ruleId)
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
      {/* Tabla de reglas */}
      {rules.length === 0 ? (
        <p className="text-sm text-foreground-secondary">
          Sin reglas de niños configuradas. Las reservas no calcularán cargo por niños.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-foreground-secondary">Rango de edad</th>
                <th className="text-right px-4 py-2 font-medium text-foreground-secondary">Tarifa/noche</th>
                {canEdit && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 text-foreground">
                    {rule.min_age} – {rule.max_age} años
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                    ${Number(rule.fee_value).toFixed(2)}
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
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground-secondary mb-1">Edad mínima</label>
              <input
                type="number"
                min="0"
                max="17"
                value={minAge}
                onChange={(e) => setMinAge(e.target.value)}
                required
                placeholder="0"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground-secondary mb-1">Edad máxima</label>
              <input
                type="number"
                min="0"
                max="17"
                value={maxAge}
                onChange={(e) => setMaxAge(e.target.value)}
                required
                placeholder="12"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground-secondary mb-1">Tarifa/noche (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={feeValue}
                onChange={(e) => setFeeValue(e.target.value)}
                required
                placeholder="0.00"
                className={inputCls}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 rounded-xl border border-border bg-white text-sm font-medium text-foreground-secondary hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Agregando…' : '+ Agregar regla'}
          </button>
        </form>
      )}
    </div>
  )
}
