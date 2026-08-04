import 'dotenv/config'
import cors from 'cors'
import crypto from 'crypto'
import express from 'express'
import Stripe from 'stripe'
import {
  getConfiguredClientUrl,
  getFreemiusPlanId,
  getFreemiusProductId,
  getFreemiusPublicKey,
  getFreemiusSecretKey,
  getMakeWebhookUrl,
  getStripePriceId,
  getStripeSecretKey,
  getUnlockSecret,
  getWebhookSecret,
  isFreemiusSandboxEnabled,
  isStripeConfigured,
} from '../api/_lib/env.js'
import { enforceRateLimit } from '../api/_lib/rateLimit.js'
import { applySecurityHeaders } from '../api/_lib/securityHeaders.js'
import { stripeCheckoutErrorMessage } from '../api/_lib/stripeErrors.js'
import { validateSessionId, validateClientUrl } from '../api/_lib/validate.js'
import { assertPaidSession, assertPaidUnlock } from '../lib/assertPaidUnlock.js'
import { SecurityGuardian } from '../lib/securityGuardian.js'
import { ManagerAi } from '../lib/managerAi.js'
import { startDiscordBot } from '../lib/discordBot.js'
import { processSupportTriage } from '../lib/supportTriageHandler.js'
import {
  createPendingOrder,
  getOrderByDownloadToken,
  getOrderBySessionId,
  isValidDownloadToken,
  markOrderPaid,
} from '../lib/ordersDb.js'
import {
  buildUnlockCookie,
  createUnlockToken,
  isSecureRequest,
} from '../lib/unlockToken.js'

const STRIPE_INACTIVE = {
  error:
    'Stripe is inactive. Freemius is the primary checkout — set STRIPE_SECRET_KEY (sk_test_ or sk_live_) only if using Stripe.',
  code: 'stripe_inactive',
  checkout: 'freemius',
}

const app = express()
const port = process.env.PORT || 4242

const secretKey = getStripeSecretKey()
const stripePriceId = getStripePriceId()
const clientUrlResult = getConfiguredClientUrl()
const webhookSecret = getWebhookSecret()
const unlockSecret = getUnlockSecret()

if (!secretKey) {
  console.warn(
    'Warning: STRIPE_SECRET_KEY missing — Stripe legacy checkout inactive (Freemius primary). Test keys (sk_test_) are allowed when set.',
  )
}
if (!clientUrlResult.ok) {
  console.warn('Warning: CLIENT_URL is missing or invalid.')
}
if (!unlockSecret) {
  console.warn('Warning: UNLOCK_SECRET is missing, too short, or still the placeholder.')
}

const stripe = secretKey ? new Stripe(secretKey) : null
const clientUrl = clientUrlResult.ok ? clientUrlResult.value : 'http://localhost:5173'
app.use((req, res, next) => {
  applySecurityHeaders(res, {
    isApi: req.path.startsWith('/api'),
    includeCsp: false,
  })
  next()
})

app.use(
  cors({
    origin(origin, callback) {
      // Allow Vite on any localhost port (5173, 5183, …) in development.
      if (!origin) return callback(null, true)
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
        return callback(null, true)
      }
      if (origin === clientUrl) return callback(null, true)
      return callback(null, false)
    },
    credentials: true,
  }),
)

// Stripe webhooks need the raw body for signature verification.
app.post(
  '/api/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    if (!stripe || !webhookSecret) {
      return res.status(500).json({ error: 'Webhook service is not configured.' })
    }

    if (Buffer.isBuffer(req.body) && req.body.length > 256 * 1024) {
      return res.status(413).json({ error: 'Payload too large.' })
    }

    let event
    try {
      const signature = req.headers['stripe-signature']
      if (typeof signature !== 'string' || !signature) {
        return res.status(400).json({ error: 'Missing stripe-signature.' })
      }
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret)
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
          `[webhook] order paid session=${session.id} token=${order?.downloadToken ? 'issued' : 'missing'}`,
        )
      }
    }

    return res.status(200).json({ received: true })
  },
)

app.use(express.json({ limit: '32kb' }))

// Faceless Guardian — inspect incoming utility requests (velocity + AVS shield).
// Runs after JSON parsing so it can read billingCountry, and after the raw
// webhook route above so Stripe signature verification stays intact.
const guardian = new SecurityGuardian()
const manager = new ManagerAi({ guardian })
guardian.setManager(manager)
app.use('/api', guardian.middleware())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

/**
 * Manager AI — admin health snapshot (no secrets).
 * GET /api/manager/status
 */
