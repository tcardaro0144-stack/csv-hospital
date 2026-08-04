/**
 * Freemius Checkout JS SDK integration (@freemius/checkout).
 * Opens the overlay modal for data-healing (discharge) unlocks.
 *
 * Env (Vite client):
 *   VITE_FREEMIUS_STORE_ID    — Freemius Store / developer store id
 *   VITE_FREEMIUS_PRODUCT_ID  — Product id
 *   VITE_FREEMIUS_PUBLIC_KEY  — Product public key (pk_…)
 *   VITE_FREEMIUS_PLAN_ID     — Plan id (passed to open())
 *   VITE_FREEMIUS_SANDBOX     — true only for local sandbox testing
 */

import { Checkout } from '@freemius/checkout'
import { apiUrl } from './apiBase.js'
import { fetchJson } from './fetchJson.js'

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
 * Persist Freemius purchase payload locally for unlock / discharge.
 * @param {object} data
 */
export function storeFreemiusPurchase(data) {
  if (!data || typeof data !== 'object') return false

  const purchase = data.purchase || data
  const user = data.user || null
  const purchaseId =
    purchase?.id ||
    purchase?.purchase_id ||
    data.purchase_id ||
    null

  const record = {
    unlocked: true,
    provider: 'freemius',
    status: 'paid',
    purchaseId: purchaseId != null ? String(purchaseId) : null,
    userEmail: user?.email || data.email || null,
    userId: user?.id != null ? String(user.id) : null,
    licenseId: data.license?.id != null ? String(data.license.id) : null,
    planId:
      purchase?.plan_id != null
        ? String(purchase.plan_id)
        : FREEMIUS_CHECKOUT_CONFIG.plan_id,
    storeId: FREEMIUS_CHECKOUT_CONFIG.store_id || null,
    productId: FREEMIUS_CHECKOUT_CONFIG.product_id,
    raw: data,
    verifiedAt: new Date().toISOString(),
  }

  localStorage.setItem(FREEMIUS_PURCHASE_KEY, JSON.stringify(record))
  localStorage.setItem(
    'csv-hospital-pro',
    JSON.stringify({
      unlocked: true,
      status: 'paid',
      provider: 'freemius',
      purchaseId: record.purchaseId,
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
  return getFreemiusPurchase()?.unlocked === true
}

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

function assertCheckoutConfig() {
  if (!FREEMIUS_CHECKOUT_CONFIG.product_id) {
    throw new Error('Missing VITE_FREEMIUS_PRODUCT_ID')
  }
  if (!FREEMIUS_CHECKOUT_CONFIG.public_key?.startsWith('pk_')) {
    throw new Error('Missing or invalid VITE_FREEMIUS_PUBLIC_KEY')
  }
  if (!FREEMIUS_CHECKOUT_CONFIG.plan_id) {
    throw new Error('Missing VITE_FREEMIUS_PLAN_ID')
  }
}

/**
 * Build Checkout instance from env (+ optional sandbox).
 * Prefers the npm SDK; falls back to CDN `window.FS.Checkout` if needed.
 * @param {{ token: string, ctx: string }|null} sandbox
 */
function createCheckoutHandler(sandbox) {
  assertCheckoutConfig()

  /** @type {Record<string, unknown>} */
  const options = {
    product_id: FREEMIUS_CHECKOUT_CONFIG.product_id,
    plan_id: FREEMIUS_CHECKOUT_CONFIG.plan_id,
    public_key: FREEMIUS_CHECKOUT_CONFIG.public_key,
  }

  // Store id is optional for overlay; include when configured (ops / dashboard mapping).
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
 * Open Freemius overlay checkout for a data-healing (discharge) pass.
 * @param {{
 *   onPurchaseCompleted?: (data: object) => void,
 *   onSuccess?: (data: object) => void,
 *   onError?: (error: Error) => void,
 * }} [handlers]
 */
export async function openFreemiusCheckout(handlers = {}) {
  const { onPurchaseCompleted, onSuccess, onError } = handlers

  try {
    const { mode, sandbox } = await fetchFreemiusCheckoutMode()
    const handler = createCheckoutHandler(mode === 'sandbox' ? sandbox : null)

    /** @type {Record<string, unknown>} */
    const openOpts = {
      plan_id: FREEMIUS_CHECKOUT_CONFIG.plan_id,
      licenses: 1,
      purchaseCompleted: (data) => {
        storeFreemiusPurchase(data)
        onPurchaseCompleted?.(data)
      },
      success: (data) => {
        storeFreemiusPurchase(data)
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
      `[freemius] opening checkout (${mode}) · product ${FREEMIUS_CHECKOUT_CONFIG.product_id}` +
        (FREEMIUS_CHECKOUT_CONFIG.store_id
          ? ` · store ${FREEMIUS_CHECKOUT_CONFIG.store_id}`
          : ''),
    )
    await handler.open(openOpts)
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}
