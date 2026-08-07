import Stripe from 'stripe'
import {
  buildUnlockCookie,
  createUnlockToken,
  isSecureRequest,
} from '../../lib/unlockToken.js'
import { getStripeSecretKey, getUnlockSecret } from '../_lib/env.js'
import { enforceRateLimit } from '../_lib/rateLimit.js'
import { withPerimeter } from '../_lib/securityHeaders.js'
import { requireMethod, validateSessionId } from '../_lib/validate.js'

/**
 * GET /api/check-payment-status?session_id=cs_xxx
 *
 * Verifies payment by querying Stripe directly — no database required.
 * Returns { status: 'paid' | 'pending' | 'unpaid', sessionId }.
 * When paid, also sets an unlock cookie for subsequent download checks.
 */
async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return
  if (!enforceRateLimit(req, res, 'verify')) return

  const rawId = req.query.session_id ?? req.query.checkout_session_id
  const sessionResult = validateSessionId(rawId)
  if (!sessionResult.ok) {
    return res.status(400).json({
      status: 'unpaid',
      error: sessionResult.error,
    })
  }

  const secretKey = getStripeSecretKey()
  if (!secretKey) {
    return res.status(200).json({
      status: 'unpaid',
      error:
        'Stripe is inactive. Primary checkout is Freemius — set STRIPE_SECRET_KEY (sk_test_ or sk_live_) only if needed.',
      code: 'stripe_inactive',
      checkout: 'freemius',
    })
  }

  try {
    const stripe = new Stripe(secretKey)
    const session = await stripe.checkout.sessions.retrieve(sessionResult.value)

    const paymentStatus = session.payment_status // 'paid' | 'unpaid' | 'no_payment_required'

    if (paymentStatus === 'paid') {
      const unlockSecret = getUnlockSecret()
      if (unlockSecret) {
        const token = createUnlockToken({
          sessionId: session.id,
          customerEmail: session.customer_details?.email ?? null,
          secret: unlockSecret,
        })
        res.setHeader(
          'Set-Cookie',
          buildUnlockCookie(token, { secure: isSecureRequest(req) }),
        )
      }

      return res.status(200).json({
        status: 'paid',
        sessionId: session.id,
        paymentStatus,
      })
    }

    if (session.status === 'open' || paymentStatus === 'unpaid') {
      return res.status(200).json({
        status: paymentStatus === 'unpaid' && session.status !== 'open' ? 'unpaid' : 'pending',
        sessionId: session.id,
        paymentStatus,
      })
    }

    return res.status(200).json({
      status: 'pending',
      sessionId: session.id,
      paymentStatus,
    })
  } catch (error) {
    console.error('check-payment-status Stripe error:', error.message)
    // Always return JSON the frontend can parse — avoid opaque failures.
    return res.status(200).json({
      status: 'unpaid',
      sessionId: sessionResult.value,
      error: 'Stripe could not verify this checkout session.',
    })
  }
}

export default withPerimeter(handler)
