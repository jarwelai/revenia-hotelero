import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ReviewForm } from '@/features/reviews/components/ReviewForm'
import { getActivePropertyWithRole } from '@/lib/property-context'

export default async function NewReviewPage() {
  const supabase = await createClient()

  // Autenticación
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { property, role } = await getActivePropertyWithRole(supabase, user.id)
  if (!property) redirect('/onboarding')
  if (!role || role === 'staff') redirect('/dashboard/reviews')

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-foreground-secondary">
        <Link href="/dashboard/reviews" className="hover:text-foreground transition-colors">
          Reseñas
        </Link>
        <span>/</span>
        <span className="text-foreground">Nueva reseña</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-semibold text-foreground">Nueva reseña</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Agrega una reseña manual para <strong>{property.name}</strong>
        </p>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-6">
        <ReviewForm propertyId={property.id} />
      </div>
    </div>
  )
}
