-- =============================================================================
-- Sprint 3D: property_payment_providers
--
-- Tabla de configuración de proveedores de pago por propiedad.
-- Soporte multi-tenant: cada property puede tener su propia combinación
-- de proveedores activos, proveedor por defecto y configuración.
-- =============================================================================

-- ─── Tabla principal ──────────────────────────────────────────────────────────

create table if not exists property_payment_providers (
  id           uuid        primary key default gen_random_uuid(),
  property_id  uuid        not null references properties(id) on delete cascade,
  provider     text        not null check (provider in ('stripe', 'recurrente')),
  is_enabled   boolean     not null default true,
  is_default   boolean     not null default false,
  config_json  jsonb       not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Solo un registro por combinación property + provider
  constraint property_payment_providers_unique unique (property_id, provider)
);

-- ─── Índice parcial: solo un provider default por property ────────────────────

create unique index property_payment_providers_one_default_idx
  on property_payment_providers (property_id)
  where is_default = true;

-- ─── Índice de performance para queries por property ─────────────────────────

create index property_payment_providers_property_idx
  on property_payment_providers (property_id);

-- ─── Trigger updated_at ───────────────────────────────────────────────────────

create or replace function update_property_payment_providers_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_property_payment_providers_updated_at
  before update on property_payment_providers
  for each row execute function update_property_payment_providers_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table property_payment_providers enable row level security;

-- Admins y managers de la org pueden gestionar los proveedores de sus propiedades
create policy "Org admins can manage property payment providers"
  on property_payment_providers
  for all
  to authenticated
  using (
    property_id in (
      select p.id
      from properties p
      inner join org_members om on om.org_id = p.org_id
      where om.user_id = auth.uid()
        and om.role in ('owner', 'manager')
    )
  )
  with check (
    property_id in (
      select p.id
      from properties p
      inner join org_members om on om.org_id = p.org_id
      where om.user_id = auth.uid()
        and om.role in ('owner', 'manager')
    )
  );

-- El service role tiene acceso completo (bypass RLS implícito con service key)
-- No se necesita policy adicional para service role.
