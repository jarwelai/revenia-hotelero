/**
 * Template HTML para email de confirmación de reserva.
 * Bilingüe (es/en). Inline styles (email-safe).
 */

export interface BookingConfirmationData {
  guestName: string
  propertyName: string
  checkIn: string      // YYYY-MM-DD
  checkOut: string     // YYYY-MM-DD
  nights: number
  adults: number
  totalAmount: number
  currency: string
  bookingRef: string   // booking ID (first 8 chars for display)
  lang: 'es' | 'en'
}

export function buildBookingConfirmationHtml(data: BookingConfirmationData): string {
  const { lang } = data
  const t = lang === 'en' ? en : es

  // Format dates
  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00Z').toLocaleDateString(
      lang === 'en' ? 'en-US' : 'es-ES',
      { year: 'numeric', month: 'long', day: 'numeric' }
    )

  // Format currency
  const fmtMoney = (val: number) =>
    new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-ES', {
      style: 'currency',
      currency: data.currency,
    }).format(val)

  const shortRef = data.bookingRef.slice(0, 8).toUpperCase()

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background-color:#0d9488;padding:24px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;">${t.title}</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;color:#333;">
              ${t.greeting.replace('{name}', data.guestName)}
            </p>
            <p style="margin:0 0 24px;font-size:14px;color:#666;">
              ${t.intro.replace('{property}', data.propertyName)}
            </p>

            <!-- Booking Details -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdfa;border-radius:8px;padding:20px;margin-bottom:24px;">
              <tr><td style="padding:20px;">
                <p style="margin:0 0 4px;font-size:12px;color:#666;text-transform:uppercase;">${t.refLabel}</p>
                <p style="margin:0 0 16px;font-size:18px;font-weight:bold;color:#0d9488;">${shortRef}</p>

                <table width="100%" cellpadding="4" cellspacing="0">
                  <tr>
                    <td style="font-size:14px;color:#666;">${t.checkIn}</td>
                    <td style="font-size:14px;color:#333;font-weight:bold;text-align:right;">${fmtDate(data.checkIn)}</td>
                  </tr>
                  <tr>
                    <td style="font-size:14px;color:#666;">${t.checkOut}</td>
                    <td style="font-size:14px;color:#333;font-weight:bold;text-align:right;">${fmtDate(data.checkOut)}</td>
                  </tr>
                  <tr>
                    <td style="font-size:14px;color:#666;">${t.nights}</td>
                    <td style="font-size:14px;color:#333;font-weight:bold;text-align:right;">${data.nights}</td>
                  </tr>
                  <tr>
                    <td style="font-size:14px;color:#666;">${t.adults}</td>
                    <td style="font-size:14px;color:#333;font-weight:bold;text-align:right;">${data.adults}</td>
                  </tr>
                  <tr>
                    <td colspan="2" style="border-top:1px solid #d1d5db;padding-top:12px;"></td>
                  </tr>
                  <tr>
                    <td style="font-size:16px;color:#333;font-weight:bold;">Total</td>
                    <td style="font-size:16px;color:#0d9488;font-weight:bold;text-align:right;">${fmtMoney(data.totalAmount)}</td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <p style="margin:0;font-size:14px;color:#666;">${t.footer}</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#999;text-align:center;">
              ${t.powered}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// Translation dictionaries
const es = {
  title: 'Reserva Confirmada',
  greeting: 'Hola {name},',
  intro: 'Tu reserva en {property} ha sido confirmada exitosamente.',
  refLabel: 'Referencia de reserva',
  checkIn: 'Entrada',
  checkOut: 'Salida',
  nights: 'Noches',
  adults: 'Adultos',
  footer: 'Si tienes alguna pregunta, no dudes en contactarnos.',
  powered: 'Powered by Revenia',
}

const en = {
  title: 'Booking Confirmed',
  greeting: 'Hello {name},',
  intro: 'Your booking at {property} has been successfully confirmed.',
  refLabel: 'Booking reference',
  checkIn: 'Check-in',
  checkOut: 'Check-out',
  nights: 'Nights',
  adults: 'Adults',
  footer: 'If you have any questions, feel free to contact us.',
  powered: 'Powered by Revenia',
}
