import {
  buildLocalFreemiusMockSuccessPayload,
  isLocalFreemiusMockRequest,
} from './_lib/freemiusLocalMock.js'
import { enforceRateLimit } from './_lib/rateLimit.js'
import { withPerimeter } from './_lib/securityHeaders.js'
import {
  getFreemiusPlanId,
  getFreemiusProductId,
} from './_lib/env.js'

/**
 * POST /api/freemius-mock-complete
 * Localhost-only: return a Freemius-shaped success payload (test card 4242)
 * so the client can run the same credit-grant / success path without Freemius.
 */
function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  return res.status(status).json(body)
}

async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return sendJson(res, 405, { error: 'Method not allowed.' })
    }
    if (!enforceRateLimit(req, res, 'checkout')) return

    if (!isLocalFreemiusMockRequest(req)) {
      return sendJson(res, 403, {
        error: 'Freemius local mock is only available on localhost.',
        code: 'local_mock_forbidden',
      })
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const testCard = String(body.testCard || body.test_card || '4242')
    if (!testCard.replace(/\s+/g, '').startsWith('4242')) {
      return sendJson(res, 400, {
        error: 'Local mock only accepts test card 4242.',
        code: 'invalid_test_card',
      })
    }

    const payload = buildLocalFreemiusMockSuccessPayload({
      packageId: typeof body.packageId === 'string' ? body.packageId : 'pass-1',
      files: body.files,
      planId: body.planId || getFreemiusPlanId(),
      pricingId: body.pricingId ?? null,
      productId: body.productId || getFreemiusProductId(),
      testCard: '4242',
    })

    return sendJson(res, 200, {
      ok: true,
      mode: 'local_mock',
      is_sandbox: true,
      freemius: payload,
    })
  } catch (err) {
    console.error('[freemius-mock-complete]', err?.message || err)
    if (res.headersSent) return undefined
    return sendJson(res, 500, { error: 'Unable to build local Freemius mock.' })
  }
}

export default withPerimeter(handler)
