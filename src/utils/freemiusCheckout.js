/**
 * Freemius Checkout JS SDK integration (@freemius/checkout).
 * Opens the overlay modal for one-time data-healing file-credit packages.
 *
 * Env (Vite client):
 *   VITE_FREEMIUS_STORE_ID    — Freemius Store / developer store id
 *   VITE_FREEMIUS_PRODUCT_ID  — Product id
 *   VITE_FREEMIUS_PUBLIC_KEY  — Product public key (pk_…)
 *   VITE_FREEMIUS_PLAN_ID     — Legacy fallback plan (1-file tier)
 *   VITE_FREEMIUS_PLAN_ID_*   — Per-package one-time plan ids (see freemiusPricing.js)
 *   VITE_FREEMIUS_SANDBOX     — true only for local sandbox testing
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
  resolvePackagePlanId,
} from './freemiusPricing.js'

const FREEMIUS_PURCHASE_KEY = 'csv-hospital-freemius-purchase'

/** Public Freemius Overlay config from environment. */
export const FREEMIUS_CHECKOUT_CONFIG = {
  store_id: String(import.meta.env.VITE_FREEMIUS_STORE_ID || '').trim(),
  product_id: String(import.meta.env.VITE_FREEMIUS_PRODUCT_ID || '34967').trim(),
  plan_id: String(import.meta.env.VITE_FREEMIUS_PLAN_ID || '57500').trim(),
  public_key: String(
    import.meta.env.VITE_FREEMIUS_PUBLIC_KEY ||
      'pk_96bd363d5fbf016bebe4795ecda42',
  ).trim(),
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
 * @param {{ packageId?: string, files?: number, planId?: string }} [packageMeta]
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
    packageId: pkg?.id || packageMeta.packageId || null,
    filesGranted: pkg?.files || packageMeta.files || null,
    creditBalance: filesAdded,
    storeId: FREEMIUS_CHECKOUT_CONFIG.store_id || null,
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

/** True when stackable healing credits remain (or legacy unlock record). */
export function hasFreemiusUnlock() {
  if (hasHealingCredits()) return true
  return getFreemiusPurchase()?.unlocked === true
}

export { getHealingCreditBalance, hasHealingCredits }

/**
 * @returns {Promise<{ mode: 'live'|'sandbox', sandbox: { token: string, ctx: string }|null }>}
 */
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
  if (!FREEMIUS_CHECKOUT_CONFIG.product_id) {
    throw new Error('Missing VITE_FREEMIUS_PRODUCT_ID')
  }
  if (!FREEMIUS_CHECKOUT_CONFIG.public_key?.startsWith('pk_')) {
    throw new Error('Missing or invalid VITE_FREEMIUS_PUBLIC_KEY')
  }
}

/**
 * @param {{ token: string, ctx: string }|null} sandbox
 * @param {string} planId
 */
function createCheckoutHandler(sandbox, planId) {
  assertProductKeys()
  if (!planId) {
    throw new Error(
      'Missing Freemius plan id for this package. Set VITE_FREEMIUS_PLAN_ID_* in .env',
    )
  }

  /** @type {Record<string, unknown>} */
  const options = {
    product_id: FREEMIUS_CHECKOUT_CONFIG.product_id,
    plan_id: planId,
    public_key: FREEMIUS_CHECKOUT_CONFIG.public_key,
  }

  if (FREEMIUS_CHECKOUT_CONFIG.store_id) {
    options.store_id = FREEMIUS_CHECKOUT_CONFIG.store_id
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
 * Open Freemius overlay for a one-time (lifetime) healing-pass package.
 * @param {{
 *   packageId?: string,
 *   planId?: string,
 *   onPurchaseCompleted?: (data: object) => void,
 *   onSuccess?: (data: object) => void,
 *   onError?: (error: Error) => void,
 * }} [handlers]
 */
export async function openFreemiusCheckout(handlers = {}) {
  const { packageId, planId: planOverride, onPurchaseCompleted, onSuccess, onError } =
    handlers

  const pkg = packageId ? getPackageById(packageId) : getPackageById('pass-1')
  const planId =
    (planOverride && String(planOverride).trim()) ||
    (pkg ? resolvePackagePlanId(pkg) : '') ||
    FREEMIUS_CHECKOUT_CONFIG.plan_id

  const packageMeta = {
    packageId: pkg?.id || packageId || 'pass-1',
    files: pkg?.files || 1,
    planId,
  }

  try {
    const { mode, sandbox } = await fetchFreemiusCheckoutMode()
    const handler = createCheckoutHandler(mode === 'sandbox' ? sandbox : null, planId)

    /** @type {Record<string, unknown>} */
    const openOpts = {
      plan_id: planId,
      licenses: 1,
      // One-time / non-recurring Freemius purchase
      billing_cycle: 'lifetime',
      disable_licenses_selector: true,
      purchaseCompleted: (data) => {
        storeFreemiusPurchase(data, packageMeta)
        onPurchaseCompleted?.(data)
      },
      success: (data) => {
        // Credits already stacked in purchaseCompleted when Freemius fires both.
        storeFreemiusPurchase(data, packageMeta)
        onSuccess?.(data)
      },
    }

    if (mode === 'sandbox' && sandbox?.token && sandbox?.ctx != null) {
      openOpts.sandbox = {
        token: sandbox.token,
        ctx: sandbox.ctx,
      }
    }

    console.info(
      `[freemius] opening one-time checkout (${mode}) · ${packageMeta.packageId} · ${packageMeta.files} file credit(s) · plan ${planId}`,
    )
    await handler.open(openOpts)
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}
