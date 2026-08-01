import { assertPaidUnlock } from '../lib/assertPaidUnlock.js'
import { enforceRateLimit } from './_lib/rateLimit.js'
import { withPerimeter } from './_lib/securityHeaders.js'
import { requireMethod } from './_lib/validate.js'

/**
 * GET /api/unlock-status
 * Live-checks Stripe that the unlock cookie's session is paid.
 */
async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return
  if (!enforceRateLimit(req, res, 'unlockStatus')) return

  const result = await assertPaidUnlock(req)

  if (!result.allowed) {
    return res.status(200).json({ unlocked: false, reason: result.reason })
  }

  return res.status(200).json({
    unlocked: true,
    sessionId: result.sessionId,
    customerEmail: result.customerEmail,
  })
}

export default withPerimeter(handler)
