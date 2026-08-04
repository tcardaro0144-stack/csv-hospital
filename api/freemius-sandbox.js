import crypto from 'crypto'
import {
  getFreemiusPlanId,
  getFreemiusProductId,
  getFreemiusPublicKey,
  getFreemiusSecretKey,
  getFreemiusStoreId,
  isFreemiusSandboxEnabled,
} from './_lib/env.js'
import { enforceRateLimit } from './_lib/rateLimit.js'
import { withPerimeter } from './_lib/securityHeaders.js'

/**
 * GET /api/freemius-sandbox
 * Live: { mode: 'live', sandbox: null } — real charges, same product keys.
 * Sandbox: { mode: 'sandbox', sandbox: { token, ctx } } — Freemius test overlay.
 */
async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed.' })
  }
  if (!enforceRateLimit(req, res, 'checkout')) return

  const productId = getFreemiusProductId()
  const planId = getFreemiusPlanId()
  const publicKey = getFreemiusPublicKey()
  const storeId = getFreemiusStoreId()
  const secretKey = getFreemiusSecretKey()
  const sandboxMode = isFreemiusSandboxEnabled()

  if (!productId || !planId || !publicKey) {
    return res.status(500).json({ error: 'Freemius product config is incomplete.' })
  }

  if (!sandboxMode) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.status(200).json({
      mode: 'live',
      store_id: storeId,
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

  return res.status(200).json({
    mode: 'sandbox',
    store_id: storeId,
    product_id: productId,
    plan_id: planId,
    public_key: publicKey,
    sandbox: { token, ctx },
  })
}

export default withPerimeter(handler)