app.get('/api/manager/status', (req, res) => {
  if (!enforceRateLimit(req, res, 'unlockStatus')) return
  const snapshot = manager.collectHealthSnapshot()
  return res.json({
    ok: true,
    manager: manager.name,
    role: manager.role,
    stance: manager.stance,
    snapshot,
  })
})

/**
 * Manager AI — compose + optionally deliver an admin briefing.
 * POST /api/manager/check-in  body: { deliver?: boolean, kind?: string }
 */
app.post('/api/manager/check-in', async (req, res) => {
  if (!enforceRateLimit(req, res, 'triage')) return

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const kind =
    typeof body.kind === 'string' && body.kind.trim()
      ? body.kind.trim().slice(0, 40)
      : 'manual'
  const deliver = body.deliver !== false

  try {
    if (deliver) {
      const result = await manager.sendHealthCheck(kind)
      return res.json({
        ok: true,
        delivered: result.delivery.delivered,
        channel: result.delivery.channel,
        status: result.status,
        briefing: result.briefing,
      })
    }

    const composed = await manager.composeBriefing(kind)
    return res.json({
      ok: true,
      delivered: false,
      status: composed.status,
      briefing: composed.briefing,
    })
  } catch (error) {
    console.error('[manager] check-in error:', error.message)
    return res.status(500).json({ error: 'Unable to complete manager check-in.' })
  }
})

/**
 * Zero-Trust gauntlet — public questions only (no target answers).
 * GET /api/manager/verify
 */
app.get('/api/manager/verify', (req, res) => {
  if (!enforceRateLimit(req, res, 'verify')) return
  return res.json({
    ok: true,
    ownerVerified: manager.isOwnerVerified,
    protocol: 'zero-trust-4-stage',
    flexibility:
      'Answers are evaluated for meaning and substance, not rigid word-for-word passwords.',
    questions: manager.getVerificationQuestions(),
  })
})

/**
 * Submit 4-stage identity answers.
 * POST /api/manager/verify
 * body: { name, perspective, personal_history, super_secret }
 *    or { answers: [q1, q2, q3, q4] }
 */
app.post('/api/manager/verify', (req, res) => {
  if (!enforceRateLimit(req, res, 'verify')) return

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const answers = Array.isArray(body.answers)
    ? body.answers
    : {
        name: body.name,
        perspective: body.perspective,
        personal_history: body.personal_history,
        super_secret: body.super_secret,
      }

  const result = manager.verifyOwnerIdentity(answers)
  if (!result.verified) {
    return res.status(403).json({
      ok: false,
      verified: false,
      lockedDown: true,
      failedStage: result.failedStage,
      message: result.message,
    })
  }

  return res.json({
    ok: true,
    verified: true,
    message: result.message,
  })
})

/**
 * Freemius checkout config — live or sandbox.
 * Live: { mode: 'live', sandbox: null } (real charges; same product keys).
 * Sandbox: { mode: 'sandbox', sandbox: { token, ctx } } when FREEMIUS_SANDBOX=true.
 */
app.get('/api/freemius-sandbox', (req, res) => {
  if (!enforceRateLimit(req, res, 'checkout')) return

  const productId = getFreemiusProductId()
  const planId = getFreemiusPlanId()
  const publicKey = getFreemiusPublicKey()
  const secretKey = getFreemiusSecretKey()
  const sandboxMode = isFreemiusSandboxEnabled()

  if (!productId || !planId || !publicKey) {
    return res.status(500).json({ error: 'Freemius product config is incomplete.' })
  }

  // Live mode: same product keys, no sandbox token — real charges.
  if (!sandboxMode) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.status(200).json({
      mode: 'live',
      product_id: productId,
      plan_id: planId,
      public_key: publicKey,
      sandbox: null,
    })
  }

  if (!secretKey) {
    return res.status(503).json({
      error:
        'FREEMIUS_SECRET_KEY is not set. Copy it from Freemius Dashboard → Product → Keys, then restart the API.',
    })
  }

  const ctx = String(Math.floor(Date.now() / 1000))
  const token = crypto
    .createHash('md5')
    .update(`${ctx}${productId}${secretKey}${publicKey}checkout`)
    .digest('hex')

  return res.json({
    mode: 'sandbox',
    product_id: productId,
    plan_id: planId,
    public_key: publicKey,
    sandbox: { token, ctx },
  })
})

