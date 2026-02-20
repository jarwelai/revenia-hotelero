# 📋 BUSINESS_LOGIC.md - Hotelero

> Motor de Reservas Directas Multi-Tenant para Hoteles Pequeños y Medianos
> Generado por SaaS Factory | Fecha: 2026-02-18 | Última revisión: 2026-02-18
> Cliente piloto: Hotel Maya Jade (Grupo Jarwel)

---

## 1. Problema de Negocio

**Dolor:**
Las pequeñas y medianas hoteleras gestionan sus reservas y disponibilidad de forma fragmentada entre WhatsApp, llamadas telefónicas, OTAs, hojas de Excel y plugins básicos de WordPress. Esto provoca errores en disponibilidad, riesgo de sobreventa, pérdida de reservas directas y un proceso manual lento para cotizar y confirmar. El encargado de reservas debe revisar disponibilidad en distintos sistemas (OTAs, calendario interno, MotoPress o Excel), responder cotizaciones por WhatsApp una por una, calcular precios con impuestos manualmente y confirmar pagos sin automatización real.

**Frecuencia:** Diaria. El problema se "parcha" con Excel, mensajes manuales y seguimiento informal.

**Costo actual:**
- 3–5 horas/día del encargado en tareas manuales (cotizaciones, revisión multi-sistema, cálculo de precios)
- 60–70% de reservas vía OTAs con comisión del 15–20%
- 10–15% de cotizaciones no se convierten por proceso lento
- Riesgo real de sobreventa por falta de sincronización en tiempo real
- **Pérdida mensual estimada: $3,000–$8,000** (comisiones OTA evitables + reservas no convertidas + horas-hombre)

---

## 2. Solución

**Propuesta de valor:**
> "Un motor de reservas directas multi-tenant que centraliza disponibilidad en tiempo real, cotiza automáticamente, cobra, factura y confirma pagos online para hoteles pequeños y medianos."

**Flujo principal — Happy Path:**

### Huésped (Motor web o Agente IA — ambos canales son MVP):
1. Entra al sitio de la propiedad (Modo A: Full Site) o abre el widget embebido (Modo B: Embed)
2. Elige su canal: motor de reservas web tradicional **o** chat conversacional con el Agente IA
3. Selecciona fechas de check-in/check-out, número de huéspedes y tipo de habitación
4. El sistema consulta disponibilidad en tiempo real, valida restricciones y calcula tarifas con impuestos y fees
5. El huésped ingresa sus datos personales y confirma intención de reservar
6. El sistema crea la reserva en estado `pending` y bloquea la habitación por tiempo limitado (TTL: 15 min)
7. El sistema selecciona la pasarela automáticamente según reglas configuradas (Stripe o Recurrente)
8. El huésped completa el pago en la pasarela correspondiente
9. El sistema valida el pago via webhook seguro e idempotente
10. La reserva cambia a estado `confirmed`
11. Se disparan automatizaciones: registro en CRM, email de confirmación

**Resultado:** Reserva confirmada, inventario bloqueado, automatizaciones activas — sin intervención manual.

### Encargado de la Propiedad:
1. Ve reservas entrantes en tiempo real en el dashboard (pending y confirmed)
2. Visualiza calendario de ocupación, disponibilidad y estado de pagos centralizado
3. Gestiona tarifas, restricciones y disponibilidad por fechas
4. Consulta detalles del huésped y estado del pago por pasarela
5. Visualiza que el huésped fue registrado en el CRM y los flujos automáticos fueron activados

**Resultado:** Control total de inventario, ingresos y comunicación desde un solo sistema.

### Canal obligatorio MVP — Agente IA Web (chat mobile-first):
El mismo motor de reservas se expone también como agente conversacional via chat web:
- Usa tool-calling estructurado sobre el **mismo booking-engine** (sin duplicar lógica de negocio)
- Herramientas expuestas al agente en MVP:
  - `availability` — consulta fechas y tipos de habitación disponibles
  - `quote` — cotiza tarifa con impuestos, fees y restricciones aplicadas
  - `create_booking` — crea reserva en estado `pending` y bloquea inventario
  - `create_payment_session` — inicia sesión de pago en Stripe o Recurrente según reglas
  - `check_booking_status` — consulta estado actual de una reserva
