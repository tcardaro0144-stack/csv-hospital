import Stripe from 'stripe'
import { markOrderPaid } from '../lib/ordersDb.js'
import {
  buildUnlockCookie,
  createUnlockToken,
  isSecureRequest,
} from '../lib/unlockToken.js'
import { getStripeSecretKey, getUnlockSecret } from './_lib/env.js'
import { enforceRateLimit } from './_lib/rateLimit.js'
import { withPerimeter } from './_lib/securityHeaders.js'
import { requireMethod, validateSessionId } from './_lib/validate.js'

/**
 * GET /api/verify-session?session_id=cs_...
 * Legacy / secondary path. Prefer webhook + /api/order-status polling.
 * Still marks the order paid when Stripe confirms (idempotent with webhook).
 */
async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return
  if (!enforceRateLimit(req, res, 'verify')) return

  const sessionResult = validateSessionId(req.query.session_id)
  if (!sessionResult.ok) {
    return res.status(400).json({ error: sessionResult.error })
  }

  const secretKey = getStripeSecretKey()
  const unlockSecret = getUnlockSecret()

  if (!secretKey) {
    return res.status(500).json({ error: 'Payment service is not configured.' })
  }

  if (!unlockSecret) {
    return res.status(500).json({ error: 'Unlock service is not configured.' })
  }

  const stripe = new Stripe(secretKey)

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionResult.value)

    const isPaid =
      session.payment_status === 'paid' &&
      session.metadata?.product === 'csv-hospital-pro'

    if (!isPaid) {
      return res.status(402).json({ pro: false, error: 'Payment not completed.' })
    }

    const order = markOrderPaid(session.id, {
      email: session.customer_details?.email ?? null,
    })

    const customerEmail = session.customer_details?.email ?? null
    const token = createUnlockToken({
      sessionId: session.id,
      customerEmail,
      secret: unlockSecret,
    })

    res.setHeader(
      'Set-Cookie',
      buildUnlockCookie(token, { secure: isSecureRequest(req) }),
    )

    return res.status(200).json({
      pro: true,
      sessionId: session.id,
      customerEmail,
      downloadUrl: order?.downloadUrl ?? null,
      downloadToken: order?.downloadToken ?? null,
      status: 'paid',
    })
  } catch (error) {
    console.error('Verify session error:', error.message)
    return res.status(400).json({ error: 'Invalid or expired session.' })
  }
}

export default withPerimeter(handler)
