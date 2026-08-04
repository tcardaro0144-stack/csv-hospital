import {
  buildFreemiusCheckoutModeResponse,
} from './_lib/freemiusSandbox.js'
import { enforceRateLimit } from './_lib/rateLimit.js'
import { withPerimeter } from './_lib/securityHeaders.js'

/**
 * GET /api/freemius-sandbox
 * Live: { mode: 'live', sandbox: null, isSandbox: false } — real charges.
 * Sandbox: { mode: 'sandbox', sandbox: { token, ctx }, isSandbox: true } — test overlay.
 */
async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed.' })
  }
  if (!enforceRateLimit(req, res, 'checkout')) return

  const payload = buildFreemiusCheckoutModeResponse()
  const status = payload.status || 200
  const { status: _status, error, ...body } = payload

  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (error) {
    return res.status(status).json({ ...body, error })
  }
  return res.status(status).json(body)
}

export default withPerimeter(handler)