- Canal WhatsApp y automatizaciones avanzadas quedan para **v1.1 post-MVP**

---

## 3. Usuario Objetivo

**Rol principal:** Gerente de Operaciones o Encargado de Reservas de la propiedad

**Roles diferenciados:**
| Rol | Responsabilidad |
|-----|-----------------|
| Propietario / Gerente General de la Org | Configuración inicial (propiedades, tarifas, impuestos, restricciones) |
| Encargado de Reservas / Recepcionista | Gestión diaria (dashboard, reservas, pagos) |

> En propiedades de 20–40 habitaciones, generalmente es la misma persona.
> En grupos (como Jarwel), el Propietario gestiona múltiples propiedades desde una sola org.

**Perfil técnico:**
- Maneja Excel con soltura básica/intermedia
- Acostumbrado a WordPress, OTAs y WhatsApp Web
- NO es perfil técnico ni desarrollador
- Prefiere interfaces visuales, calendarios claros y dashboards simples
- Busca simplicidad, claridad y rapidez — no configuraciones complejas

**Segmento de mercado:**
- Hoteles boutique de 20–40 habitaciones
- Grupos hoteleros pequeños (2–5 propiedades por org, como Grupo Jarwel)

---

## 4. Arquitectura de Datos

### Input — Configura el Gerente de la Org/Propiedad:
- Datos generales de la propiedad (nombre, dirección, moneda, zona horaria)
- Políticas: check-in/check-out, mascotas, alimentos, niños, cancelación
- Términos y condiciones, política de privacidad, instrucciones de llegada
- Amenidades (piscina, wifi, parqueo, restaurante, etc.)
- Tipos de habitación: capacidad, descripción, imágenes, inventario
- Tarifas base, planes de tarifa, restricciones (mínimo/máximo noches, stop-sell)
- Impuestos (% o monto fijo, incluidos o no) y fees adicionales
- Reglas de selección de pasarela (Stripe vs Recurrente)
- Configuración de automatizaciones (email de confirmación, recordatorios)
- Modo de entrega: Full Site (Modo A) o Motor Embebible (Modo B)
- Canales OTA con URL iCal para sincronización de disponibilidad

### Input — Ingresa el Huésped:
- Fechas check-in/check-out, adultos y niños
- Selección de habitación
- Datos personales (nombre, email, teléfono)
- Datos de facturación fiscal (cuando aplica, vía Recurrente)
- Aceptación de términos y políticas
- Interacción conversacional con el Agente IA (si usa canal chat)

### Output — Documentos:
- Confirmación de reserva con número único
- Comprobante de pago
- Factura fiscal (vía Recurrente cuando aplica)
- Registro interno de transacción

### Output — Reportes para el Gerente:
- Calendario de ocupación en tiempo real
- Ingresos por período
- Reservas por canal (web directo, agente IA, OTA)
- Estado de pagos (pending, confirmed, failed)
- Tasa de conversión
- % de ocupación
- Ingreso promedio por reserva
- Comparativo reservas directas vs OTA

### Output — Automatizaciones (MVP):
- Email de confirmación al huésped
- Actualización automática de inventario
- Registro en CRM interno
- *(WhatsApp y recordatorios avanzados → v1.1 post-MVP)*

### Integraciones externas:

| Integración | Scope MVP | Notas |
|-------------|-----------|-------|
| **Stripe** | MVP | Pasarela principal (tarjeta internacional) |
| **Recurrente** | MVP | Pasarela con facturación fiscal |
| **iCal Import/Export** | MVP | Un canal iCal por OTA configurada; cron de sincronización periódico; deduplicación básica por UID |
| **WhatsApp Business API** | v1.1 | Post-MVP |
| **Channel Manager bidireccional** | v1.1 | Sistema preparado (property_id + OTA mapping) pero implementación completa en v1.1 |
| **CRM** | MVP (interno) | Registro básico de huéspedes en tabla `crm_contacts` |

---

### Storage — Tablas Supabase (Multi-Tenant: org_id + property_id con RLS)

#### Capa SaaS (Org & Members)

