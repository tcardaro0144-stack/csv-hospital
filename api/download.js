import { getOrderByDownloadToken, isValidDownloadToken } from '../lib/ordersDb.js'
import { enforceRateLimit } from './_lib/rateLimit.js'
import { withPerimeter } from './_lib/securityHeaders.js'
import { requireMethod } from './_lib/validate.js'

const TOKEN_PATTERN = /^[a-f0-9]{32,64}$/i

/**
 * GET /api/download?token=...
 * Authorizes CSV export only when the order is paid and the token matches.
 * CSV bytes stay client-side; this gate must succeed before export.
 */
async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return
  if (!enforceRateLimit(req, res, 'unlockStatus')) return

  const raw =
    req.query?.token ||
    req.query?.downloadToken ||
    (typeof req.url === 'string'
      ? new URL(req.url, 'http://localhost').searchParams.get('token')
      : null)

  const cleanToken = typeof raw === 'string' ? decodeURIComponent(raw).trim() : ''

  if (!cleanToken || !TOKEN_PATTERN.test(cleanToken)) {
    return res.status(400).json({ allowed: false, error: 'Missing or invalid download token.' })
  }

  if (!isValidDownloadToken(cleanToken)) {
    return res.status(402).json({
      allowed: false,
      error: 'Payment required or invalid download token.',
    })
  }

  const order = getOrderByDownloadToken(cleanToken)

  return res.status(200).json({
    allowed: true,
    status: 'paid',
    sessionId: order.sessionId,
    downloadUrl: order.downloadUrl,
  })
}

export default withPerimeter(handler)
