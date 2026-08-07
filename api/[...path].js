/**
 * Single Vercel serverless entry for every /api/* route.
 *
 * Why: Hobby plans cap deployments at 12 Serverless Functions. Each top-level
 * file under /api used to count as its own function (we had 13). Handlers now
 * live under api/_handlers/ (underscore dirs are not deployed as functions)
 * and this catch-all is the only counted function.
 *
 * Guides and other SPA pages are Vite static assets — they never become functions.
 *
 * Local Express (server/index.js) is unchanged and still mounts each path.
 */

import assertDownload from './_handlers/assert-download.js'
import checkPaymentStatus from './_handlers/check-payment-status.js'
import confirmPayment from './_handlers/confirm-payment.js'
import createCheckoutSession from './_handlers/create-checkout-session.js'
import createPaymentIntent from './_handlers/create-payment-intent.js'
import download from './_handlers/download.js'
import freemiusMockComplete from './_handlers/freemius-mock-complete.js'
import freemiusSandbox from './_handlers/freemius-sandbox.js'
import orderStatus from './_handlers/order-status.js'
import supportTriage from './_handlers/support-triage.js'
import unlockStatus from './_handlers/unlock-status.js'
import verifySession from './_handlers/verify-session.js'
import webhook from './_handlers/webhook.js'

/** Stripe webhook needs the raw body for signature verification. */
export const config = {
  api: {
    bodyParser: false,
  },
}

/** @type {Record<string, (req: any, res: any) => any>} */
const ROUTES = {
  'assert-download': assertDownload,
  'check-payment-status': checkPaymentStatus,
  'confirm-payment': confirmPayment,
  'create-checkout-session': createCheckoutSession,
  'create-payment-intent': createPaymentIntent,
  download,
  'freemius-mock-complete': freemiusMockComplete,
  'freemius-sandbox': freemiusSandbox,
  'order-status': orderStatus,
  'support-triage': supportTriage,
  'unlock-status': unlockStatus,
  'verify-session': verifySession,
  webhook,
}

async function readRawBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

/**
 * Parse JSON for non-webhook routes (bodyParser is disabled globally).
 * Webhook reads the stream itself.
 */
async function attachJsonBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    if (req.body === undefined) req.body = {}
    return
  }
  const raw = await readRawBody(req)
  req.rawBody = raw
  if (!raw.length) {
    req.body = {}
    return
  }
  const text = raw.toString('utf8')
  try {
    req.body = JSON.parse(text)
  } catch {
    req.body = text
  }
}

function routeKey(req) {
  const q = req.query?.path
  if (Array.isArray(q) && q.length) {
    return q.filter(Boolean).join('/')
  }
  if (typeof q === 'string' && q.trim()) {
    return q.replace(/^\/+|\/+$/g, '')
  }

  const url = typeof req.url === 'string' ? req.url : ''
  const pathname = url.split('?')[0] || ''
  const match = pathname.match(/^\/?api\/(.+?)\/?$/)
  return match ? match[1] : ''
}

async function gateway(req, res) {
  const key = routeKey(req)
  const handler = ROUTES[key]

  if (!handler) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.status(404).json({
      error: 'Not found.',
      path: key || null,
    })
  }

  // Webhook consumes the raw request stream for Stripe signature checks.
  if (key === 'webhook') {
    return handler(req, res)
  }

  await attachJsonBody(req)
  return handler(req, res)
}

export default gateway
