/**
 * Localhost-only Freemius mock purchase completion.
 * Simulates a successful overlay callback (test card 4242) without hitting
 * Freemius live/sandbox payment rails.
 *
 * Never enable outside local/dev.
 */

import {
  FREEMIUS_PLAN_ID,
  FREEMIUS_PRODUCT_ID,
} from '../../shared/freemiusCatalog.js'

/**
 * @param {import('http').IncomingMessage} req
 * @returns {boolean}
 */
export function isLocalFreemiusMockRequest(req) {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    // Explicit opt-in only — still blocked on production hosts by default.
    if (!/^(1|true|yes|on)$/i.test(String(process.env.FREEMIUS_LOCAL_MOCK || ''))) {
      return false
    }
  }

  const host = String(req.headers?.host || '').toLowerCase()
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return true

  const origin = String(req.headers?.origin || '').toLowerCase()
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(origin)) return true

  // Server-side local scripts (no Host) when FREEMIUS_LOCAL_MOCK is on.
  return /^(1|true|yes|on)$/i.test(String(process.env.FREEMIUS_LOCAL_MOCK || ''))
}

/**
 * Build a Freemius-shaped success payload for local credit grant testing.
 * @param {{
 *   packageId?: string,
 *   files?: number,
 *   planId?: string,
 *   pricingId?: string|null,
 *   productId?: string,
 *   testCard?: string,
 * }} [opts]
 */
export function buildLocalFreemiusMockSuccessPayload(opts = {}) {
  const testCard = String(opts.testCard || '4242').replace(/\s+/g, '')
  const planId = String(opts.planId || FREEMIUS_PLAN_ID)
  const pricingId =
    opts.pricingId != null && String(opts.pricingId).trim()
      ? String(opts.pricingId)
      : null
  const productId = String(opts.productId || FREEMIUS_PRODUCT_ID)
  const files = Number(opts.files) > 0 ? Number(opts.files) : 1
  const packageId = opts.packageId || 'pass-1'
  const purchaseId = `local-4242-${packageId}-${Date.now()}`

  return {
    provider: 'freemius-local-mock',
    mock: true,
    local_test: true,
    test_card: testCard.startsWith('4242') ? '4242' : testCard,
    is_sandbox: true,
    product_id: productId,
    plan_id: planId,
    pricing_id: pricingId,
    purchase_id: purchaseId,
    purchase: {
      id: purchaseId,
      plan_id: planId,
      pricing_id: pricingId,
      payment_method: {
        type: 'card',
        last4: '4242',
        brand: 'visa',
      },
    },
    user: {
      id: `local-user-${Date.now()}`,
      email: 'local-test@localhost',
    },
    license: {
      id: `local-license-${Date.now()}`,
    },
    packageId,
    files,
  }
}
