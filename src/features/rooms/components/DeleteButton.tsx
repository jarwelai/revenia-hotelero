'use client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFormAction = (formData: FormData) => any

interface DeleteButtonProps {
  action: AnyFormAction
  id: string
  label?: string
  confirmMessage?: string
}

export function DeleteButton({
  action,
  id,
  label = 'Eliminar',
  confirmMessage = '¿Confirmar eliminación?',
}: DeleteButtonProps) {
  // Cast to the form action type expected by React
  const formAction = action as (formData: FormData) => void | Promise<void>
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        onClick={(e) => {
          if (!window.confirm(confirmMessage)) {
            e.preventDefault()
          }
        }}
        className="text-sm font-medium text-error-600 hover:text-error-700 transition-colors"
      >
        {label}
      </button>
    </form>
  )
}
