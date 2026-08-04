/**
 * Freemius Checkout JS SDK integration (@freemius/checkout).
 * Opens one-time (lifetime) overlay checkout for data-healing file credits.
 *
 * Only valid Freemius options are sent — empty/invalid IDs are omitted so the
 * overlay does not throw Checkout Loading / validation errors.
 */

import { Checkout } from '@freemius/checkout'
import { apiUrl } from './apiBase.js'
import { fetchJson } from './fetchJson.js'
import {
  addHealingCredits,
  getHealingCreditBalance,
  hasHealingCredits,
} from './freemiusCredits.js'
import {
  getPackageById,
  resolvePackageCheckoutIds,
  sanitizeFreemiusId,
} from './freemiusPricing.js'

const FREEMIUS_PURCHASE_KEY = 'csv-hospital-freemius-purchase'

/** Public Freemius product keys (constructor-safe). */
export const FREEMIUS_CHECKOUT_CONFIG = {
  product_id: sanitizeFreemiusId(import.meta.env.VITE_FREEMIUS_PRODUCT_ID) || '34967',
  plan_id: sanitizeFreemiusId(import.meta.env.VITE_FREEMIUS_PLAN_ID) || '57500',
  public_key: String(
    import.meta.env.VITE_FREEMIUS_PUBLIC_KEY ||
      'pk_96bd363d5fbf016bebe4795ecda42',
  ).trim(),
  // Store id is ops metadata only — never passed into FS.Checkout (invalid option).
  store_id: String(import.meta.env.VITE_FREEMIUS_STORE_ID || '').trim(),
}

/**
 * Live checkout = no sandbox token, no config API call.
 * Forced on csvhospital.com and all production builds.
 */
export function isClientFreemiusLiveMode() {
  if (import.meta.env.PROD) return true

  if (typeof window !== 'undefined') {
    const host = String(window.location.hostname || '').toLowerCase()
    if (host === 'csvhospital.com' || host.endsWith('.csvhospital.com')) {
      return true
    }
  }

  const v = String(import.meta.env.VITE_FREEMIUS_SANDBOX ?? '')
    .trim()
    .toLowerCase()
  if (/^(0|false|no|off|live|production)$/.test(v)) return true
  if (/^(1|true|yes|on|sandbox)$/.test(v)) return false
  return true
}

/**
 * Persist Freemius purchase + stack file credits for the package.
 * @param {object} data
 * @param {{ packageId?: string, files?: number, planId?: string, pricingId?: string|null }} [packageMeta]
 */
export function storeFreemiusPurchase(data, packageMeta = {}) {
  if (!data || typeof data !== 'object') return false

  const purchase = data.purchase || data
  const user = data.user || null
  const purchaseId =
    purchase?.id ||
    purchase?.purchase_id ||
    data.purchase_id ||
    null
  const planId =
    purchase?.plan_id ??
    data.plan_id ??
    packageMeta.planId ??
    null
  const pricingId =
    purchase?.pricing_id ??
    data.pricing_id ??
    packageMeta.pricingId ??
    null

  const pkg =
    (packageMeta.packageId && getPackageById(packageMeta.packageId)) || null

  const filesAdded = addHealingCredits({
    packageId: pkg?.id || packageMeta.packageId,
    files: packageMeta.files || pkg?.files,
    planId,
    purchaseId: purchaseId != null ? String(purchaseId) : null,
    raw: data,
  })

  const record = {
    unlocked: filesAdded > 0,
    provider: 'freemius',
    status: 'paid',
    billing: 'one_time',
    purchaseId: purchaseId != null ? String(purchaseId) : null,
    userEmail: user?.email || data.email || null,
    userId: user?.id != null ? String(user.id) : null,
    licenseId: data.license?.id != null ? String(data.license.id) : null,
    planId: planId != null ? String(planId) : null,
    pricingId: pricingId != null ? String(pricingId) : null,
    packageId: pkg?.id || packageMeta.packageId || null,
    filesGranted: pkg?.files || packageMeta.files || null,
    creditBalance: filesAdded,
    productId: FREEMIUS_CHECKOUT_CONFIG.product_id,
    raw: data,
    verifiedAt: new Date().toISOString(),
  }

  localStorage.setItem(FREEMIUS_PURCHASE_KEY, JSON.stringify(record))
  localStorage.setItem(
    'csv-hospital-pro',
    JSON.stringify({
      unlocked: filesAdded > 0,
      status: 'paid',
      provider: 'freemius',
      billing: 'one_time',
      purchaseId: record.purchaseId,
      creditBalance: filesAdded,
      verifiedAt: record.verifiedAt,
    }),
  )
  return true
}

