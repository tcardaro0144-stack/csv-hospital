import { assertPaidUnlock } from '../../lib/assertPaidUnlock.js'
import { getStripeMode, isStripeConfigured } from '../_lib/env.js'
import { enforceRateLimit } from '../_lib/rateLimit.js'
import { withPerimeter } from '../_lib/securityHeaders.js'
import { requireMethod } from '../_lib/validate.js'

/**
 * GET /api/unlock-status
 * Live-checks Stripe unlock cookie when Stripe is configured.
 * Freemius is primary — missing Stripe env is a soft inactive state, not a 500.
 */
async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return
  if (!enforceRateLimit(req, res, 'unlockStatus')) return

  if (!isStripeConfigured()) {
    return res.status(200).json({
      unlocked: false,
      reason: 'stripe_inactive',
      checkout: 'freemius',
      stripeMode: null,
    })
  }

  const result = await assertPaidUnlock(req)

  if (!result.allowed) {
    return res.status(200).json({
      unlocked: false,
      reason: result.reason,
      checkout: result.checkout || 'freemius',
      stripeMode: getStripeMode(),
    })
  }

  return res.status(200).json({
    unlocked: true,
    sessionId: result.sessionId,
    customerEmail: result.customerEmail,
    stripeMode: getStripeMode(),
  })
}

export default withPerimeter(handler)
