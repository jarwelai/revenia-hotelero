# Jarwel OS — Estrategia de Ecosistema

> Este documento es **canonico**. Define la vision estrategica que guia todas las decisiones
> de arquitectura, producto y prioridades del ecosistema Jarwel.

---

## Principio Fundacional

Jarwel OS no nace para conquistar el mundo rapidamente.

Nace para:

1. **Resolver los sistemas internos del Grupo Jarwel.**
2. **Convertirse en la infraestructura real de nuestras empresas.**
3. **Construir reputacion basada en resultados.**
4. **Escalar hacia SaaS para PYMES.**
5. **Ofrecer licencia de codigo solo en casos estrategicos.**

---

## Fases de Evolucion

### Fase 1 — Infraestructura Interna

Jarwel OS se desarrolla primero para las verticales del Grupo Jarwel:

| Vertical | Producto | Estado |
|----------|----------|--------|
| **Hoteles** | Revenia (este repo) | MVP en desarrollo |
| Retail | Por definir | Futuro |
| E-commerce | Por definir | Futuro |
| Servicios | Por definir | Futuro |
| Holdings multiempresa | Por definir | Futuro |

Si el sistema funciona en nuestras empresas, tenemos **validacion real**.

### Fase 2 — SaaS para PYMES

Con el sistema probado internamente, se empaqueta como SaaS accesible para:

- Empresarios pequenos y medianos
- Negocios que quieren claridad operativa
- Empresas que no quieren complicaciones tecnicas

**Este es el verdadero enfoque de escala.**

### Fase 3 — Licencia Empresarial (Excepcional)

Solo si un cliente estrategico solicita control total del codigo:

- Se vende licencia premium
- Se entrega codigo
- Se mantiene propiedad intelectual
- No se abre el ecosistema publicamente

Es un servicio enterprise. No es el modelo base.

---

## Por Que Ecosistema Cerrado

- La marca es mas importante que el codigo
- La reputacion es mas importante que la velocidad
- La ejecucion es mas importante que el hype
- La calidad es mas importante que el crecimiento acelerado

**No queremos el efecto Odoo.** No queremos implementaciones mediocres. No queremos fragmentacion.

---

## Ventaja Competitiva Real

La ventaja competitiva de Jarwel OS no sera el codigo. Sera:

- Experiencia real operando negocios propios
- Verticales vivas con metricas reales
- Casos de exito comprobables con impacto financiero
- Inteligencia integrada (AI nativa, no bolted-on)
- Marketing OS conectado al ERP real

**Eso es extremadamente dificil de replicar.**

---

## Revenia: Primera Vertical (Hoteles)

Revenia es el **MVP de la vertical hotelera** de Jarwel OS. Todo lo que se construya aqui debe
considerar que eventualmente:

1. Habra otras verticales usando la misma infraestructura core
2. El "property" de hoteles se generalizara a "business unit" o "location" para otras verticales
3. La capa de org/auth/billing es vertical-agnostica y sera reutilizada

### Lo que es especifico de hoteles (vertical):
- Room types, rooms, availability
- Rate plans, ARI grid, BAR rates
- Booking engine (check-in/out, occupancy, quotes)
- iCal sync con OTAs
- Payment routing por pais (Stripe/Recurrente)

### Lo que es infraestructura core (reutilizable):
- Auth, org management, roles (owner/manager/staff)
- Multi-tenant RLS (org_id + entity_id)
- Payment gateway abstraction
- AI engine (Vercel AI SDK + OpenRouter)
- i18n infrastructure
- Public content management
- Reviews/ratings system
- Reporting framework
- Delivery modes (Full Site / Embed)

---

## Restricciones Arquitectonicas No Negociables

Estas restricciones aplican a **todo** lo que se construya en este ecosistema:

### 1. Multi-idioma desde el dia 1

- Toda UI text debe ser externalizable, nunca hardcodeada en componentes
- MVP: Espanol + Ingles
- Infraestructura lista para agregar idiomas sin refactor
- Aplica tanto a la interfaz del dashboard como a las paginas publicas
- Los contenidos de hotel (descripciones, politicas) ya tienen sistema bilingue via `public_content_translations`

### 2. Mobile-First como prioridad de diseno

- Todo componente se disena primero para 375px y luego se adapta a desktop
- El flujo de reserva del huesped es primariamente movil
- El dashboard del hotelero debe ser funcional en tablet (768px) como minimo
- El AI Agent es mobile-first por naturaleza (chat)

### 3. Integracion futura con booking engine propio

- El booking engine actual (disponibilidad, quotes, pagos) debe tener interfaces limpias
- Las funciones core del booking engine deben ser invocables como API, no acopladas a la UI
- Eventualmente se podra conectar un booking engine externo o propio que reemplace o complemente el actual
- Server actions y service layer deben tener contratos claros (input/output tipados con Zod)

### 4. Separacion vertical vs core

- Antes de implementar cualquier feature, preguntarse: "esto es especifico de hoteles o es infraestructura?"
- Lo que es core va en `shared/` o en features genericas
- Lo que es vertical va en features con nombre de dominio hotelero
- Esto facilita extraer el core cuando se construya la segunda vertical

---

## Modelo Mental: Estabilizar > Reputacion > Producto Fuerte > Escala Organica

Esto es pensamiento de holding. No de startup desesperada.

Muchos fundadores quieren escalar antes de estabilizar.
Jarwel elige: **estabilizar primero, escalar despues.**

---

*Este documento es la brujula estrategica. Todas las decisiones tecnicas deben alinearse con esta vision.*
