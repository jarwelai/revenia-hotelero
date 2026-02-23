import { Sidebar } from './sidebar'

interface DashboardLayoutProps {
  children: React.ReactNode
  properties?: { id: string; name: string }[]
  activePropertyId?: string | null
}

export function DashboardLayout({ children, properties = [], activePropertyId = null }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar properties={properties} activePropertyId={activePropertyId} />
      <main className="ml-64">
        {children}
      </main>
    </div>
  )
}
