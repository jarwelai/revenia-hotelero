import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActiveProperty } from '@/lib/property-context'
import { computeActivationChecklist } from '@/lib/activation-checklist'
import { ActivationRing } from '@/features/property-setup/components/ActivationRing'
import { SetupHubCard } from '@/features/property-setup/components/SetupHubCard'
import { SETUP_LABELS } from '@/features/property-setup/constants/setup-labels'
import type { ActivationChecklistItem } from '@/types/hotelero'

export const metadata = { title: 'Configuracion | Revenia' }

// ---------------------------------------------------------------------------
// Setup sections definition
// Each section maps to a checklist key (or null when not yet tracked)
// ---------------------------------------------------------------------------

interface SetupSection {
  /** Matches an ActivationChecklistItem.key, or null if not in checklist yet */
  checklistKey: string | null
  label: string
  description: string
  href: string
  icon: React.ReactNode
}

const SETUP_SECTIONS: SetupSection[] = [
  {
    checklistKey: 'identity',
    label: SETUP_LABELS.hub.sections.identity.label,
    description: SETUP_LABELS.hub.sections.identity.description,
    href: '/dashboard/setup/identity',
    icon: <HotelIcon />,
  },
  {
    checklistKey: 'rooms',
    label: SETUP_LABELS.hub.sections.rooms.label,
    description: SETUP_LABELS.hub.sections.rooms.description,
    href: '/dashboard/setup/inventory',
    icon: <BedIcon />,
  },
  {
    checklistKey: 'amenities',
    label: SETUP_LABELS.hub.sections.amenities.label,
    description: SETUP_LABELS.hub.sections.amenities.description,
    href: '/dashboard/setup/amenities',
    icon: <SparkleIcon />,
  },
  {
    checklistKey: 'pricing',
    label: SETUP_LABELS.hub.sections.pricing.label,
    description: SETUP_LABELS.hub.sections.pricing.description,
    href: '/dashboard/setup/pricing',
    icon: <CurrencyIcon />,
  },
  {
    checklistKey: 'rates',
    label: SETUP_LABELS.hub.sections.rates.label,
    description: SETUP_LABELS.hub.sections.rates.description,
    href: '/dashboard/setup/rates',
    icon: <ChartIcon />,
  },
  {
    checklistKey: 'gallery',
    label: SETUP_LABELS.hub.sections.gallery.label,
    description: SETUP_LABELS.hub.sections.gallery.description,
    href: '/dashboard/setup/gallery',
    icon: <PhotoIcon />,
  },
  {
    checklistKey: 'content',
    label: SETUP_LABELS.hub.sections.content.label,
    description: SETUP_LABELS.hub.sections.content.description,
    href: '/dashboard/setup/content',
    icon: <DocumentIcon />,
  },
  {
    checklistKey: 'services',
    label: SETUP_LABELS.hub.sections.services.label,
    description: SETUP_LABELS.hub.sections.services.description,
    href: '/dashboard/setup/services',
    icon: <ServiceIcon />,
  },
  {
    checklistKey: 'payments',
    label: SETUP_LABELS.hub.sections.payments.label,
    description: SETUP_LABELS.hub.sections.payments.description,
    href: '/dashboard/setup/payments',
    icon: <CardIcon />,
  },
  {
    checklistKey: 'published',
    label: SETUP_LABELS.hub.sections.publish.label,
    description: SETUP_LABELS.hub.sections.publish.description,
    href: '/dashboard/setup/publish',
    icon: <GlobeIcon />,
  },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SetupHubPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const property = await getActiveProperty(supabase)
  if (!property) redirect('/onboarding')

  const checklist = await computeActivationChecklist(property.id)
  const percentage = Math.round(checklist.score * 100)

  // Build a lookup map for fast key access
  const checklistByKey = new Map<string, ActivationChecklistItem>(
    checklist.items.map((item) => [item.key, item])
  )

  return (
    <div className="p-6 sm:p-8 max-w-5xl">
      {/* Breadcrumb */}
      <nav aria-label="Navegacion de migas de pan" className="mb-6">
        <ol className="flex items-center gap-2 text-sm text-foreground-secondary">
          <li>
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
          </li>
          <li aria-hidden="true">
            <span>›</span>
          </li>
          <li className="text-foreground font-medium" aria-current="page">
            Configuracion
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">
            {SETUP_LABELS.hub.title}
          </h1>
          <p className="mt-1 text-foreground-secondary">
            {property.name} &middot; {percentage}% {SETUP_LABELS.hub.completedSuffix}
          </p>
          {checklist.ready_to_publish && (
            <p className="mt-2 text-sm text-green-600 font-medium">
              {SETUP_LABELS.hub.readyToPublish}
            </p>
          )}
        </div>

        <ActivationRing score={checklist.score} size={96} />
      </div>

      {/* Setup sections grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        role="list"
        aria-label="Secciones de configuracion"
      >
        {SETUP_SECTIONS.map((section) => {
          const checklistItem = section.checklistKey
            ? checklistByKey.get(section.checklistKey)
            : undefined
          const completed = checklistItem?.completed ?? false

          return (
            <div key={section.href} role="listitem">
              <SetupHubCard
                label={section.label}
                description={section.description}
                href={section.href}
                icon={section.icon}
                completed={completed}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline SVG icons — no external dependency, matches existing page pattern
// ---------------------------------------------------------------------------

function HotelIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-foreground-secondary"
    >
      <path d="M3 21V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v16" />
      <path d="M9 21v-6h6v6" />
      <path d="M9 9h1m5 0h1M9 13h1m5 0h1" />
    </svg>
  )
}

function BedIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-foreground-secondary"
    >
      <path d="M2 20V8.5A2.5 2.5 0 0 1 4.5 6h15A2.5 2.5 0 0 1 22 8.5V20" />
      <path d="M2 16h20" />
      <path d="M7 12a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
      <path d="M13 12h7" />
      <path d="M13 9h7" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-foreground-secondary"
    >
      <path d="M12 3v3m0 12v3M3 12h3m12 0h3" />
      <path d="m5.636 5.636 2.121 2.121m8.486 8.486 2.121 2.121M5.636 18.364l2.121-2.121m8.486-8.486 2.121-2.121" />
    </svg>
  )
}

function CurrencyIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-foreground-secondary"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.5A2.5 2.5 0 0 0 12 7h-.5A2.5 2.5 0 0 0 9 9.5v0A2.5 2.5 0 0 0 11.5 12h1A2.5 2.5 0 0 1 15 14.5v0A2.5 2.5 0 0 1 12.5 17H12a2.5 2.5 0 0 1-2.5-2.5" />
      <path d="M12 7v1m0 9v1" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-foreground-secondary"
    >
      <path d="M3 21h18" />
      <path d="M5 21V10l4-4 4 4 4-4v15" />
    </svg>
  )
}

function PhotoIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-foreground-secondary"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-foreground-secondary"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  )
}

function ServiceIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-foreground-secondary"
    >
      <path d="M3 11V7a9 9 0 0 1 18 0v4" />
      <path d="M3 11h18" />
      <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
      <path d="M9 19v-4h6v4" />
    </svg>
  )
}

function CardIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-foreground-secondary"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-foreground-secondary"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" />
    </svg>
  )
}
