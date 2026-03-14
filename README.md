# Revenia - Hotel Revenue Management SaaS

SaaS vertical independiente para la gestion de hoteles boutique en Latinoamerica. Primera vertical del ecosistema Jarwel OS.

## Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Estilos:** Tailwind CSS 3.4
- **Pagos:** Stripe + Recurrente (LATAM)
- **AI:** Vercel AI SDK + OpenRouter
- **Estado:** Zustand
- **Deploy:** Vercel

## Arquitectura

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Login, signup, password reset
│   ├── (main)/            # Dashboard, rooms, bookings, calendar, ARI, reviews, settings
│   ├── (public)/          # Booking widget, checkout, confirmation
│   ├── admin/             # Super admin panel
│   ├── api/               # Webhooks, cron, OAuth callbacks
│   ├── embed/             # Embeddable widgets (reviews)
│   └── p/[publicKey]/     # Public property pages
│
├── features/              # Feature-First (dominio)
│   ├── ari/               # Rate management (ARI grid)
│   ├── auth/              # Authentication
│   ├── bookings/          # Booking management
│   ├── calendar/          # Tape chart + availability
│   ├── onboarding/        # Org/property setup wizard
│   ├── public-booking/    # BookWidget + CheckoutForm
│   ├── reviews/           # Review aggregation (TrustIndex-style)
│   ├── rooms/             # Room types + units
│   └── settings/          # Property configuration
│
├── lib/                   # Service layer
│   ├── ai/                # AI review response generator
│   ├── ari/               # Rate resolution engine
│   ├── availability/      # Half-open interval availability
│   ├── email/             # Resend transactional emails
│   ├── google/            # Google Business Profile OAuth
│   ├── ical/              # iCal sync engine
│   ├── payment/           # Payment finalization (atomic)
│   ├── payments/          # Payment abstraction layer
│   ├── quote/             # Per-night quote engine
│   ├── serpapi/            # Review discovery via SerpAPI
│   └── supabase/          # Client + server + proxy
│
├── components/ui/         # Shared UI primitives
├── actions/               # Server actions
└── types/                 # Domain types
```

## Modulos Principales

| Modulo | Estado | Descripcion |
|--------|--------|-------------|
| Booking Engine | Funcional | Widget publico + checkout + pagos reales |
| Tape Chart | Funcional | Calendario visual rooms x days |
| ARI Grid | Funcional | Tarifas por intervalo con dow_mask |
| iCal Sync | Funcional | Import/export con Airbnb, Booking, etc. |
| Reviews | Funcional | Agregacion Google/TripAdvisor + AI responses |
| Dashboard | Funcional | KPIs: ocupacion, revenue, ADR |
| Onboarding | Funcional | Wizard org + property + rooms |

## Desarrollo

```bash
npm install          # Instalar dependencias
npm run dev          # Dev server (Turbopack, auto-port 3000-3006)
npm run build        # Build produccion
npm run lint         # ESLint
```

## Variables de Entorno

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Pagos
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Email
RESEND_API_KEY=

# AI
OPENROUTER_API_KEY=

# Reviews
SERPAPI_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
TOKEN_ENCRYPTION_KEY=

# Admin
SUPER_ADMIN_EMAILS=
CRON_SECRET=
```

## Deploy

Desplegado en Vercel como `revenia-hotelero`. Repo: `jarwelai/revenia-hotelero`.

---

Primera vertical de [Jarwel OS](https://jarwel.ai). Ver `VISION.md` para la estrategia del ecosistema.
