/**
 * Freemius overlay sandbox credentials.
 *
 * Official Freemius sandbox formula (Dashboard / App Integration docs):
 *
 *   timestamp = Math.floor(Date.now() / 1000)
 *   sandbox_token = md5(timestamp + product_id + secret_key + public_key + "checkout")
 *
 * Overlay Checkout:
 *   open({ sandbox: { token: sandbox_token, ctx: timestamp } })
 *
 * Hosted Checkout query:
 *   ?sandbox={sandbox_token}&s_ctx_ts={timestamp}
 *
 * @see https://freemius.com/help/documentation/saas/app-integration/
 * @see https://freemius.com/help/documentation/checkout/integration/testing/
 */

import crypto from 'crypto'
import {
  getFreemiusPlanId,
  getFreemiusProductId,
  getFreemiusPublicKey,
  getFreemiusSecretKey,
  getFreemiusStoreId,
  isFreemiusSandboxEnabled,
} from './env.js'
import {
  FREEMIUS_PLAN_ID,
  FREEMIUS_PRODUCT_ID,
} from '../../shared/freemiusCatalog.js'

/**
 * Mint a real Freemius sandbox token using the documented MD5 formula.
 *
 * @param {{
 *   productId: string,
 *   secretKey: string,
 *   publicKey: string,
 *   timestampSec?: number,
 * }} params
 * @returns {{
 *   sandbox_token: string,
 *   timestamp: string,
 *   token: string,
 *   ctx: string,
 * }}
 */
export function mintFreemiusSandboxToken({
  productId,
  secretKey,
  publicKey,
  timestampSec = Math.floor(Date.now() / 1000),
}) {
  const timestamp = String(timestampSec)

  // Freemius docs (verbatim formula):
  // crypto.createHash('md5').update(timestamp + productId + secretKey + publicKey + 'checkout').digest('hex')
  const sandbox_token = crypto
    .createHash('md5')
    .update(`${timestamp}${productId}${secretKey}${publicKey}checkout`, 'utf8')
    .digest('hex')

  return {
    sandbox_token,
    timestamp,
    // Overlay Checkout aliases (Buy Button / @freemius/checkout)
    token: sandbox_token,
    ctx: timestamp,
  }
}

/**
 * Build live or sandbox checkout-mode payload for GET /api/freemius-sandbox.
 *
 * Sandbox responses include both Freemius naming styles so the client can
 * initialize checkout with test-card support (4242…):
 *   - sandbox_token + timestamp  (docs / hosted links)
 *   - sandbox: { token, ctx }    (@freemius/checkout open())
 *
 * @returns {{
 *   mode: 'sandbox'|'live',
 *   isSandbox: boolean,
 *   is_sandbox: boolean,
 *   store_id: string|null,
 *   product_id: string,
 *   plan_id: string,
 *   public_key: string,
 *   sandbox: { token: string, ctx: string }|null,
 *   sandbox_token?: string,
 *   timestamp?: string,
 *   s_ctx_ts?: string,
 *   source?: 'md5',
 *   error?: string,
 *   status?: number,
 * }}
 */
export function buildFreemiusCheckoutModeResponse() {
  const productId = getFreemiusProductId() || FREEMIUS_PRODUCT_ID
  const planId = getFreemiusPlanId() || FREEMIUS_PLAN_ID
  const publicKey = getFreemiusPublicKey()
  const storeId = getFreemiusStoreId()
  const secretKey = getFreemiusSecretKey()
  const sandboxMode = isFreemiusSandboxEnabled()

  if (!productId || !planId || !publicKey) {
    return {
      mode: sandboxMode ? 'sandbox' : 'live',
      isSandbox: sandboxMode,
      is_sandbox: sandboxMode,
      store_id: storeId,
      product_id: productId || '',
      plan_id: planId || '',
      public_key: publicKey || '',
      sandbox: null,
      sandbox_token: null,
      timestamp: null,
      error:
        'Freemius product config is incomplete. Set product/plan/public key env vars, then restart the API.',
      status: 503,
    }
  }

  if (!sandboxMode) {
    return {
      mode: 'live',
      isSandbox: false,
      is_sandbox: false,
      store_id: storeId,
      product_id: productId,
      plan_id: planId,
      public_key: publicKey,
      sandbox: null,
      sandbox_token: null,
      timestamp: null,
    }
  }

  if (!secretKey) {
    return {
      mode: 'sandbox',
      isSandbox: true,
      is_sandbox: true,
      store_id: storeId,
      product_id: productId,
      plan_id: planId,
      public_key: publicKey,
      sandbox: null,
      sandbox_token: null,
      timestamp: null,
      error:
        'FREEMIUS_SECRET_KEY is not set. Copy it from Freemius Dashboard → Product → Keys, then restart the API.',
      status: 503,
    }
  }

  const minted = mintFreemiusSandboxToken({
    productId,
    secretKey,
    publicKey,
  })

  const hostedSandboxUrl =
    `https://checkout.freemius.com/product/${encodeURIComponent(productId)}` +
    `/plan/${encodeURIComponent(planId)}/` +
    `?sandbox=${encodeURIComponent(minted.sandbox_token)}` +
    `&s_ctx_ts=${encodeURIComponent(minted.timestamp)}`

  const hostedAppSandboxUrl =
    `https://checkout.freemius.com/app/${encodeURIComponent(productId)}` +
    `/plan/${encodeURIComponent(planId)}/` +
    `?sandbox=${encodeURIComponent(minted.sandbox_token)}` +
    `&s_ctx_ts=${encodeURIComponent(minted.timestamp)}`

  return {
    mode: 'sandbox',
    isSandbox: true,
    is_sandbox: true,
    store_id: storeId,
    product_id: productId,
    plan_id: planId,
    public_key: publicKey,
    // Docs / hosted-checkout style
    sandbox_token: minted.sandbox_token,
    timestamp: minted.timestamp,
    // Overlay Checkout session payload (@freemius/checkout)
    // ctx must match the timestamp used in the MD5 (string is fine; SDK stringifies).
    sandbox: {
      token: minted.sandbox_token,
      ctx: minted.timestamp,
    },
    s_ctx_ts: minted.timestamp,
    source: 'md5',
    // Dev litmus: open these and look for "Prefill Form (Only visible in Sandbox Mode)".
    // If Prefill is missing, Freemius rejected the token (wrong secret/public for this product)
    // and 4242 will decline as live mode — same as a broken overlay.
    hosted_sandbox_url: hostedSandboxUrl,
    hosted_app_sandbox_url: hostedAppSandboxUrl,
  }
}
