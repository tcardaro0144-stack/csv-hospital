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
function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  return res.status(status).json(body)
}

async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return sendJson(res, 405, { error: 'Method not allowed.' })
    }
    if (!enforceRateLimit(req, res, 'checkout')) return

    const payload = buildFreemiusCheckoutModeResponse()
    const status = payload.status || 200
    const { status: _status, error, ...body } = payload

    if (error) {
      return sendJson(res, status, { ...body, error })
    }
    return sendJson(res, status, body)
  } catch (err) {
    console.error('[freemius-sandbox]', err?.message || err)
    if (res.headersSent) return undefined
    return sendJson(res, 500, {
      mode: 'live',
      isSandbox: false,
      is_sandbox: false,
      sandbox: null,
      error: 'Unable to build Freemius checkout mode.',
    })
  }
}

export default withPerimeter(handler)
