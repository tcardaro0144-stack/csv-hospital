/**
 * Server-only Freemius JS SDK client (`@freemius/sdk`).
 * Never import this from browser / Vite client code.
 */

import { Freemius } from '@freemius/sdk'
import {
  getFreemiusApiKey,
  getFreemiusProductId,
  getFreemiusPublicKey,
  getFreemiusSecretKey,
} from './env.js'
import { FREEMIUS_PRODUCT_ID } from '../../shared/freemiusCatalog.js'

/**
 * @returns {Freemius|null}
 */
export function createFreemiusSdk() {
  const productId = getFreemiusProductId() || FREEMIUS_PRODUCT_ID
  const secretKey = getFreemiusSecretKey()
  const publicKey = getFreemiusPublicKey()
  // getSandboxParams only needs productId + secret + public; apiKey is required
  // by the SDK constructor for other API calls.
  const apiKey = getFreemiusApiKey() || 'local-sandbox-placeholder'

  if (!productId || !secretKey || !publicKey) return null

  return new Freemius({
    productId,
    apiKey,
    secretKey,
    publicKey,
  })
}