export function getFreemiusPurchase() {
  try {
    const raw = localStorage.getItem(FREEMIUS_PURCHASE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.unlocked === true && parsed?.provider === 'freemius') {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function clearFreemiusPurchase() {
  localStorage.removeItem(FREEMIUS_PURCHASE_KEY)
}

export function hasFreemiusUnlock() {
  if (hasHealingCredits()) return true
  return getFreemiusPurchase()?.unlocked === true
}

export { getHealingCreditBalance, hasHealingCredits }

export async function fetchFreemiusCheckoutMode() {
  if (isClientFreemiusLiveMode()) {
    return { mode: 'live', sandbox: null }
  }

  if (import.meta.env.DEV) {
    return fetchSandboxModeFromApi()
  }

  return { mode: 'live', sandbox: null }
}

async function fetchSandboxModeFromApi() {
  const url = apiUrl('/api/freemius-sandbox')
  try {
    const data = await fetchJson(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })

    if (data?.mode === 'live' || !data?.sandbox?.token || data?.sandbox?.ctx == null) {
      return { mode: 'live', sandbox: null }
    }

    return {
      mode: 'sandbox',
      sandbox: {
        token: String(data.sandbox.token),
        ctx: String(data.sandbox.ctx),
      },
    }
  } catch (err) {
    console.warn(
      '[freemius] sandbox API unavailable — using LIVE checkout',
      err?.message || err,
    )
    return { mode: 'live', sandbox: null }
  }
}

/** @deprecated */
export async function fetchFreemiusSandbox() {
  const { mode, sandbox } = await fetchFreemiusCheckoutMode()
  if (mode !== 'sandbox' || !sandbox) {
    throw new Error('Freemius is in live mode — sandbox token is not issued.')
  }
  return sandbox
}

function assertProductKeys() {
  if (!sanitizeFreemiusId(FREEMIUS_CHECKOUT_CONFIG.product_id)) {
    throw new Error('Missing VITE_FREEMIUS_PRODUCT_ID')
  }
  if (!FREEMIUS_CHECKOUT_CONFIG.public_key?.startsWith('pk_')) {
    throw new Error('Missing or invalid VITE_FREEMIUS_PUBLIC_KEY')
  }
}

/**
 * Build FS.Checkout with only schema-safe constructor fields.
 * Never passes store_id or empty plan/pricing ids (causes Checkout Loading Error).
 * @param {{ token: string, ctx: string }|null} sandbox
 * @param {string} planId
 */
function createCheckoutHandler(sandbox, planId) {
  assertProductKeys()
  const safePlan = sanitizeFreemiusId(planId) || FREEMIUS_CHECKOUT_CONFIG.plan_id

  /** @type {Record<string, unknown>} */
  const options = {
    product_id: FREEMIUS_CHECKOUT_CONFIG.product_id,
    public_key: FREEMIUS_CHECKOUT_CONFIG.public_key,
    plan_id: safePlan,
  }

  if (sandbox?.token && sandbox?.ctx != null) {
    options.sandbox = {
      token: String(sandbox.token),
      ctx: String(sandbox.ctx),
    }
  }

  try {
    const handler = new Checkout(options)
    window.fsCheckout = handler
    return handler
  } catch (err) {
    if (window.FS?.Checkout) {
      console.warn('[freemius] npm Checkout failed — falling back to CDN FS.Checkout', err)
      const handler = new window.FS.Checkout(options)
      window.fsCheckout = handler
      return handler
    }
    throw err
  }
}

/**
 * Build open() payload with only valid Freemius fields.
 * @param {import('./freemiusPricing.js').FreemiusCheckoutIds} ids
 * @param {{ token: string, ctx: string }|null} sandbox
 * @param {object} callbacks
 */
function buildOpenOptions(ids, sandbox, callbacks) {
  /** @type {Record<string, unknown>} */
  const openOpts = {
    plan_id: ids.planId,
    // One-time / non-recurring
    billing_cycle: 'lifetime',
    disable_licenses_selector: true,
    purchaseCompleted: callbacks.purchaseCompleted,
    success: callbacks.success,
  }

  // Prefer exact Freemius pricing_id when configured for this tier.
  if (ids.pricingId) {
    openOpts.pricing_id = ids.pricingId
  } else {
    // Fallback: map file credits → license quantity for bulk lifetime prices.
    openOpts.licenses = ids.licenses
  }

  if (sandbox?.token && sandbox?.ctx != null) {
    openOpts.sandbox = {
      token: sandbox.token,
      ctx: sandbox.ctx,
    }
  }

  return openOpts
}

/**
 * Open Freemius overlay for a one-time healing-pass package.
 * @param {{
 *   packageId?: string,
 *   planId?: string,
 *   pricingId?: string,
 *   onPurchaseCompleted?: (data: object) => void,
 *   onSuccess?: (data: object) => void,
 *   onError?: (error: Error) => void,
 * }} [handlers]
 */
export async function openFreemiusCheckout(handlers = {}) {
  const {
    packageId,
    planId: planOverride,
    pricingId: pricingOverride,
    onPurchaseCompleted,
    onSuccess,
    onError,
  } = handlers

  const pkg = packageId ? getPackageById(packageId) : getPackageById('pass-1')
  if (!pkg) {
    const err = new Error(`Unknown healing package: ${packageId}`)
    onError?.(err)
    throw err
  }

  const resolved = resolvePackageCheckoutIds(pkg)
  const ids = {
    ...resolved,
    planId: sanitizeFreemiusId(planOverride) || resolved.planId,
    pricingId: sanitizeFreemiusId(pricingOverride) || resolved.pricingId,
  }

  const packageMeta = {
    packageId: pkg.id,
    files: pkg.files,
    planId: ids.planId,
    pricingId: ids.pricingId,
  }

  try {
    const { mode, sandbox } = await fetchFreemiusCheckoutMode()
    const handler = createCheckoutHandler(mode === 'sandbox' ? sandbox : null, ids.planId)

    const openOpts = buildOpenOptions(ids, mode === 'sandbox' ? sandbox : null, {
      purchaseCompleted: (data) => {
        storeFreemiusPurchase(data, packageMeta)
        onPurchaseCompleted?.(data)
      },
      success: (data) => {
        storeFreemiusPurchase(data, packageMeta)
        onSuccess?.(data)
      },
    })

    console.info(
      `[freemius] opening one-time checkout (${mode}) · ${pkg.id} · $${pkg.priceUsd} · ${pkg.files} file(s) · plan ${ids.planId}` +
        (ids.pricingId ? ` · pricing ${ids.pricingId}` : ` · licenses ${ids.licenses}`),
    )
    await handler.open(openOpts)
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}
