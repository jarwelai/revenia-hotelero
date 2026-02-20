'use client'

import { Input } from '@/components/ui/input'

function slugPreview(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

interface StepCreateOrgProps {
  orgName: string
  onChange: (value: string) => void
}

export function StepCreateOrg({ orgName, onChange }: StepCreateOrgProps) {
  const slug = slugPreview(orgName)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-heading font-semibold text-foreground">
          Crea tu organización
        </h2>
        <p className="text-sm text-foreground-secondary mt-1">
          Una organización agrupa uno o más hoteles bajo un mismo grupo operador.
        </p>
      </div>

      <Input
        label="Nombre de la empresa u organización"
        placeholder="Ej: Grupo Jarwel, Hotel Maya Jade"
        value={orgName}
        onChange={(e) => onChange(e.target.value)}
        autoFocus
        required
      />

      {slug && (
        <div className="bg-surface border border-border rounded-xl px-4 py-3">
          <p className="text-xs text-foreground-secondary">Tu identificador único:</p>
          <p className="text-sm font-mono text-foreground mt-0.5">
            <span className="text-foreground-secondary">hotelero/</span>
            {slug}-<span className="text-foreground-secondary">xxxx</span>
          </p>
        </div>
      )}
    </div>
  )
}
