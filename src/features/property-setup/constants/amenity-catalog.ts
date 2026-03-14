import type { AmenityCategory } from '@/types/hotelero'

export const AMENITY_CATALOG: {
  category: AmenityCategory
  code: string
  name_es: string
  name_en: string
}[] = [
  // general
  { category: 'general', code: 'wifi',              name_es: 'WiFi gratuito',         name_en: 'Free WiFi' },
  { category: 'general', code: 'parking',           name_es: 'Estacionamiento',        name_en: 'Parking' },
  { category: 'general', code: 'reception_24h',     name_es: 'Recepción 24 horas',     name_en: '24-hour reception' },
  { category: 'general', code: 'elevator',          name_es: 'Ascensor',               name_en: 'Elevator' },
  { category: 'general', code: 'luggage_storage',   name_es: 'Consigna de equipaje',   name_en: 'Luggage storage' },
  { category: 'general', code: 'air_conditioning',  name_es: 'Aire acondicionado',     name_en: 'Air conditioning' },
  { category: 'general', code: 'heating',           name_es: 'Calefacción',            name_en: 'Heating' },
  { category: 'general', code: 'laundry',           name_es: 'Lavandería',             name_en: 'Laundry service' },
  { category: 'general', code: 'safe_box',          name_es: 'Caja fuerte',            name_en: 'Safe deposit box' },
  { category: 'general', code: 'non_smoking',       name_es: 'No fumadores',           name_en: 'Non-smoking' },
  { category: 'general', code: 'pets_allowed',      name_es: 'Se admiten mascotas',    name_en: 'Pets allowed' },
  // pool
  { category: 'pool', code: 'pool',                 name_es: 'Piscina',                name_en: 'Swimming pool' },
  { category: 'pool', code: 'pool_heated',          name_es: 'Piscina climatizada',    name_en: 'Heated pool' },
  { category: 'pool', code: 'pool_kids',            name_es: 'Piscina infantil',       name_en: 'Kids pool' },
  { category: 'pool', code: 'pool_infinity',        name_es: 'Piscina infinita',       name_en: 'Infinity pool' },
  // business
  { category: 'business', code: 'meeting_rooms',    name_es: 'Salas de reuniones',     name_en: 'Meeting rooms' },
  { category: 'business', code: 'business_center',  name_es: 'Centro de negocios',     name_en: 'Business center' },
  { category: 'business', code: 'coworking',        name_es: 'Espacio de coworking',   name_en: 'Coworking space' },
  // wellness
  { category: 'wellness', code: 'spa',              name_es: 'Spa',                    name_en: 'Spa' },
  { category: 'wellness', code: 'gym',              name_es: 'Gimnasio',               name_en: 'Fitness center' },
  { category: 'wellness', code: 'sauna',            name_es: 'Sauna',                  name_en: 'Sauna' },
  { category: 'wellness', code: 'massage',          name_es: 'Servicio de masajes',    name_en: 'Massage service' },
  { category: 'wellness', code: 'hot_tub',          name_es: 'Jacuzzi',                name_en: 'Hot tub' },
  // dining
  { category: 'dining', code: 'restaurant',         name_es: 'Restaurante',            name_en: 'Restaurant' },
  { category: 'dining', code: 'bar',                name_es: 'Bar',                    name_en: 'Bar' },
  { category: 'dining', code: 'room_service',       name_es: 'Servicio a la habitación', name_en: 'Room service' },
  { category: 'dining', code: 'breakfast_included', name_es: 'Desayuno incluido',      name_en: 'Breakfast included' },
  { category: 'dining', code: 'minibar',            name_es: 'Minibar',                name_en: 'Minibar' },
  { category: 'dining', code: 'kitchen',            name_es: 'Cocina equipada',        name_en: 'Equipped kitchen' },
  // accessibility
  { category: 'accessibility', code: 'wheelchair_access',    name_es: 'Acceso para silla de ruedas', name_en: 'Wheelchair access' },
  { category: 'accessibility', code: 'elevator_accessible',  name_es: 'Ascensor accesible',           name_en: 'Accessible elevator' },
  { category: 'accessibility', code: 'accessible_bathroom',  name_es: 'Baño adaptado',                name_en: 'Accessible bathroom' },
  // outdoor
  { category: 'outdoor', code: 'garden',            name_es: 'Jardín',                 name_en: 'Garden' },
  { category: 'outdoor', code: 'terrace',           name_es: 'Terraza',                name_en: 'Terrace' },
  { category: 'outdoor', code: 'bbq',               name_es: 'Área de barbacoa',       name_en: 'BBQ area' },
  { category: 'outdoor', code: 'playground',        name_es: 'Zona de juegos infantiles', name_en: 'Playground' },
  { category: 'outdoor', code: 'beach_access',      name_es: 'Acceso a la playa',      name_en: 'Beach access' },
  { category: 'outdoor', code: 'bike_rental',       name_es: 'Alquiler de bicicletas', name_en: 'Bike rental' },
]
