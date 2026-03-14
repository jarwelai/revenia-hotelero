import { redirect } from 'next/navigation'

export const metadata = { title: 'Configuración | Revenia' }

export default function SettingsPage() {
  redirect('/dashboard/setup')
}
