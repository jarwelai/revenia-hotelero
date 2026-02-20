// ============================================================
// SITE CONFIG — Revenia V1
// Motor de Reservas Directas para Hoteles
// ============================================================

export interface ServiceItem {
  icon: 'booking' | 'rooms' | 'rates' | 'channels' | 'payments' | 'analytics' | 'custom'
  title: string
  slug: string
  shortDescription: string
  fullDescription: string
}

export interface TeamMember {
  name: string
  title: string
  bio: string
  specialties: string[]
  imageUrl?: string
}

export interface Testimonial {
  name: string
  hotelName: string
  quote: string
  rating: number
}

export interface NavItem {
  label: string
  href: string
  children?: { label: string; href: string }[]
}

export interface SiteConfig {
  firmName: string
  firmSlogan: string
  firmDescription: string
  founderName: string
  founderTitle: string
  founderBio: string
  yearsExperience: number
  yearFounded: number

  contact: {
    phone: string
    phoneDisplay: string
    email: string
    address: string
    city: string
    country: string
    googleMapsEmbedUrl: string
    whatsappNumber?: string
    officeHours: string
  }

  social: {
    facebook?: string
    instagram?: string
    linkedin?: string
    twitter?: string
  }

  navigation: {
    items: NavItem[]
  }

  hero: {
    headline: string
    subheadline: string
    ctaText: string
    ctaHref: string
    backgroundImageUrl?: string
  }

  values: Array<{
    icon: 'respect' | 'quality' | 'team' | 'experience' | 'confidential' | 'results'
    title: string
    description: string
  }>

  services: ServiceItem[]

  tabs: Array<{
    title: string
    content: string
  }>

  team: TeamMember[]

  testimonials: Testimonial[]

  booking: {
    enabled: boolean
    ctaText: string
  }

  seo: {
    siteTitle: string
    titleTemplate: string
    defaultDescription: string
    locale: string
    ogImageUrl?: string
  }

  legal: {
    privacyLastUpdated: string
    termsLastUpdated: string
  }

  theme?: {
    primaryColor?: string
    accentColor?: string
  }
}

// ============================================================
// CONFIGURACIÓN: Revenia — Motor de Reservas Directas
// ============================================================

export const siteConfig: SiteConfig = {
  firmName: 'Revenia',
  firmSlogan: 'Motor de reservas directas para hoteles',
  firmDescription: 'Plataforma multi-tenant de reservas directas para hoteles pequeños y medianos. Centraliza disponibilidad, cobra online y elimina comisiones de OTAs.',
  founderName: 'Equipo Revenia',
  founderTitle: 'Fundadores',
  founderBio: 'Revenia nació de la necesidad de dar a los hoteles independientes una herramienta poderosa para competir con las grandes cadenas sin depender de las OTAs.',
  yearsExperience: 1,
  yearFounded: 2026,

  contact: {
    phone: '+50500000000',
    phoneDisplay: '+505 0000-0000',
    email: 'hola@revenia.com',
    address: 'Managua, Nicaragua',
    city: 'Managua',
    country: 'Nicaragua',
    googleMapsEmbedUrl: '',
    officeHours: 'Lunes a Viernes, 8:00 a.m. a 5:00 p.m.',
  },

  social: {
    instagram: 'https://instagram.com/revenia',
    linkedin: 'https://linkedin.com/company/revenia',
  },

  navigation: {
    items: [
      { label: 'Inicio', href: '/' },
      { label: 'Funcionalidades', href: '/#funcionalidades' },
      { label: 'Precios', href: '/#precios' },
      { label: 'Contacto', href: '/contacto' },
    ],
  },

  hero: {
    headline: 'Reservas directas sin comisiones',
    subheadline: 'Dale a tu hotel su propio motor de reservas. Cobra online, gestiona disponibilidad y olvídate de pagar comisiones a las OTAs.',
    ctaText: 'Comenzar gratis',
    ctaHref: '/signup',
  },

  values: [
    {
      icon: 'results',
      title: 'Sin comisiones de OTAs',
      description: 'Cada reserva directa es 100% tuya. Revenia cobra una suscripción fija, no un porcentaje de tus reservas.',
    },
    {
      icon: 'quality',
      title: 'Fácil de configurar',
      description: 'Tu hotel en línea en menos de 24 horas. Sin conocimientos técnicos, sin integraciones complicadas.',
    },
    {
      icon: 'team',
      title: 'Soporte real',
      description: 'Acompañamiento personalizado para que tu hotel aproveche al máximo cada funcionalidad.',
    },
  ],

  services: [
    {
      icon: 'booking',
      title: 'Booking Engine',
      slug: 'booking-engine',
      shortDescription: 'Motor de reservas propio embebible en tu sitio web. Tus huéspedes reservan directamente contigo.',
      fullDescription: 'Motor de reservas con disponibilidad en tiempo real, cotización automática y cobro online. Compatible con cualquier sitio web mediante un widget o un enlace directo.',
    },
    {
      icon: 'rooms',
      title: 'Gestión de Habitaciones',
      slug: 'habitaciones',
      shortDescription: 'Administra tipos de habitación, fotos, amenidades y disponibilidad desde un solo lugar.',
      fullDescription: 'Crea y gestiona todos tus tipos de habitación con descripción, galería de fotos, capacidad, amenidades y disponibilidad en tiempo real.',
    },
    {
      icon: 'rates',
      title: 'Tarifas Dinámicas',
      slug: 'tarifas',
      shortDescription: 'Define tarifas por temporada, día de semana o segmento. Maximiza tu ingreso por habitación.',
      fullDescription: 'Sistema de tarifas flexible que permite definir precios base, tarifas especiales por temporada, descuentos por anticipación y suplementos por ocupación.',
    },
    {
      icon: 'analytics',
      title: 'Reportes y Analytics',
      slug: 'analytics',
      shortDescription: 'Visualiza ocupación, ingresos y tendencias para tomar mejores decisiones.',
      fullDescription: 'Dashboard con métricas clave: ocupación por período, ADR, RevPAR, canales de reserva y comportamiento de huéspedes.',
    },
  ],

  tabs: [
    {
      title: 'Para hoteles boutique',
      content: 'Los hoteles boutique tienen una propuesta de valor única que las OTAs no pueden comunicar bien. Con Revenia, creas una experiencia de reserva que refleja la personalidad de tu propiedad y convierte visitantes en huéspedes directos.',
    },
    {
      title: 'Para hostales',
      content: 'Los hostales manejan múltiples tipos de alojamiento —camas, habitaciones privadas, dormitorios— y necesitan flexibilidad. Revenia soporta toda esa complejidad con una interfaz simple para ti y tus huéspedes.',
    },
    {
      title: 'Para apart-hoteles',
      content: 'Los apart-hoteles necesitan mostrar unidades con servicios diferenciados. Revenia te permite describir cada apartamento, definir tarifas por estadía mínima y gestionar reservas de largo plazo con la misma facilidad.',
    },
  ],

  team: [],

  testimonials: [],

  booking: {
    enabled: false,
    ctaText: 'Solicitar demo',
  },

  seo: {
    siteTitle: 'Revenia | Motor de Reservas Directas',
    titleTemplate: '%s | Revenia',
    defaultDescription: 'Motor de reservas directas multi-tenant para hoteles pequeños y medianos. Centraliza disponibilidad, cotiza automáticamente y cobra online.',
    locale: 'es_GT',
  },

  legal: {
    privacyLastUpdated: '2026-02-01',
    termsLastUpdated: '2026-02-01',
  },
}
