/**
 * Centralized labels for the Property Setup module.
 * Phase 1: Spanish-only dictionary. Ready for i18n extraction.
 * Future: Replace with next-intl or similar library.
 */

export const SETUP_LABELS = {
  // ─── Common ─────────────────────────────────────────────────
  common: {
    save: 'Guardar cambios',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    edit: 'Editar',
    add: 'Agregar',
    create: 'Crear',
    close: 'Cerrar',
    confirm: 'Confirmar',
    loading: 'Cargando...',
    noPermission: 'No tienes permisos para editar.',
    savedSuccess: 'Cambios guardados correctamente.',
  },

  // ─── Auth / Errors ──────────────────────────────────────────
  errors: {
    notAuthenticated: 'No autenticado',
    noActiveProperty: 'No hay propiedad activa',
    notFound: 'No encontrado',
    requiredField: (field: string) => `${field} es requerido`,
  },

  // ─── Setup Hub ──────────────────────────────────────────────
  hub: {
    title: 'Centro de Configuracion',
    completedSuffix: 'completado',
    readyToPublish: 'Tu propiedad esta lista para publicarse.',
    sections: {
      identity: { label: 'Identidad', description: 'Nombre, ubicacion y contacto del hotel' },
      rooms: { label: 'Habitaciones', description: 'Tipos de habitacion y unidades' },
      amenities: { label: 'Amenidades', description: 'Servicios y comodidades' },
      pricing: { label: 'Precios', description: 'Configuracion comercial e impuestos' },
      rates: { label: 'Tarifas', description: 'Tarifas base y temporadas' },
      gallery: { label: 'Galeria', description: 'Fotos del hotel y habitaciones' },
      content: { label: 'Contenido', description: 'Textos publicos del sitio de reservas' },
      services: { label: 'Servicios', description: 'Restaurante, spa y mas' },
      payments: { label: 'Pagos', description: 'Proveedores de pago' },
      publish: { label: 'Publicar', description: 'Dominio, widget embebible y visibilidad' },
    },
  },

  // ─── Amenity Categories ─────────────────────────────────────
  amenityCategories: {
    general: 'General',
    pool: 'Piscina',
    business: 'Negocios',
    wellness: 'Bienestar',
    dining: 'Gastronomia',
    accessibility: 'Accesibilidad',
    outdoor: 'Exterior',
    custom: 'Personalizado',
  } as Record<string, string>,

  // ─── Service Types ──────────────────────────────────────────
  serviceTypes: {
    restaurant: 'Restaurante',
    spa: 'Spa',
    bar: 'Bar',
    daypass: 'Day Pass',
    events: 'Eventos',
    tours: 'Tours',
    custom: 'Otro',
  } as Record<string, string>,

  // ─── Property Types ─────────────────────────────────────────
  propertyTypes: {
    hotel: 'Hotel',
    hostal: 'Hostal',
    boutique: 'Hotel Boutique',
    resort: 'Resort',
    posada: 'Posada',
    'apart-hotel': 'Apart-Hotel',
    villa: 'Villa',
    cabin: 'Cabana',
  } as Record<string, string>,

  // ─── Seasons ────────────────────────────────────────────────
  seasons: {
    title: 'Temporadas',
    noSeasons: 'No hay temporadas definidas aun.',
    createFirst: 'Crear primera temporada',
    newSeason: 'Nueva temporada',
    editSeason: 'Editar',
    deleteSeason: 'Eliminar',
    confirmDelete: 'Confirmar',
    seasonName: 'Nombre de la temporada',
    startDate: 'Fecha de inicio',
    endDate: 'Fecha de fin',
    priority: 'Prioridad',
    priorityHint: 'Mayor numero = mayor prioridad. Usado cuando se solapan temporadas.',
    ratesPerRoomType: 'Tarifas por tipo de habitacion',
    ratesHint: 'Deja vacio para heredar la tarifa base del tipo de habitacion.',
    baseRate: 'Tarifa base',
    restrictions: 'Restricciones',
    minLos: 'Minimo de noches (min_los)',
    closedRoomTypes: 'Tipos de habitacion cerrados en esta temporada',
    active: 'Activa',
    inactive: 'Inactiva',
    overlapWarning: (names: string[]) =>
      `Cuidado: esta temporada se solapa con ${names.join(', ')} en la misma prioridad.`,
  },

  // ─── Publish ────────────────────────────────────────────────
  publish: {
    title: 'Publicar Hotel',
    statusTitle: 'Estado de publicacion',
    statusDescription: 'Controla si tu hotel es visible para los huespedes.',
    published: 'Publicado',
    draft: 'Borrador',
    publishedMessage: 'Tu hotel esta publicado y visible para los huespedes.',
    readyMessage: 'Tu hotel esta listo para publicar.',
    needsMore: 'Completa al menos el 80% de la configuracion para publicar.',
    publishBtn: 'Publicar hotel',
    unpublishBtn: 'Despublicar',
    slugTitle: 'URL publica',
    slugDescription: 'El identificador unico de tu hotel en Revenia.',
    slugHint: 'Solo letras minusculas, numeros y guiones.',
    generateSlug: 'Generar slug',
    saveSlug: 'Guardar slug',
    slugSaved: 'Slug guardado correctamente.',
    embedTitle: 'Widget Embebible',
    embedDescription: 'Inserta el motor de reservas en tu sitio web.',
    embedLabel: 'Codigo de integracion',
    copyCode: 'Copiar codigo',
    copied: 'Copiado',
    viewBookingPage: 'Ver pagina de reservas',
  },

  // ─── Gallery ────────────────────────────────────────────────
  gallery: {
    title: 'Galeria de Fotos',
    uploadPrompt: 'Arrastra una imagen o',
    clickToUpload: 'haz clic para explorar',
    fileLimits: 'JPEG, PNG o WebP · Maximo 5 MB por imagen',
    uploading: 'Subiendo imagen...',
    noPhotos: 'No hay fotos todavia',
    noPhotosHint: 'Sube la primera imagen de tu hotel usando la zona de arriba.',
    noPhotosReadOnly: 'No hay fotos. Contacta al administrador para agregar imagenes.',
    heroLabel: 'Principal',
    setHero: 'Hacer principal',
    deleteConfirm: 'Eliminar esta imagen? Esta accion no se puede deshacer.',
    fileTooLarge: 'El archivo supera el limite de 5 MB.',
    invalidFileType: 'Solo se permiten archivos de imagen (JPEG, PNG, WebP).',
  },

  // ─── Identity ───────────────────────────────────────────────
  identity: {
    title: 'Identidad del Hotel',
    basicInfo: 'Informacion basica',
    location: 'Ubicacion',
    contact: 'Contacto',
    schedules: 'Horarios',
    hotelName: 'Nombre del hotel',
    propertyType: 'Tipo de propiedad',
    starRating: 'Clasificacion por estrellas',
    noRating: 'Sin clasificacion',
    address: 'Direccion',
    city: 'Ciudad',
    stateProvince: 'Estado / Provincia / Departamento',
    country: 'Pais',
    postalCode: 'Codigo postal',
    phone: 'Telefono',
    email: 'Correo electronico',
    website: 'Sitio web',
    checkIn: 'Hora de check-in',
    checkOut: 'Hora de check-out',
    selectCountry: 'Seleccionar pais...',
    selectType: 'Seleccionar tipo...',
  },
} as const
