import Stripe from 'stripe'
import { getStripeSecretKey } from './_lib/env.js'
import { enforceRateLimit } from './_lib/rateLimit.js'
import { withPerimeter } from './_lib/securityHeaders.js'
import { requireMethod, validateSessionId } from './_lib/validate.js'

/**
 * GET /api/confirm-payment?session_id=cs_...
 * Confirms Checkout Session payment_status after Elements checkout.
 */
async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return
  if (!enforceRateLimit(req, res, 'verify')) return

  const sessionResult = validateSessionId(
    req.query.session_id || req.query.checkout_session_id,
  )
  if (!sessionResult.ok) {
    return res.status(400).json({ paid: false, error: sessionResult.error })
  }

  const secretKey = getStripeSecretKey()
  if (!secretKey) {
    return res.status(500).json({
      paid: false,
      error: 'Payment service is not configured.',
    })
  }

  try {
    const stripe = new Stripe(secretKey, { apiVersion: '2026-06-24.dahlia' })
    const session = await stripe.checkout.sessions.retrieve(sessionResult.value)

    const paid =
      session.payment_status === 'paid' &&
      (!session.metadata?.product ||
        session.metadata.product === 'csv-hospital-pro')

    return res.status(200).json({
      paid,
      status: session.status,
      payment_status: session.payment_status,
      sessionId: session.id,
    })
  } catch (error) {
    console.error('confirm-payment Stripe error:', {
      type: error?.type,
      code: error?.code,
      message: error?.message,
      raw: error?.raw,
    })
    return res.status(400).json({ paid: false, error: 'Unable to verify payment.' })
  }
}

export default withPerimeter(handler)
