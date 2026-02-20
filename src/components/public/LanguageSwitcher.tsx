import type { PublicLang } from '@/types/hotelero'

interface Props {
  currentLang: PublicLang
  esHref: string
  enHref: string
}

export function LanguageSwitcher({ currentLang, esHref, enHref }: Props) {
  return (
    <div className="flex items-center gap-0.5 text-xs font-medium">
      <a
        href={esHref}
        className={`px-2 py-1 rounded transition-colors ${
          currentLang === 'es'
            ? 'text-foreground font-semibold'
            : 'text-foreground-muted hover:text-foreground'
        }`}
        aria-current={currentLang === 'es' ? 'page' : undefined}
      >
        ES
      </a>
      <span className="text-foreground-muted select-none" aria-hidden>|</span>
      <a
        href={enHref}
        className={`px-2 py-1 rounded transition-colors ${
          currentLang === 'en'
            ? 'text-foreground font-semibold'
            : 'text-foreground-muted hover:text-foreground'
        }`}
        aria-current={currentLang === 'en' ? 'page' : undefined}
      >
        EN
      </a>
    </div>
  )
}
