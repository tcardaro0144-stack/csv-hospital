/**
 * Freemius Checkout JS SDK integration (@freemius/checkout).
 * Opens one-time (lifetime) overlay checkout for data-healing file credits.
 *
 * Only valid Freemius options are sent — empty/invalid IDs are omitted so the
 * overlay does not throw Checkout Loading / validation errors.
 *
 * When per-tier pricing IDs are unset:
 *   - default: open shared plan (57500) with lifetime billing only
 *   - optional licenses fallback (opt-in env)
 *   - optional mock checkout (VITE_FREEMIUS_MOCK) for local credit grants
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
  FREEMIUS_DEFAULT_TEST_IDS,
  getPackageById,
  resolvePackageCheckoutIds,
  sanitizeFreemiusId,
} from './freemiusPricing.js'

const FREEMIUS_PURCHASE_KEY = 'csv-hospital-freemius-purchase'

/** Public Freemius product keys (constructor-safe). Always falls back to test defaults. */
export const FREEMIUS_CHECKOUT_CONFIG = {
  product_id:
    sanitizeFreemiusId(import.meta.env.VITE_FREEMIUS_PRODUCT_ID) ||
    FREEMIUS_DEFAULT_TEST_IDS.productId,
  plan_id:
    sanitizeFreemiusId(import.meta.env.VITE_FREEMIUS_PLAN_ID) ||
    FREEMIUS_DEFAULT_TEST_IDS.planId,
  public_key: String(
    import.meta.env.VITE_FREEMIUS_PUBLIC_KEY ||
      FREEMIUS_DEFAULT_TEST_IDS.publicKey,
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
    provider: data.provider || 'freemius',
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
      provider: record.provider,
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
    if (parsed?.unlocked === true && parsed?.provider) {
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
  const safePlan =
    sanitizeFreemiusId(planId) ||
    FREEMIUS_CHECKOUT_CONFIG.plan_id ||
    FREEMIUS_DEFAULT_TEST_IDS.planId

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
 * Omits pricing_id / licenses unless the resolved strategy says so —
 * inventing those values causes Freemius validation / loading errors.
 * @param {import('./freemiusPricing.js').FreemiusCheckoutIds} ids
 * @param {{ token: string, ctx: string }|null} sandbox
 * @param {object} callbacks
 */
function buildOpenOptions(ids, sandbox, callbacks) {
  /** @type {Record<string, unknown>} */
  const openOpts = {
    plan_id: ids.planId,
    billing_cycle: 'lifetime',
    disable_licenses_selector: true,
    purchaseCompleted: callbacks.purchaseCompleted,
    success: callbacks.success,
  }

  if (ids.strategy === 'pricing_id' && ids.pricingId) {
    openOpts.pricing_id = ids.pricingId
  } else if (ids.strategy === 'licenses') {
    openOpts.licenses = ids.licenses
  }
  // plan_default / mock: plan_id + lifetime only — no pricing_id, no licenses

  if (sandbox?.token && sandbox?.ctx != null) {
    openOpts.sandbox = {
      token: sandbox.token,
      ctx: sandbox.ctx,
    }
  }

  return openOpts
}

/**
 * Local mock purchase — grants package credits without opening Freemius.
 * Used when VITE_FREEMIUS_MOCK=true so missing pricing IDs never throw.
 * @param {import('./freemiusPricing.js').HealingPassPackage} pkg
 * @param {import('./freemiusPricing.js').FreemiusCheckoutIds} ids
 * @param {object} handlers
 */
function completeMockCheckout(pkg, ids, handlers) {
  const mockPayload = {
    provider: 'freemius-mock',
    purchase_id: `mock-${pkg.id}-${Date.now()}`,
    plan_id: ids.planId,
    pricing_id: ids.pricingId,
    purchase: {
      id: `mock-${pkg.id}-${Date.now()}`,
      plan_id: ids.planId,
      pricing_id: ids.pricingId,
    },
    mock: true,
    packageId: pkg.id,
    files: pkg.files,
  }

  const packageMeta = {
    packageId: pkg.id,
    files: pkg.files,
    planId: ids.planId,
    pricingId: ids.pricingId,
  }

  console.info(
    `[freemius] mock checkout · ${pkg.id} · $${pkg.priceUsd} · ${pkg.files} file(s) · plan ${ids.planId}`,
  )

  storeFreemiusPurchase(mockPayload, packageMeta)
  handlers.onPurchaseCompleted?.(mockPayload)
  handlers.onSuccess?.(mockPayload)
  return mockPayload
}

/**
 * Open Freemius overlay for a one-time healing-pass package.
 * Falls back cleanly when pricing IDs are unset (plan default or mock).
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
  const overridePricing = sanitizeFreemiusId(pricingOverride)
  const ids = {
    ...resolved,
    planId: sanitizeFreemiusId(planOverride) || resolved.planId,
    pricingId: overridePricing || resolved.pricingId,
    strategy: overridePricing ? 'pricing_id' : resolved.strategy,
  }

  const packageMeta = {
    packageId: pkg.id,
    files: pkg.files,
    planId: ids.planId,
    pricingId: ids.pricingId,
  }

  // Mock path: never call Freemius when pricing rows aren't wired yet.
  if (ids.strategy === 'mock') {
    try {
      return completeMockCheckout(pkg, ids, {
        onPurchaseCompleted,
        onSuccess,
      })
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)))
      throw error
    }
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

    const strategyNote =
      ids.strategy === 'pricing_id'
        ? `pricing ${ids.pricingId}`
        : ids.strategy === 'licenses'
          ? `licenses ${ids.licenses}`
          : 'plan_default (no pricing_id)'

    console.info(
      `[freemius] opening one-time checkout (${mode}) · ${pkg.id} · $${pkg.priceUsd} · ${pkg.files} file(s) · plan ${ids.planId} · ${strategyNote}`,
    )
    await handler.open(openOpts)
  } catch (error) {
    // Soft recovery: if Freemius rejects missing/invalid pricing in non-prod,
    // complete a mock grant so the UI never hard-fails on validation.
    const canSoftMock =
      !import.meta.env.PROD &&
      (ids.strategy === 'plan_default' || ids.strategy === 'licenses')

    if (canSoftMock) {
      console.warn(
        '[freemius] overlay failed — completing local mock checkout instead',
        error,
      )
      try {
        return completeMockCheckout(pkg, { ...ids, strategy: 'mock' }, {
          onPurchaseCompleted,
          onSuccess,
        })
      } catch (mockErr) {
        onError?.(mockErr instanceof Error ? mockErr : new Error(String(mockErr)))
        throw mockErr
      }
    }

    onError?.(error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}
