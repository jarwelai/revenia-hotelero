import { createClient } from '@/lib/supabase/server'
import { getActiveProperty } from '@/lib/property-context'
import { Sidebar } from '@/components/layout/sidebar'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Fetch all accessible properties for the switcher
  const { data: properties } = await supabase
    .from('properties')
    .select('id, name')
    .order('created_at', { ascending: true })

  const activeProperty = await getActiveProperty(supabase)

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        properties={(properties ?? []) as { id: string; name: string }[]}
        activePropertyId={activeProperty?.id ?? null}
      />
      <main className="ml-64">
        {children}
      </main>
    </div>
  )
}
