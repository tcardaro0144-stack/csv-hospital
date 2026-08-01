import Stripe from 'stripe'
import { markOrderPaid } from '../lib/ordersDb.js'
import { getStripeSecretKey, getWebhookSecret } from './_lib/env.js'
import { withPerimeter } from './_lib/securityHeaders.js'
import { requireMethod } from './_lib/validate.js'

export const config = {
  api: {
    bodyParser: false,
  },
}

async function readRawBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

/**
 * Stripe webhook listener.
 * On checkout.session.completed → status 'paid' + tokenized download URL.
 */
async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return

  const secretKey = getStripeSecretKey()
  const webhookSecret = getWebhookSecret()

  if (!secretKey || !webhookSecret) {
    return res.status(500).json({ error: 'Webhook service is not configured.' })
  }

  const stripe = new Stripe(secretKey)

  let event
  try {
    const rawBody = await readRawBody(req)

    if (rawBody.length > 256 * 1024) {
      return res.status(413).json({ error: 'Payload too large.' })
    }

    const signature = req.headers['stripe-signature']
    if (typeof signature !== 'string' || !signature) {
      return res.status(400).json({ error: 'Missing stripe-signature.' })
    }

    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (error) {
    console.error('Webhook signature error:', error.message)
    return res.status(400).json({ error: 'Invalid webhook signature.' })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const isPro =
      session.metadata?.product === 'csv-hospital-pro' &&
      (session.payment_status === 'paid' || session.status === 'complete')

    if (isPro && session.id) {
      const order = markOrderPaid(session.id, {
        email: session.customer_details?.email ?? null,
      })
      console.log(
        `[webhook] order paid session=${session.id} downloadToken=${order?.downloadToken ? 'issued' : 'missing'}`,
      )
    }
  }

  return res.status(200).json({ received: true })
}

export default withPerimeter(handler)
