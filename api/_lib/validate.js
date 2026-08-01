/**
 * Input validation for Access-layer API endpoints.
 * Allowlist-style checks — reject anything unexpected early.
 */

const STRIPE_SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/
const PRICE_ID_PATTERN = /^price_[A-Za-z0-9]+$/
const SAFE_URL = /^https?:\/\/[^\s]+$/i

export const MAX_SUPPORT_MESSAGE_CHARS = 4_000

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

/**
 * @param {unknown} value
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function validateSessionId(value) {
  if (value == null || value === '') {
    return { ok: false, error: 'Missing session_id.' }
  }

  if (typeof value !== 'string') {
    return { ok: false, error: 'Invalid session_id.' }
  }

  const sessionId = value.trim()

  if (sessionId.length < 10 || sessionId.length > 256) {
    return { ok: false, error: 'Invalid session_id.' }
  }

  if (!STRIPE_SESSION_ID.test(sessionId)) {
    return { ok: false, error: 'Invalid session_id format.' }
  }

  return { ok: true, value: sessionId }
}

/**
 * @param {unknown} value
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function validatePriceId(value) {
  if (typeof value !== 'string' || !PRICE_ID_PATTERN.test(value.trim())) {
    return { ok: false, error: 'Invalid Stripe price ID configuration.' }
  }
  return { ok: true, value: value.trim() }
}

/**
 * @param {unknown} value
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function validateClientUrl(value) {
  if (typeof value !== 'string' || !SAFE_URL.test(value.trim())) {
    return { ok: false, error: 'Invalid CLIENT_URL configuration.' }
  }

  try {
    const url = new URL(value.trim())
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { ok: false, error: 'Invalid CLIENT_URL configuration.' }
    }
    if (url.username || url.password) {
      return { ok: false, error: 'Invalid CLIENT_URL configuration.' }
    }
    return { ok: true, value: url.origin }
  } catch {
    return { ok: false, error: 'Invalid CLIENT_URL configuration.' }
  }
}

/**
 * Validate a customer support message for triage.
 * @param {unknown} value
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function validateSupportMessage(value) {
  if (value == null || value === '') {
    return { ok: false, error: 'Missing message.' }
  }

  if (typeof value !== 'string') {
    return { ok: false, error: 'Invalid message.' }
  }

  let message = value.replace(CONTROL_CHARS, '').trim()

  if (!message) {
    return { ok: false, error: 'Message is empty.' }
  }

  if (message.length > MAX_SUPPORT_MESSAGE_CHARS) {
    return {
      ok: false,
      error: `Message is too long. Maximum is ${MAX_SUPPORT_MESSAGE_CHARS} characters.`,
    }
  }

  let suspicious = 0
  const sample = message.slice(0, Math.min(message.length, 2000))
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i)
    if (code === 0xfffd) suspicious += 1
  }
  if (sample.length > 0 && suspicious / sample.length > 0.02) {
    return { ok: false, error: 'Message contains invalid characters.' }
  }

  return { ok: true, value: message }
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {string} method
 */
export function requireMethod(req, res, method) {
  if (req.method !== method) {
    res.setHeader('Allow', method)
    res.status(405).json({ error: 'Method not allowed.' })
    return false
  }
  return true
}
