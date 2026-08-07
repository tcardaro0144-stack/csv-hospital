import { assertPaidSession, assertPaidUnlock } from '../../lib/assertPaidUnlock.js'
import { enforceRateLimit } from '../_lib/rateLimit.js'
import { withPerimeter } from '../_lib/securityHeaders.js'
import { requireMethod } from '../_lib/validate.js'

/**
 * POST /api/assert-download
 * Body: { session_id?: string }
 *
 * Must succeed before the client may export the cleaned CSV.
 * Verifies Stripe Checkout Session payment_status === 'paid'.
 */
async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return
  if (!enforceRateLimit(req, res, 'unlockStatus')) return

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const sessionId =
    (typeof body.session_id === 'string' && body.session_id) ||
    (typeof body.sessionId === 'string' && body.sessionId) ||
    null

  let result
  if (sessionId) {
    result = await assertPaidSession(sessionId)
  } else {
    result = await assertPaidUnlock(req)
  }

  if (!result.allowed) {
    const inactive = result.reason === 'stripe_inactive'
    return res.status(inactive ? 200 : 402).json({
      allowed: false,
      error: inactive
        ? 'Stripe unlock inactive — Freemius purchase unlocks download on-device.'
        : 'Payment required before download.',
      reason: result.reason,
      checkout: result.checkout || 'freemius',
    })
  }

  return res.status(200).json({
    allowed: true,
    sessionId: result.sessionId,
    paymentStatus: result.paymentStatus ?? 'paid',
  })
}

export default withPerimeter(handler)
