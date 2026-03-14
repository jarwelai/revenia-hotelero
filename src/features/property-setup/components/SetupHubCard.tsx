'use client'

import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SetupHubCardProps {
  label: string
  description: string
  href: string
  completed: boolean
  icon: React.ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SetupHubCard({
  label,
  description,
  href,
  completed,
  icon,
}: SetupHubCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex w-full flex-col gap-4 rounded-2xl border border-border bg-white p-5 transition-shadow duration-200 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
      aria-label={`${label}${completed ? ' — completado' : ''}`}
    >
      {/* Completion indicator — top-right corner */}
      <div className="absolute right-4 top-4" aria-hidden="true">
        {completed ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500">
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 6l3 3 5-5"
                stroke="white"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        ) : (
          <span className="flex h-6 w-6 rounded-full border-2 border-gray-300" />
        )}
      </div>

      {/* Main content row */}
      <div className="flex items-start gap-4 pr-8">
        {/* Icon box */}
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            completed ? 'bg-green-50' : 'bg-gray-50'
          }`}
          aria-hidden="true"
        >
          {icon}
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground leading-snug">{label}</p>
          <p className="mt-0.5 text-sm text-foreground-secondary leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      {/* Bottom action hint */}
      <p className="text-sm text-accent-500 group-hover:text-accent-600 transition-colors duration-150">
        {completed ? 'Ver configuración →' : 'Configurar →'}
      </p>
    </Link>
  )
}
