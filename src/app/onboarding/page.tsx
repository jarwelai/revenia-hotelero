import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OrgOnboardingWizard } from '@/features/onboarding/components/OrgOnboardingWizard'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Si ya tiene org, ir directo al dashboard
  const { data: membership } = await supabase
    .from('org_members')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (membership) redirect('/dashboard')

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="w-14 h-14 bg-accent-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <HotelIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-heading font-bold text-foreground">
          Bienvenido a Revenia
        </h1>
        <p className="text-foreground-secondary mt-2 max-w-sm">
          Configura tu organización y primer hotel para comenzar a recibir reservas directas.
        </p>
      </div>

      <OrgOnboardingWizard />
    </main>
  )
}

function HotelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  )
}
