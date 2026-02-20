'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createOrgAndProperty } from '@/actions/onboarding'
import { StepCreateOrg } from './StepCreateOrg'
import { StepCreateProperty } from './StepCreateProperty'

const TOTAL_STEPS = 2

export function OrgOnboardingWizard() {
  const [step, setStep] = useState(1)
  const [orgName, setOrgName] = useState('')
  const [propertyName, setPropertyName] = useState('')
  const [timezone, setTimezone] = useState('America/Guatemala')
  const [currency, setCurrency] = useState('USD')
  const [error, setError] = useState('')
  const [isPending, setIsPending] = useState(false)

  function handleNext() {
    if (step === 1 && !orgName.trim()) {
      setError('El nombre de la organización es requerido')
      return
    }
    setError('')
    setStep(2)
  }

  async function handleSubmit() {
    if (!propertyName.trim()) {
      setError('El nombre del hotel es requerido')
      return
    }
    setError('')
    setIsPending(true)

    const formData = new FormData()
    formData.set('org_name', orgName)
    formData.set('property_name', propertyName)
    formData.set('timezone', timezone)
    formData.set('currency', currency)

    const result = await createOrgAndProperty(formData)
    if (result?.error) {
      setError(result.error)
      setIsPending(false)
    }
    // Si no hay error, el server action redirige a /dashboard
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-foreground-secondary">
            Paso {step} de {TOTAL_STEPS}
          </span>
          <span className="text-sm font-medium text-foreground">
            {step === 1 ? 'Organización' : 'Hotel'}
          </span>
        </div>
        <div className="h-2 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-500 rounded-full transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      <Card variant="elevated" padding="lg">
        <CardContent>
          {step === 1 && (
            <StepCreateOrg
              orgName={orgName}
              onChange={setOrgName}
            />
          )}

          {step === 2 && (
            <StepCreateProperty
              propertyName={propertyName}
              timezone={timezone}
              currency={currency}
              onNameChange={setPropertyName}
              onTimezoneChange={setTimezone}
              onCurrencyChange={setCurrency}
            />
          )}

          {error && (
            <p className="mt-4 text-sm text-error-500 bg-error-500/10 px-4 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={() => { setError(''); setStep(step - 1) }}
                disabled={isPending}
              >
                Atrás
              </Button>
            )}

            {step < TOTAL_STEPS ? (
              <Button
                variant="primary"
                onClick={handleNext}
                className="flex-1"
              >
                Continuar
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleSubmit}
                isLoading={isPending}
                className="flex-1"
              >
                Crear y entrar al panel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