| Tabla | Descripción |
|-------|-------------|
| `orgs` | Organización / grupo hotelero. `id, name, slug, created_at` |
| `org_members` | Miembros de la org y su rol. `org_id, user_id, role (owner/manager/staff), created_at` |
| `properties` | Propiedades (hoteles) de la org. `id, org_id, name, timezone, currency, policies_json, created_at` |

#### Capa de Configuración de Propiedad

| Tabla | Descripción |
|-------|-------------|
| `room_types` | Tipos de habitación por propiedad (`property_id`) |
| `room_images` | Imágenes por tipo de habitación |
| `inventory` | Disponibilidad por fecha y tipo de habitación (`property_id`) |
| `rate_plans` | Planes de tarifa por propiedad |
| `rates` | Tarifa por fecha + tipo de habitación + plan (`property_id`) |
| `restrictions` | Min/max noches, stop-sell, closed to arrival/departure (`property_id`) |
| `taxes` | Configuración de impuestos por propiedad |
| `fees` | Fees adicionales por noche/estancia/huésped (`property_id`) |
| `cancellation_policies` | Políticas de cancelación por propiedad |
| `payment_gateway_configs` | Config Stripe + Recurrente por propiedad |
| `delivery_config` | Modo A (Full Site) o Modo B (Embed) + personalización básica (`property_id`) |
| `ota_channels` | Canales OTA con URL iCal, último sync, dedup log (`property_id`) |
| `automations` | Configuración de automatizaciones por propiedad |

#### Capa Transaccional

| Tabla | Descripción |
|-------|-------------|
| `bookings` | Reservas core. Estados: `pending, confirmed, cancelled`. Incluye `property_id`, `channel (web/agent/ota)` |
| `booking_guests` | Datos personales y fiscales del huésped por reserva |
| `payments` | Registro de pagos con estado y referencia de pasarela (`property_id`) |
| `crm_contacts` | Registro de huéspedes para CRM interno (`property_id`) |

**Nota crítica — RLS:**
- El acceso a datos se controla mediante pertenencia a org (`org_members`).
- Todas las tablas de negocio tienen `property_id`. Las queries siempre filtran por `property_id` y validan que el usuario pertenece a la org dueña de esa propiedad.
- Las tablas `orgs` y `org_members` filtran directamente por `org_id`.
- **Nunca se cruzan datos entre orgs.** Un usuario de Org A jamás puede acceder a datos de Org B, aunque tenga el mismo `user_id`.

---

## 5. KPI de Éxito

**Métrica principal:**
> Una propiedad piloto puede recibir una reserva directa completa — desde selección de fechas hasta pago confirmado — sin intervención manual, con inventario bloqueado correctamente y confirmado automáticamente, en menos de 3 minutos. El mismo resultado debe ser alcanzable tanto desde el motor web como desde el Agente IA chat.

**Flujo mínimo viable (debe funcionar perfecto en ambos canales):**
1. Consulta de disponibilidad en tiempo real
2. Cotización automática con impuestos y fees correctos
3. Creación de reserva en estado `pending`
4. Selección automática de pasarela (Stripe o Recurrente)
5. Confirmación de pago vía webhook (seguro e idempotente)
6. Cambio automático de estado a `confirmed`
7. Bloqueo definitivo del inventario
8. Registro en dashboard en tiempo real

**Canal dual — ambos son MVP:**
| Canal | Scope | Modo de acceso |
|-------|-------|----------------|
| Motor web tradicional | MVP | Full Site (Modo A) y/o widget embebido (Modo B) |
| Agente IA chat web | MVP | Toggle en el mismo sitio/widget. Mobile-first |
| WhatsApp | v1.1 | Post-MVP |

**Métricas a 30 días (Hotel Maya Jade — propiedad piloto):**
- 10+ reservas directas completadas sin intervención manual
- 0 sobreventas
- 100% de pagos correctamente confirmados vía webhook
- Reducción ≥50% en interacción manual por WhatsApp (medido contra baseline)
- Al menos 3 reservas completadas via canal Agente IA web

**Escala inmediata post-MVP:** 3 propiedades del Grupo Jarwel (misma org)

---

## 6. Especificación Técnica (Para el Agente)

### Modos de Entrega (Delivery Modes)

La plataforma soporta dos modos de entrega por propiedad, configurables desde el panel:

