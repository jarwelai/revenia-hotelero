/**
 * ARI Engine — Resolución de tarifas por noche
 *
 * resolveNightRate: dado un room_type_id, una noche y un array pre-fetched de
 * rate_plan_intervals, retorna la tarifa aplicable (mayor priority que cumpla
 * las condiciones: rango de fechas, dow_mask, closed=false).
 *
 * Diseño: pre-fetch de intervalos para el rango completo de una reserva → O(1)
 * por noche en lugar de una query por noche.
 */

import type { RatePlanInterval } from '@/types/hotelero'

// ─── resolveNightRate ─────────────────────────────────────────────────────────

/**
 * Retorna la tarifa aplicable para una noche específica.
 *
 * @param roomTypeId  UUID del tipo de habitación, o null si no tiene tipo
 * @param night       YYYY-MM-DD — la noche a resolver
 * @param allIntervals  Array pre-fetched de RatePlanInterval para el rango
 * @returns { base_rate, total_rate } — ambos null si no hay tarifa configurada
 */
export function resolveNightRate(
  roomTypeId: string | null,
  night: string,
  allIntervals: RatePlanInterval[],
): { base_rate: number | null; total_rate: number | null } {
  if (!roomTypeId) return { base_rate: null, total_rate: null }

  // Calcular el bit del día de la semana (Monday=0, Sunday=6) para dow_mask
  // new Date(...).getDay() → 0=Dom, 1=Lun, ..., 6=Sáb
  // Conversión a Monday=0: (getDay() + 6) % 7
  const dayOfWeek = (new Date(night + 'T00:00:00Z').getDay() + 6) % 7
  const dowBit = 1 << dayOfWeek

  // Filtrar intervalos aplicables para esta noche y room type
  const candidates = allIntervals.filter((iv) => {
    if (iv.room_type_id !== roomTypeId) return false
    if (iv.closed) return false
    if (iv.start_date > night) return false
    if (iv.end_date <= night) return false  // end_date es exclusivo
    if ((iv.dow_mask & dowBit) === 0) return false
    return true
  })

  if (candidates.length === 0) return { base_rate: null, total_rate: null }

  // Tomar el de mayor priority (desc)
  candidates.sort((a, b) => b.priority - a.priority)
  const best = candidates[0]

  return {
    base_rate: best.base_rate,
    total_rate: best.base_rate,  // total = base por ahora (sin impuestos ni suplementos)
  }
}
