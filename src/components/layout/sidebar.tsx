'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { setActiveProperty } from '@/actions/property-context'

interface PropertyItem {
  id: string
  name: string
}

interface NavItem {
  href: string
  label: string
  icon: React.FC<{ className?: string }>
  disabled?: boolean
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { href: '/dashboard/portfolio', label: 'Portfolio', icon: BarChartIcon },
  { href: '/dashboard/rooms', label: 'Habitaciones', icon: BedIcon },
  { href: '/dashboard/sync/ical', label: 'Sync iCal', icon: SyncIcon },
  { href: '/dashboard/availability', label: 'Disponibilidad', icon: AvailabilityIcon },
  { href: '/dashboard/calendar', label: 'Calendario', icon: CalendarGridIcon },
  { href: '/dashboard/bookings', label: 'Reservas', icon: CalendarIcon },
  { href: '/dashboard/reviews', label: 'Reseñas', icon: StarIcon },
  { href: '/dashboard/rates', label: 'Tarifas', icon: CurrencyIcon },
  { href: '/dashboard/settings', label: 'Configuración', icon: SettingsIcon },
]

interface SidebarProps {
  properties: PropertyItem[]
  activePropertyId: string | null
}

export function Sidebar({ properties, activePropertyId }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string>('')
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) setUserEmail(user.email)
    }
    fetchUser()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSwitchProperty = (propertyId: string) => {
    if (propertyId === activePropertyId) {
      setShowSwitcher(false)
      return
    }
    startTransition(async () => {
      await setActiveProperty(propertyId)
      setShowSwitcher(false)
      router.refresh()
    })
  }

  const activeProperty = properties.find((p) => p.id === activePropertyId) ?? properties[0] ?? null
  const initials = userEmail.slice(0, 2).toUpperCase()

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-primary-500 text-white flex flex-col z-40">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-500 rounded-xl flex items-center justify-center">
            <HotelIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-heading font-semibold text-lg">Revenia</h1>
            <p className="text-xs text-white/60">Motor de Reservas</p>
          </div>
        </Link>
      </div>

      {/* Property Switcher */}
      <div className="px-4 py-3 border-b border-white/10 relative">
        <button
          onClick={() => setShowSwitcher((v) => !v)}
          disabled={isPending || properties.length <= 1}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-colors text-left ${
            properties.length > 1
              ? 'hover:bg-white/10 cursor-pointer'
              : 'cursor-default'
          }`}
        >
          <div className="w-7 h-7 rounded-lg bg-accent-500/80 flex items-center justify-center flex-shrink-0">
            <HotelIcon className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/50 leading-none mb-0.5">Propiedad activa</p>
            <p className="text-sm font-medium text-white truncate leading-tight">
              {isPending ? 'Cambiando…' : (activeProperty?.name ?? '—')}
            </p>
          </div>
          {properties.length > 1 && (
            <ChevronIcon
              className={`w-4 h-4 text-white/40 flex-shrink-0 transition-transform ${showSwitcher ? 'rotate-180' : ''}`}
            />
          )}
        </button>

        {/* Dropdown */}
        {showSwitcher && properties.length > 1 && (
          <div className="absolute left-4 right-4 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
            {properties.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSwitchProperty(p.id)}
                className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-2 ${
                  p.id === activePropertyId
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {p.id === activePropertyId && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                )}
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* User Info */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-sm font-semibold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userEmail}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-wider text-white/40 px-4 mb-2">
          Principal
        </p>
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const Icon = item.icon

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/30 cursor-not-allowed"
                title="Próximamente"
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                <span className="ml-auto text-[10px] bg-white/10 px-2 py-0.5 rounded-full">
                  Pronto
                </span>
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl
                transition-all duration-200
                ${isActive
                  ? 'bg-white/15 text-white border-l-4 border-accent-500'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200"
        >
          <LogoutIcon className="w-5 h-5" />
          <span className="font-medium">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}

// Icons
function HotelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  )
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function BedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10M3 12h18M21 7v10M5 7h14a2 2 0 012 2v3H3V9a2 2 0 012-2z" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function CurrencyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}

function SyncIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

function AvailabilityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function CalendarGridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zM9 14h.01M12 14h.01M15 14h.01M9 17h.01M12 17h.01M15 17h.01" />
    </svg>
  )
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557l-4.204-3.601a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function BarChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}