app.post('/api/create-checkout-session', async (req, res) => {
  if (!enforceRateLimit(req, res, 'checkout')) return

  if (!stripe) {
    return res.status(503).json(STRIPE_INACTIVE)
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const fromClient = validateClientUrl(body.origin)
  const clientOrigin = fromClient.ok ? fromClient.value : clientUrl

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      payment_method_configuration: 'pmc_1TuVcLIv6QgjmVhx8D81tVjU',
      payment_method_options: {
        link: {
          // Disable Stripe Link so Checkout shows the standard card form only
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
    res.status(500).json({ error: stripeCheckoutErrorMessage(error) })
  }
})

app.post('/api/create-payment-intent', async (req, res) => {
  if (!enforceRateLimit(req, res, 'checkout')) return

  if (!stripe) {
    return res.status(503).json(STRIPE_INACTIVE)
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const fromClient = validateClientUrl(body.origin || body.returnOrigin)
  const origin = fromClient.ok ? fromClient.value : clientUrl
  const returnUrl = `${origin}/?session_id={CHECKOUT_SESSION_ID}`

  // Prefer API version that supports ui_mode: 'elements'
  const elementsStripe = new Stripe(secretKey, {
    apiVersion: '2026-06-24.dahlia',
  })

  try {
    const session = await elementsStripe.checkout.sessions.create({
      ui_mode: 'elements',
      mode: 'payment',
      line_items: [{ price: stripePriceId, quantity: 1 }],
      return_url: returnUrl,
      metadata: { product: 'csv-hospital-pro' },
    })

    if (!session.client_secret) {
      console.error('Checkout Session missing client_secret:', session.id)
      return res.status(502).json({
        error: 'Checkout Session did not return a client_secret.',
      })
    }

    const publishableKey =
      process.env.STRIPE_PUBLISHABLE_KEY?.trim() ||
      process.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() ||
      undefined

    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json({
      clientSecret: session.client_secret,
      client_secret: session.client_secret,
      sessionId: session.id,
      publishableKey:
        publishableKey && publishableKey.startsWith('pk_')
          ? publishableKey
          : undefined,
    })
  } catch (error) {
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
})

app.get('/api/confirm-payment', async (req, res) => {
  if (!enforceRateLimit(req, res, 'verify')) return

  const sessionResult = validateSessionId(
    req.query.session_id || req.query.checkout_session_id,
  )
  if (!sessionResult.ok) {
    return res.status(400).json({ paid: false, error: sessionResult.error })
  }

  if (!stripe) {
    return res.status(503).json({
      paid: false,
      ...STRIPE_INACTIVE,
    })
  }

  try {
    const elementsStripe = new Stripe(secretKey, {
      apiVersion: '2026-06-24.dahlia',
    })
    const session = await elementsStripe.checkout.sessions.retrieve(
      sessionResult.value,
    )

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
})

app.get('/api/order-status', async (req, res) => {
  if (!enforceRateLimit(req, res, 'verify')) return

  const sessionResult = validateSessionId(req.query.session_id)
  if (!sessionResult.ok) {
    return res.status(400).json({ error: sessionResult.error })
  }

  let order = getOrderBySessionId(sessionResult.value)

  // Prefer webhook-written state; reconcile with Stripe if still pending.
  if ((!order || order.status !== 'paid') && stripe) {
    try {
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
})

app.get('/api/check-payment-status', async (req, res) => {
  if (!enforceRateLimit(req, res, 'verify')) return

  const rawId = req.query.session_id ?? req.query.checkout_session_id
  const sessionResult = validateSessionId(rawId)
  if (!sessionResult.ok) {
    return res.status(400).json({ status: 'unpaid', error: sessionResult.error })
  }

  if (!stripe) {
    return res.status(200).json({
      status: 'unpaid',
      ...STRIPE_INACTIVE,
    })
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionResult.value)
    const paymentStatus = session.payment_status

    if (paymentStatus === 'paid') {
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
        status:
          paymentStatus === 'unpaid' && session.status !== 'open'
            ? 'unpaid'
            : 'pending',
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
    return res.status(200).json({
      status: 'unpaid',
      sessionId: sessionResult.value,
      error: 'Stripe could not verify this checkout session.',
    })
  }
})

app.get('/api/download', (req, res) => {
  if (!enforceRateLimit(req, res, 'unlockStatus')) return

  const cleanToken =
    typeof req.query.token === 'string' ? req.query.token.trim() : ''

  if (!cleanToken || cleanToken.length < 16) {
    return res.status(400).json({ allowed: false, error: 'Missing download token.' })
  }

  if (!isValidDownloadToken(cleanToken)) {
    return res.status(402).json({
      allowed: false,
      error: 'Payment required or invalid download token.',
    })
  }

  const order = getOrderByDownloadToken(cleanToken)
  return res.status(200).json({
    allowed: true,
    status: 'paid',
    sessionId: order.sessionId,
    downloadUrl: order.downloadUrl,
  })
})

app.get('/api/verify-session', async (req, res) => {
  if (!enforceRateLimit(req, res, 'verify')) return

  const sessionResult = validateSessionId(req.query.session_id)
  if (!sessionResult.ok) {
    return res.status(400).json({ error: sessionResult.error })
  }

  if (!stripe) {
    return res.status(503).json(STRIPE_INACTIVE)
  }

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
    if (unlockSecret) {
      const token = createUnlockToken({
        sessionId: session.id,
        customerEmail,
        secret: unlockSecret,
      })
      res.setHeader(
        'Set-Cookie',
        buildUnlockCookie(token, { secure: isSecureRequest(req) }),
      )
    }

    res.json({
      pro: true,
      sessionId: session.id,
      customerEmail,
      status: 'paid',
      downloadUrl: order?.downloadUrl ?? null,
      downloadToken: order?.downloadToken ?? null,
      unlockCookie: Boolean(unlockSecret),
    })
  } catch (error) {
    console.error('Verify session error:', error.message)
    res.status(400).json({ error: 'Invalid or expired session.' })
  }
})

app.get('/api/unlock-status', async (req, res) => {
  if (!enforceRateLimit(req, res, 'unlockStatus')) return

  if (!isStripeConfigured()) {
    return res.json({
      unlocked: false,
      reason: 'stripe_inactive',
      checkout: 'freemius',
    })
  }

  const result = await assertPaidUnlock(req)

  if (!result.allowed) {
    return res.json({
      unlocked: false,
      reason: result.reason,
      checkout: result.checkout || 'freemius',
    })
  }

  return res.json({
    unlocked: true,
    sessionId: result.sessionId,
    customerEmail: result.customerEmail,
  })
})

app.post('/api/assert-download', async (req, res) => {
  if (!enforceRateLimit(req, res, 'unlockStatus')) return

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const sessionId =
    (typeof body.session_id === 'string' && body.session_id) ||
    (typeof body.sessionId === 'string' && body.sessionId) ||
    null

  const result = sessionId
    ? await assertPaidSession(sessionId)
    : await assertPaidUnlock(req)

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

  return res.json({
    allowed: true,
    sessionId: result.sessionId,
    paymentStatus: result.paymentStatus ?? 'paid',
  })
})

app.post('/api/support-triage', async (req, res) => {
  if (!enforceRateLimit(req, res, 'triage')) return

  try {
    const { status, payload } = await processSupportTriage(req.body, {
      source: 'web-support',
      inspectText: (text) => manager.inspectUntrustedText(text, 'support-triage'),
    })
    return res.status(status).json(payload)
  } catch (error) {
    console.error('Support triage error:', error?.message || error)
    return res.status(500).json({ error: 'Unable to triage message.' })
  }
})

app.listen(port, () => {
  console.log(`CSV Hospital API running on http://localhost:${port}`)
  console.log(`  POST http://localhost:${port}/api/create-payment-intent`)
  console.log(`  GET  http://localhost:${port}/api/health`)
  console.log(`  GET  http://localhost:${port}/api/manager/status`)
  console.log(`  POST http://localhost:${port}/api/manager/check-in`)
  console.log(`  GET/POST http://localhost:${port}/api/manager/verify`)
  console.log(
    `  Freemius checkout: ${isFreemiusSandboxEnabled() ? 'SANDBOX' : 'LIVE'} · product ${getFreemiusProductId()} · plan ${getFreemiusPlanId()}`,
  )
  console.log(
    `  Make.com webhook: ${getMakeWebhookUrl() ? 'configured (csvhospital.com triggers)' : 'not set'}`,
  )
  const discord = startDiscordBot({ manager, guardian })
  const afterDiscord = discord?.whenReady
    ? discord.whenReady.catch((err) => {
        console.error('[discord] ready failed:', err)
      })
    : Promise.resolve()

  afterDiscord.then(() => {
    // Friendly startup check-in from the Faceless Guardian
    guardian.sendStartupGreeting().catch((err) => {
      console.error('[guardian] startup greeting failed:', err)
    })

    // Faceless Manager — admin channel greeting + first synthesized briefing
    manager
      .sendStartupCheckIn()
      .then(() => manager.startRoutineCheckIns())
      .catch((err) => {
        console.error('[manager] startup check-in failed:', err)
      })
  })
})
