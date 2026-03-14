/**
 * AI-powered hotel review response generator.
 * Uses OpenRouter (same pattern as public-ai.ts callOpenRouter helper).
 *
 * Env vars required:
 *   OPENROUTER_API_KEY
 *   OPENROUTER_MODEL  (optional, defaults to 'openai/gpt-4o-mini')
 */

// ─── OpenRouter helper (local copy — mirrors public-ai.ts pattern) ─────────

interface OpenRouterMessage {
  role: string
  content: string
}

interface OpenRouterResponse {
  choices: { message: { content: string } }[]
}

async function callOpenRouter(messages: OpenRouterMessage[]): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  const model = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini'

  if (!apiKey) throw new Error('OPENROUTER_API_KEY no configurada')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`OpenRouter ${res.status}: ${body}`)
  }

  const data = await res.json() as OpenRouterResponse
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

// ─── generateReviewResponse ───────────────────────────────────────────────────

interface GenerateReviewResponseParams {
  reviewerName: string | null
  rating: number
  comment: string | null
  propertyName: string
  lang: string
}

/**
 * Generates a professional hotel review response using AI.
 *
 * - Tone: grateful for positive reviews, empathetic for negative. Never defensive.
 * - Length: max 3-4 sentences.
 * - Language: Spanish if lang starts with 'es', English otherwise.
 *
 * Returns { text } on success, { error } on failure.
 * The caller (saveReviewReply) is responsible for persisting the result.
 */
export async function generateReviewResponse(
  params: GenerateReviewResponseParams,
): Promise<{ text?: string; error?: string }> {
  const { reviewerName, rating, comment, propertyName, lang } = params

  const isSpanish = lang.startsWith('es')

  const reviewerDisplay = reviewerName ?? (isSpanish ? 'el huésped' : 'the guest')
  const ratingLabel = isSpanish
    ? `${rating} de 5 estrellas`
    : `${rating} out of 5 stars`

  const systemPrompt = isSpanish
    ? `Eres un experto en respuestas a reseñas hoteleras para ${propertyName}. Tu tono es agradecido para reseñas positivas y empático para negativas. Nunca eres defensivo. Responde SOLO con el texto de la respuesta, sin comillas, sin explicaciones adicionales. Máximo 3-4 oraciones.`
    : `You are a professional hotel review response expert for ${propertyName}. Your tone is grateful for positive reviews and empathetic for negative ones. Never be defensive. Respond ONLY with the reply text, no quotes, no extra explanations. Maximum 3-4 sentences.`

  const commentSection = comment
    ? (isSpanish ? `Comentario: "${comment}"` : `Comment: "${comment}"`)
    : (isSpanish ? '(Sin comentario escrito)' : '(No written comment)')

  const userPrompt = isSpanish
    ? `Escribe una respuesta a la reseña de ${reviewerDisplay} con valoración ${ratingLabel}. ${commentSection}`
    : `Write a reply to the review from ${reviewerDisplay} with a rating of ${ratingLabel}. ${commentSection}`

  let generatedText: string
  try {
    generatedText = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al contactar la IA' }
  }

  if (!generatedText) {
    return { error: isSpanish ? 'La IA no generó ningún texto' : 'AI did not generate any text' }
  }

  return { text: generatedText }
}