#### Modo A — Full Site
- Página pública mobile-first servida por la plataforma Hotelero
- MVP: plantilla simple con secciones configurables (hero, habitaciones, galería, motor de reservas, contacto)
- Editor mínimo tipo "Lovable-lite": cambio de colores, logo, textos, imágenes desde el panel
- El toggle "Reservar en Web / Reservar con Agente" está embebido en esta página

#### Modo B — Embed
- Snippet de JavaScript `<script>` que inyecta el motor de reservas en cualquier sitio externo
- iFrame fallback para compatibilidad con WordPress y CMS sin JS avanzado
- Guía de integración WordPress incluida en documentación
- El toggle "Reservar en Web / Reservar con Agente" está disponible dentro del widget embebido

**Toggle UI (aplica a ambos modos):**
- Botón o tab visible: **"Reservar en Web"** ↔ **"Reservar con Agente"**
- Mobile-first: accesible y funcional en pantallas de 375px en adelante
- El Agente IA abre un chat conversacional superpuesto sin abandonar la página

---

### Features a Implementar — Feature-First

```
src/features/
├── auth/                    # Autenticación Email/Password (Supabase)
│                            # Onboarding: creación de org + primera propiedad
├── org-management/          # Gestión de org, miembros y roles
│                            # Invitaciones, permisos por propiedad
├── property-setup/          # Configuración de la propiedad
│                            # Info general, amenidades, políticas, modo de entrega
├── room-management/         # Tipos de habitación
│                            # Inventario, imágenes, capacidad
├── rate-management/         # Tarifas y restricciones
│                            # Planes, impuestos, fees, restricciones por fecha
├── booking-engine/          # Motor de reservas (CORE)
│                            # Disponibilidad en tiempo real, cotización, bloqueo de inventario
├── payment/                 # Pasarelas de pago
│                            # Stripe + Recurrente, webhooks idempotentes, selección automática
├── reservations/            # Dashboard de reservas
│                            # Calendario, estados, vista por canal
├── ai-agent/                # Agente IA web conversacional (MVP mínimo)
│                            # Chat mobile-first, tool-calling sobre booking-engine
├── delivery/                # Modos de entrega
│                            # Full Site (Modo A) + Widget Embed (Modo B) + toggle UI
├── ota-sync/                # Sincronización OTA vía iCal
│                            # Import/Export, cron job, deduplicación
├── automations/             # Automatizaciones
│                            # Email confirmación, CRM registro (MVP)
│                            # WhatsApp, recordatorios → v1.1
└── reporting/               # Reportes
                             # Ocupación, ingresos, conversión, canal
```

---

### Prioridad de Implementación

**Fase 1 — Fundación SaaS:**
1. Auth + Onboarding (creación de org + primera propiedad)
2. Org management (miembros, roles)
3. Property setup (configuración de la propiedad)
4. Room management (tipos de habitación + inventario)
5. Rate management (tarifas + restricciones + impuestos)

**Fase 2 — Motor Core:**
6. Booking engine (disponibilidad + cotización + bloqueo de inventario)
7. Payment (Stripe + Recurrente + webhooks idempotentes)
8. Reservations dashboard (calendario + estados + vista por canal)

**Fase 3 — Canales de Cara al Huésped (ambos son MVP):**
9. Delivery: Full Site Modo A (plantilla pública + editor mínimo)
10. Delivery: Widget Embed Modo B (snippet JS + iFrame fallback)
11. Toggle UI "Web / Agente" en ambos modos
12. AI Agent web: chat mobile-first con tool-calling sobre booking-engine

**Fase 4 — Integración OTA + Automatizaciones Base:**
13. OTA Sync: iCal Import/Export + cron + deduplicación básica
14. Automations MVP: email de confirmación + registro en CRM

**Post-MVP — v1.1:**
15. WhatsApp Business API (automatizaciones avanzadas)
16. Recordatorios pre-check-in
17. Channel Manager bidireccional completo
18. Reporting avanzado (comparativo directas vs OTA, RevPAR, etc.)

---

### Stack Confirmado

