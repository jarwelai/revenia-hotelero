export { getResend, EMAIL_CONFIG } from './resend'

import { getResend, EMAIL_CONFIG } from './resend'
import {
  buildBookingConfirmationHtml,
  type BookingConfirmationData,
} from './templates/booking-confirmation'

export type { BookingConfirmationData }

export async function sendBookingConfirmation(
  to: string,
  data: BookingConfirmationData,
): Promise<void> {
  const resend = getResend()
  const subject = data.lang === 'en'
    ? `Booking Confirmed — ${data.propertyName}`
    : `Reserva Confirmada — ${data.propertyName}`

  await resend.emails.send({
    from: EMAIL_CONFIG.from,
    to,
    subject,
    html: buildBookingConfirmationHtml(data),
  })
}
