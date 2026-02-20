import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAriGrid } from '@/actions/ari'
import { AriGridForm } from '@/features/ari/components/AriGridForm'
import { getActiveProperty } from '@/lib/property-context'
import type { SearchParams } from 'next/dist/server/request/search-params'

export const metadata = { title: 'Tarifas | Revenia' }

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

interface Props {
  searchParams: Promise<SearchParams>
}

export default async function RatesPage({ searchParams: _ }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const property = await getActiveProperty(supabase)
  if (!property) redirect('/onboarding')

  const dateFrom = todayStr()
  const dateTo = addDays(dateFrom, 14)

  const ariGrid = await getAriGrid(property.id, dateFrom, dateTo)

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-foreground-secondary mb-2">
          <Link href="/dashboard" className="hover:text-foreground">Dashboard</Link>
          <span>›</span>
          <span>Tarifas</span>
        </div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Tarifas</h1>
        <p className="text-foreground-secondary mt-1">
          {property.name} · Plan BAR (Best Available Rate)
        </p>
      </div>

      <AriGridForm ariGrid={ariGrid} propertyId={property.id} />
    </div>
  )
}