| Capa | Tecnología |
|------|------------|
| **Frontend** | Next.js 16 + React 19 + TypeScript + Tailwind 3.4 + shadcn/ui |
| **Backend** | Supabase (Auth + Database + Storage) |
| **Multi-tenant** | RLS por `org_id` (acceso) + `property_id` (scoping de datos) |
| **AI Engine** | Vercel AI SDK v5 + OpenRouter (Claude para agente IA) |
| **Pagos** | Stripe SDK + Recurrente API |
| **Validación** | Zod (input de huésped + configuración) |
| **Estado** | Zustand (booking flow state + agent chat state) |
| **MCPs** | Next.js DevTools + Playwright + Supabase |
| **Deploy** | Vercel |

---

### Decisiones de Arquitectura Críticas

1. **Multi-tenant org_id + property_id:** Una org puede tener N propiedades. RLS valida `org_members` para acceso; todas las queries de negocio filtran por `property_id`. Nunca cruzan datos entre orgs.

2. **Webhooks idempotentes:** Los eventos de pago de Stripe/Recurrente son idempotentes. Si el mismo webhook llega dos veces, el estado de la reserva no se corrompe (validación por `payment_reference` único).

3. **Inventario por bloqueo temporal (TTL 15 min):** Al crear reserva `pending`, el inventario se bloquea. Si el pago no se completa en 15 min, el bloqueo se libera automáticamente (job o trigger en Supabase).

4. **Tool-calling centralizado en booking-engine:** El Agente IA NO tiene lógica de negocio propia. Llama exactamente las mismas funciones del motor web. Sin duplicación. Si el motor cambia, el agente hereda el cambio automáticamente.

5. **Pasarela por regla configurable:** La selección Stripe/Recurrente es una regla configurada por el gerente en `payment_gateway_configs` (no hardcodeada). Ejemplo de regla: "si el huésped solicita factura fiscal → Recurrente; si no → Stripe".

6. **iCal baseline para OTAs:** MVP expone Import/Export iCal por canal OTA + cron de sync. La sincronización es unidireccional (bloqueo de fechas ya ocupadas). Channel Manager bidireccional completo requiere mapeo de tarifas y cupos por OTA → v1.1.

7. **Modos de entrega independientes:** Full Site y Embed comparten el mismo booking-engine y AI Agent. La diferencia es únicamente el wrapper de presentación. Ambos soportan el toggle Web/Agente.

---

### Próximos Pasos

**Fase 1 — Fundación SaaS:**
1. [ ] Configurar Supabase: crear proyecto, aplicar migraciones con RLS (org_id + property_id)
2. [ ] Feature: auth + onboarding (creación de org + primera propiedad)
3. [ ] Feature: org-management (miembros y roles)
4. [ ] Feature: property-setup (configuración de la propiedad)
5. [ ] Feature: room-management (tipos de habitación + inventario)
6. [ ] Feature: rate-management (tarifas + restricciones + impuestos)

**Fase 2 — Motor Core:**
7. [ ] Feature: booking-engine (disponibilidad + cotización + bloqueo)
8. [ ] Feature: payment (Stripe + Recurrente + webhooks idempotentes)
9. [ ] Feature: reservations dashboard (calendario + estados + canal)

**Fase 3 — Canales Huésped (MVP):**
10. [ ] Feature: delivery Modo A — Full Site (plantilla pública + editor mínimo)
11. [ ] Feature: delivery Modo B — Widget Embed (snippet JS + iFrame)
12. [ ] Toggle UI "Reservar en Web / Reservar con Agente" (mobile-first)
13. [ ] Feature: ai-agent web (chat mobile-first + tool-calling)

**Fase 4 — OTA + Automatizaciones Base:**
14. [ ] Feature: ota-sync (iCal Import/Export + cron + deduplicación)
15. [ ] Feature: automations MVP (email confirmación + registro CRM)

**Testing & Deploy:**
16. [ ] Testing E2E con Playwright (flujo completo de reserva en ambos canales)
17. [ ] Deploy en Vercel
18. [ ] Go-live con Hotel Maya Jade (propiedad piloto de Grupo Jarwel)

**Post-MVP — v1.1:**
19. [ ] WhatsApp Business API + recordatorios avanzados
20. [ ] Channel Manager bidireccional completo
21. [ ] Reporting avanzado (RevPAR, comparativo OTA vs directas)

---

*"Primero entiende el negocio. Después escribe código."*
*Este archivo es el Blueprint maestro. El agente lo ejecuta fase por fase.*
