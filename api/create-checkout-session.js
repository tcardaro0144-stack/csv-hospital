import Stripe from 'stripe'
import {
  getConfiguredClientUrl,
  getStripePriceId,
  getStripeSecretKey,
} from './_lib/env.js'
import { enforceRateLimit } from './_lib/rateLimit.js'
import { withPerimeter } from './_lib/securityHeaders.js'
import { stripeCheckoutErrorMessage } from './_lib/stripeErrors.js'
import { requireMethod, validateClientUrl } from './_lib/validate.js'
import { createPendingOrder } from '../lib/ordersDb.js'

const PAYMENT_METHOD_CONFIGURATION = 'pmc_1TuVcLIv6QgjmVhx8D81tVjU'

async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return
  if (!enforceRateLimit(req, res, 'checkout')) return

  const secretKey = getStripeSecretKey()
  if (!secretKey) {
    return res.status(503).json({
      error:
        'Stripe checkout is inactive. Use Freemius overlay checkout, or set STRIPE_SECRET_KEY (sk_test_ or sk_live_).',
      code: 'stripe_inactive',
      checkout: 'freemius',
    })
  }

  const stripePriceId = getStripePriceId()

  // Prefer origin from the browser (window.location.origin) so the port matches.
  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const fromClient = validateClientUrl(body.origin)
  const fromEnv = getConfiguredClientUrl()
  const clientOrigin = fromClient.ok
    ? fromClient.value
    : fromEnv.ok
      ? fromEnv.value
      : null

  if (!clientOrigin) {
    return res.status(400).json({
      error: 'Missing or invalid origin for checkout redirect URLs.',
    })
  }

  const stripe = new Stripe(secretKey)

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      payment_method_configuration: PAYMENT_METHOD_CONFIGURATION,
      payment_method_options: {
        link: {
          persistent_token: undefined,
          enabled: false,
        },
      },
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: `${clientOrigin}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientOrigin}/?checkout=cancelled`,
      metadata: { product: 'csv-hospital-pro' },
    })

    if (!session.url) {
      console.error('Checkout session created without url:', session.id)
      return res.status(502).json({ error: 'Unable to create checkout session.' })
    }

    createPendingOrder({ sessionId: session.id })

    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json({
      url: session.url,
      id: session.id,
      sessionId: session.id,
    })
  } catch (error) {
    console.error('Checkout session error:', error.message)
    return res.status(500).json({ error: stripeCheckoutErrorMessage(error) })
  }
}

export default withPerimeter(handler)
