import Stripe from 'stripe'
import {
  getConfiguredClientUrl,
  getStripePublishableKey,
  getStripeSecretKey,
} from './_lib/env.js'
import { enforceRateLimit } from './_lib/rateLimit.js'
import { withPerimeter } from './_lib/securityHeaders.js'
import { requireMethod, validateClientUrl } from './_lib/validate.js'

/** One-time unlock price (Stripe Dashboard → Products → Price ID). */
const STRIPE_PRICE_ID = 'price_1TuUafIv6QgjmVhx1EWTE8FP'

/** API version that supports ui_mode: 'elements' (replaces 'custom'). */
const STRIPE_API_VERSION = '2026-06-24.dahlia'

/**
 * POST /api/create-payment-intent
 * Creates a Checkout Session with ui_mode: 'elements' and returns client_secret.
 * (Endpoint name kept for frontend compatibility.)
 */
async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return
  if (!enforceRateLimit(req, res, 'checkout')) return

  const secretKey = getStripeSecretKey()
  if (!secretKey) {
    return res.status(500).json({
      error: 'Payment service is not configured.',
    })
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const fromClient = validateClientUrl(body.origin || body.returnOrigin)
  const fromEnv = getConfiguredClientUrl()
  const origin = fromClient.ok
    ? fromClient.value
    : fromEnv.ok
      ? fromEnv.value
      : null

  if (!origin) {
    return res.status(400).json({
      error: 'Missing or invalid origin for return_url.',
    })
  }

  const returnUrl = `${origin}/hospital?session_id={CHECKOUT_SESSION_ID}`
  const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION })
  const publishableKey = getStripePublishableKey()

  try {
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'elements',
      mode: 'payment',
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      return_url: returnUrl,
      metadata: { product: 'csv-hospital-pro' },
    })

    if (!session.client_secret) {
      console.error('Checkout Session missing client_secret:', {
        id: session.id,
        ui_mode: session.ui_mode,
        status: session.status,
      })
      return res.status(502).json({
        error: 'Checkout Session did not return a client_secret.',
      })
    }

    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json({
      clientSecret: session.client_secret,
      client_secret: session.client_secret,
      sessionId: session.id,
      publishableKey: publishableKey || undefined,
    })
  } catch (error) {
    // Log the full Stripe error object for invalid_request_error diagnosis.
    console.error('Checkout Session (ui_mode=elements) failed:', {
      type: error?.type,
      code: error?.code,
      message: error?.message,
      param: error?.param,
      statusCode: error?.statusCode,
      raw: error?.raw,
      rawType: error?.rawType,
      requestId: error?.requestId,
      doc_url: error?.doc_url,
    })
    console.error('Stripe error object (JSON):', JSON.stringify(error, null, 2))

    const stripeMessage =
      error?.raw?.message ||
      error?.message ||
      'Unable to create Checkout Session.'

    return res.status(500).json({
      error: stripeMessage,
      stripeType: error?.type || error?.rawType || null,
      stripeCode: error?.code || error?.raw?.code || null,
      stripeParam: error?.param || error?.raw?.param || null,
    })
  }
}

export default withPerimeter(handler)
