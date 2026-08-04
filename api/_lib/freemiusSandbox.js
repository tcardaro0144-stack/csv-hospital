/**
 * Freemius overlay sandbox credentials.
 * Same product secret/public key as live — sandbox is a minted { token, ctx } pair.
 * @see https://freemius.com/help/documentation/selling-with-freemius/freemius-checkout-buy-button/
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

/**
 * Mint Freemius Checkout sandbox { token, ctx } for the configured product.
 * @returns {{
 *   mode: 'sandbox'|'live',
 *   isSandbox: boolean,
 *   store_id: string|null,
 *   product_id: string,
 *   plan_id: string,
 *   public_key: string,
 *   sandbox: { token: string, ctx: string }|null,
 *   error?: string,
 *   status?: number,
 * }}
 */
export function buildFreemiusCheckoutModeResponse() {
  const productId = getFreemiusProductId()
  const planId = getFreemiusPlanId()
  const publicKey = getFreemiusPublicKey()
  const storeId = getFreemiusStoreId()
  const secretKey = getFreemiusSecretKey()
  const sandboxMode = isFreemiusSandboxEnabled()

  if (!productId || !planId || !publicKey) {
    return {
      mode: 'live',
      isSandbox: false,
      store_id: storeId,
      product_id: productId || '',
      plan_id: planId || '',
      public_key: publicKey || '',
      sandbox: null,
      error: 'Freemius product config is incomplete.',
      status: 500,
    }
  }

  if (!sandboxMode) {
    return {
      mode: 'live',
      isSandbox: false,
      store_id: storeId,
      product_id: productId,
      plan_id: planId,
      public_key: publicKey,
      sandbox: null,
    }
  }

  if (!secretKey) {
    return {
      mode: 'sandbox',
      isSandbox: true,
      store_id: storeId,
      product_id: productId,
      plan_id: planId,
      public_key: publicKey,
      sandbox: null,
      error:
        'FREEMIUS_SECRET_KEY is not set. Copy it from Freemius Dashboard → Product → Keys, then restart the API.',
      status: 503,
    }
  }

  // Freemius Dashboard → Get Checkout → Overlay → Sandbox tab formula
  const ctx = String(Math.floor(Date.now() / 1000))
  const token = crypto
    .createHash('md5')
    .update(`${ctx}${productId}${secretKey}${publicKey}checkout`)
    .digest('hex')

  return {
    mode: 'sandbox',
    isSandbox: true,
    store_id: storeId,
    product_id: productId,
    plan_id: planId,
    public_key: publicKey,
    sandbox: { token, ctx },
  }
}
