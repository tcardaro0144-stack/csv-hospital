import { createHmac, timingSafeEqual } from 'crypto'

export const UNLOCK_COOKIE = 'ch_unlock'
export const UNLOCK_MAX_AGE_SECONDS = 365 * 24 * 60 * 60 // 1 year

function getSecret(explicit) {
  const secret = explicit || process.env.UNLOCK_SECRET
  if (!secret) {
    throw new Error('UNLOCK_SECRET is not set.')
  }
  return secret
}

function sign(body, secret) {
  return createHmac('sha256', getSecret(secret)).update(body).digest('base64url')
}

/**
 * Create a signed unlock token for a paid Checkout Session.
 */
export function createUnlockToken({ sessionId, customerEmail = null, secret }) {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    sid: sessionId,
    email: customerEmail,
    iat: now,
    exp: now + UNLOCK_MAX_AGE_SECONDS,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body, secret)}`
}

/**
 * Verify a signed unlock token. Returns payload or null.
 */
export function verifyUnlockToken(token, secret) {
  if (!token || typeof token !== 'string') return null

  const [body, signature] = token.split('.')
  if (!body || !signature) return null

  let expected
  try {
    expected = sign(body, secret)
  } catch {
    return null
  }

  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload?.sid || !payload?.exp) return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function buildUnlockCookie(token, { secure = false } = {}) {
  const parts = [
    `${UNLOCK_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${UNLOCK_MAX_AGE_SECONDS}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function clearUnlockCookie({ secure = false } = {}) {
  const parts = [
    `${UNLOCK_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function readCookie(cookieHeader, name = UNLOCK_COOKIE) {
  if (!cookieHeader) return null
  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
  if (!match) return null
  return match.slice(name.length + 1)
}

export function isSecureRequest(req) {
  const proto = req.headers?.['x-forwarded-proto']
  if (proto) return String(proto).split(',')[0].trim() === 'https'
  const clientUrl = process.env.CLIENT_URL || ''
  return clientUrl.startsWith('https://')
}
