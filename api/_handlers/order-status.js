import Stripe from 'stripe'
import { getOrderBySessionId, markOrderPaid } from '../../lib/ordersDb.js'
import { getStripeSecretKey } from '../_lib/env.js'
import { enforceRateLimit } from '../_lib/rateLimit.js'
import { withPerimeter } from '../_lib/securityHeaders.js'
import { requireMethod, validateSessionId } from '../_lib/validate.js'

/**
 * GET /api/order-status?session_id=cs_...
 * Frontend polls after Stripe redirect until status === 'paid'.
 *
 * Primary path: webhook wrote the paid order + download token.
 * Fallback: if still pending, confirm with Stripe and fulfill idempotently
 * (covers delayed webhooks / local stripe-listen gaps).
 */
async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return
  if (!enforceRateLimit(req, res, 'verify')) return

  const sessionResult = validateSessionId(req.query.session_id)
  if (!sessionResult.ok) {
    return res.status(400).json({ error: sessionResult.error })
  }

  let order = getOrderBySessionId(sessionResult.value)

  if (!order || order.status !== 'paid') {
    const secretKey = getStripeSecretKey()
    if (secretKey) {
      try {
        const stripe = new Stripe(secretKey)
        const session = await stripe.checkout.sessions.retrieve(sessionResult.value)
        const isPaid =
          session.payment_status === 'paid' &&
          session.metadata?.product === 'csv-hospital-pro'

        if (isPaid) {
          order = markOrderPaid(session.id, {
            email: session.customer_details?.email ?? null,
          })
        }
      } catch (error) {
        console.error('order-status Stripe reconcile error:', error.message)
      }
    }
  }

  if (!order) {
    return res.status(200).json({
      status: 'pending',
      sessionId: sessionResult.value,
      downloadUrl: null,
      downloadToken: null,
    })
  }

  return res.status(200).json({
    status: order.status,
    sessionId: order.sessionId,
    downloadUrl: order.downloadUrl,
    downloadToken: order.downloadToken,
    paidAt: order.paidAt,
  })
}

export default withPerimeter(handler)
