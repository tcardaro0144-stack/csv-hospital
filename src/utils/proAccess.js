import { apiUrl } from './apiBase.js'

const PAID_SESSION_KEY = 'csv-hospital-paid-session'

export function storePaidSessionId(sessionId) {
  if (typeof sessionId === 'string' && sessionId.startsWith('cs_')) {
    sessionStorage.setItem(PAID_SESSION_KEY, sessionId)
    localStorage.setItem(
      'csv-hospital-pro',
      JSON.stringify({
        unlocked: true,
        status: 'paid',
        sessionId,
        verifiedAt: new Date().toISOString(),
      }),
    )
  }
}

export function getPaidSessionId() {
  const fromSession = sessionStorage.getItem(PAID_SESSION_KEY)
  if (fromSession) return fromSession
  try {
    const raw = localStorage.getItem('csv-hospital-pro')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return typeof parsed?.sessionId === 'string' ? parsed.sessionId : null
  } catch {
    return null
  }
}

export function clearProStatus() {
  localStorage.removeItem('csv-hospital-pro')
  localStorage.removeItem('csv-hospital-session-id')
  localStorage.removeItem('csv-hospital-freemius-purchase')
  sessionStorage.removeItem(PAID_SESSION_KEY)
}

/**
 * Create a Checkout Session (ui_mode: elements) and return client_secret.
 */
export async function createPaymentIntent() {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : null

  const url = apiUrl('/api/create-payment-intent')
  if (import.meta.env.DEV) {
    console.info('[checkout] POST', url)
  }

  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ origin }),
    })
  } catch {
    throw new Error(
      `Unable to reach the payment server at ${url || '/api/create-payment-intent'}. Start the API with npm run dev (Express on :4242).`,
    )
  }

  const rawText = await response.text()
  let data
  try {
    data = rawText ? JSON.parse(rawText) : {}
  } catch {
    throw new Error(
      `Payment server returned an invalid response (${response.status}) from ${url}. ${rawText.slice(0, 160)}`,
    )
  }

  if (response.status === 404) {
    throw new Error(
      `404 from ${url}. Restart the API (npm run dev) so /api/create-payment-intent is loaded.`,
    )
  }

  if (!response.ok) {
    const detail = [data.error, data.stripeCode, data.stripeParam]
      .filter(Boolean)
      .join(' — ')
    throw new Error(detail || 'Unable to start payment.')
  }

  const clientSecret = data.clientSecret || data.client_secret
  if (!clientSecret || typeof clientSecret !== 'string') {
    throw new Error('Checkout Session did not return a client_secret.')
  }

  return {
    ...data,
    clientSecret,
    sessionId: data.sessionId,
  }
}

/**
 * Confirm Checkout Session is paid after Elements checkout.
 */
export async function confirmCheckoutSession(sessionId) {
  if (!sessionId) return false

  const response = await fetch(
    apiUrl(`/api/confirm-payment?session_id=${encodeURIComponent(sessionId)}`),
    { credentials: 'include', headers: { Accept: 'application/json' } },
  )
  const data = await response.json().catch(() => ({}))
  return Boolean(response.ok && data.paid)
}

/**
 * Server must approve download — verifies Stripe payment_status === 'paid'.
 * Never trust client-only flags.
 */
export async function assertDownloadAllowed(sessionId = getPaidSessionId()) {
  if (!sessionId) {
    return false
  }

  const response = await fetch(apiUrl('/api/assert-download'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ session_id: sessionId }),
  })

  const data = await response.json().catch(() => ({}))
  return Boolean(response.ok && data.allowed === true)
}
