/**
 * Freemius Checkout JS SDK integration (@freemius/checkout).
 * Opens one-time (lifetime) overlay checkout for data-healing file credits.
 *
 * Critical: never pass conflicting purchase params (e.g. pricing_id together
 * with licenses/billing_cycle, or a constructor plan_id that fights open()).
 * Each tier uses buildOneTimePurchaseParams() for a clean exclusive payload.
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
  buildOneTimePurchaseParams,
  getPackageById,
  getPackageByPlanId,
  resolvePackageCheckoutIds,
  sanitizeFreemiusId,
} from './freemiusPricing.js'

const FREEMIUS_PURCHASE_KEY = 'csv-hospital-freemius-purchase'

/**
 * Public Freemius product keys for the Checkout constructor.
 * Intentionally omits plan_id — plan/pricing belong only in open() so tier
 * selection cannot conflict with a stale constructor plan (e.g. 57588).
 */
export const FREEMIUS_CHECKOUT_CONFIG = {
  product_id:
    sanitizeFreemiusId(import.meta.env.VITE_FREEMIUS_PRODUCT_ID) ||
    FREEMIUS_DEFAULT_TEST_IDS.productId,
  /** Default plan for docs / data attrs — not passed into FS.Checkout ctor. */
  plan_id:
    sanitizeFreemiusId(import.meta.env.VITE_FREEMIUS_PLAN_ID) ||
    FREEMIUS_DEFAULT_TEST_IDS.planId,
  public_key: String(
    import.meta.env.VITE_FREEMIUS_PUBLIC_KEY ||
      FREEMIUS_DEFAULT_TEST_IDS.publicKey,
  ).trim(),
  // Store id is ops metadata only — never passed into FS.Checkout.
  store_id: String(import.meta.env.VITE_FREEMIUS_STORE_ID || '').trim(),
  /** True only when VITE_FREEMIUS_SANDBOX explicitly enables test overlay. */
  get isSandbox() {
    return isClientFreemiusSandboxEnabled()
  },
}

/**
 * Parse VITE_FREEMIUS_SANDBOX. Explicit true/false wins over host/build defaults.
 * @returns {boolean|null} null when unset / unrecognized
 */
function isViteFreemiusSandboxFlag() {
  const v = String(import.meta.env.VITE_FREEMIUS_SANDBOX ?? '')
    .trim()
    .toLowerCase()
  if (/^(1|true|yes|on|sandbox)$/.test(v)) return true
  if (/^(0|false|no|off|live|production)$/.test(v)) return false
  return null
}

/**
 * Whether the client should open Freemius in sandbox (test) mode.
 * Production default is LIVE. Sandbox requires VITE_FREEMIUS_SANDBOX=true.
 */
export function isClientFreemiusSandboxEnabled() {
  const flag = isViteFreemiusSandboxFlag()
  if (flag === true) return true
  if (flag === false) return false

  // Unset: never sandbox on production hosts / production builds / localhost.
  // Opt in explicitly with VITE_FREEMIUS_SANDBOX=true for test-card flows.
  return false
}

/**
 * Live checkout = no sandbox token.
 * Inverse of isClientFreemiusSandboxEnabled().
 */
export function isClientFreemiusLiveMode() {
  return !isClientFreemiusSandboxEnabled()
}

/**
 * Persist Freemius purchase + stack file credits for the package.
 * Freemius may call purchaseCompleted/success with null — still grant from packageMeta.
 * @param {object|null|undefined} data
 * @param {{ packageId?: string, files?: number, planId?: string, pricingId?: string|null }} [packageMeta]
 */
export function storeFreemiusPurchase(data, packageMeta = {}) {
  const payload =
    data && typeof data === 'object' && !Array.isArray(data) ? data : {}

  const purchase =
    payload.purchase && typeof payload.purchase === 'object'
      ? payload.purchase
      : payload
  const user = payload.user || null
  const purchaseId =
    purchase?.id ||
    purchase?.purchase_id ||
    payload.purchase_id ||
    null
  const planId =
    purchase?.plan_id ??
    payload.plan_id ??
    packageMeta.planId ??
    null
  const pricingId =
    purchase?.pricing_id ??
    payload.pricing_id ??
    packageMeta.pricingId ??
    null

  const pkg =
    (packageMeta.packageId && getPackageById(packageMeta.packageId)) ||
    getPackageByPlanId(planId, pricingId) ||
    null

  const files =
    Number(packageMeta.files) > 0
      ? Number(packageMeta.files)
      : pkg?.files || 0

  if (files < 1 && !pkg) {
    console.warn(
      '[freemius] storeFreemiusPurchase skipped — no packageMeta.files/packageId and empty Freemius payload',
      { data, packageMeta },
    )
    return false
  }

  const filesAdded = addHealingCredits({
    packageId: pkg?.id || packageMeta.packageId,
    files: files || pkg?.files,
    planId,
    pricingId,
    purchaseId: purchaseId != null ? String(purchaseId) : null,
    raw: payload,
  })

  if (filesAdded < 1 && getHealingCreditBalance() < 1) {
    console.warn('[freemius] storeFreemiusPurchase — credits still zero after grant attempt', {
      packageMeta,
      planId,
      pricingId,
    })
  }

  const record = {
    unlocked: getHealingCreditBalance() > 0 || filesAdded > 0,
    provider: payload.provider || 'freemius',
    status: 'paid',
    billing: 'one_time',
    purchaseId: purchaseId != null ? String(purchaseId) : null,
    userEmail: user?.email || payload.email || null,
    userId: user?.id != null ? String(user.id) : null,
    licenseId: payload.license?.id != null ? String(payload.license.id) : null,
    planId: planId != null ? String(planId) : null,
    pricingId: pricingId != null ? String(pricingId) : null,
    packageId: pkg?.id || packageMeta.packageId || null,
    filesGranted: pkg?.files || packageMeta.files || null,
    creditBalance: getHealingCreditBalance(),
    productId: FREEMIUS_CHECKOUT_CONFIG.product_id,
    raw: payload,
    verifiedAt: new Date().toISOString(),
  }

  localStorage.setItem(FREEMIUS_PURCHASE_KEY, JSON.stringify(record))
  localStorage.setItem(
    'csv-hospital-pro',
    JSON.stringify({
      unlocked: record.unlocked,
      status: 'paid',
      provider: record.provider,
      billing: 'one_time',
      purchaseId: record.purchaseId,
      creditBalance: record.creditBalance,
      verifiedAt: record.verifiedAt,
    }),
  )
  return record.unlocked
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
    return {
      mode: 'live',
      sandbox: null,
      isSandbox: false,
      is_sandbox: false,
      product_id: FREEMIUS_CHECKOUT_CONFIG.product_id,
      plan_id: FREEMIUS_CHECKOUT_CONFIG.plan_id,
      public_key: FREEMIUS_CHECKOUT_CONFIG.public_key,
    }
  }

  // Sandbox requires a server-minted { token, ctx }. Never silently fall back to live.
  return fetchSandboxModeFromApi({ requireSandbox: true })
}

/**
 * @param {{ requireSandbox?: boolean }} [opts]
 */
async function fetchSandboxModeFromApi(opts = {}) {
  const requireSandbox = opts.requireSandbox === true
  const url = apiUrl('/api/freemius-sandbox')
  try {
    const data = await fetchJson(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })

    if (data?.error) {
      throw new Error(String(data.error))
    }

    const token =
      data?.sandbox?.token ||
      data?.sandbox_token ||
      null
    const ctx =
      data?.sandbox?.ctx ??
      data?.timestamp ??
      data?.s_ctx_ts ??
      null

    const hasToken =
      data?.mode === 'sandbox' && token && ctx != null && ctx !== ''

    if (hasToken) {
      return {
        mode: 'sandbox',
        isSandbox: true,
        is_sandbox: true,
        product_id: sanitizeFreemiusId(data.product_id) || null,
        plan_id: sanitizeFreemiusId(data.plan_id) || null,
        public_key:
          typeof data.public_key === 'string' && data.public_key.startsWith('pk_')
            ? data.public_key.trim()
            : null,
        // Checkout session payload Freemius overlay expects
        sandbox: {
          token: String(token),
          ctx: String(ctx),
        },
        sandbox_token: String(token),
        timestamp: String(ctx),
        hosted_sandbox_url:
          typeof data.hosted_sandbox_url === 'string'
            ? data.hosted_sandbox_url
            : null,
        hosted_app_sandbox_url:
          typeof data.hosted_app_sandbox_url === 'string'
            ? data.hosted_app_sandbox_url
            : null,
      }
    }

    if (requireSandbox) {
      throw new Error(
        data?.mode === 'live'
          ? 'API returned live Freemius mode. Set FREEMIUS_SANDBOX=true (and restart npm run dev:server).'
          : 'Freemius sandbox token missing from /api/freemius-sandbox. Confirm FREEMIUS_SECRET_KEY and restart the API.',
      )
    }

    return { mode: 'live', sandbox: null, isSandbox: false }
  } catch (err) {
    if (requireSandbox) {
      const message =
        err instanceof Error ? err.message : String(err || 'sandbox API failed')
      console.error('[freemius] sandbox required but unavailable:', message)
      throw new Error(
        `Freemius sandbox unavailable: ${message}. Start the API (npm run dev:server) with FREEMIUS_SANDBOX=true.`,
      )
    }
    console.warn(
      '[freemius] sandbox API unavailable — using LIVE checkout',
      err?.message || err,
    )
    return { mode: 'live', sandbox: null, isSandbox: false }
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
 * Freemius overlay sandbox flag.
 * Official parameter is exactly `sandbox: { token, ctx }` — the Checkout SDK
 * maps that to iframe query params `sandbox=<token>&s_ctx_ts=<ctx>`.
 * @param {{ token: string, ctx: string }|null|undefined} sandbox
 * @returns {{ token: string, ctx: string }|null}
 */
function normalizeSandboxPayload(sandbox) {
  if (!sandbox?.token || sandbox?.ctx == null || sandbox.ctx === '') return null
  return {
    token: String(sandbox.token),
    ctx: String(sandbox.ctx),
  }
}

/**
 * Attach sandbox mode onto Checkout ctor / open() options.
 * Official Overlay parameter is ONLY `sandbox: { token, ctx }`.
 * Extra aliases (sandbox_token / is_sandbox / s_ctx_ts) get serialized into the
 * iframe query by @freemius/checkout and can keep Freemius from entering
 * sandbox — so we intentionally do not pass them.
 * @param {Record<string, unknown>} options
 * @param {{ token: string, ctx: string }|null|undefined} sandbox
 */
function applySandboxCheckoutFlag(options, sandbox) {
  const normalized = normalizeSandboxPayload(sandbox)
  if (!normalized) return options

  options.sandbox = {
    token: normalized.token,
    ctx: normalized.ctx,
  }
  return options
}

/**
 * After the overlay mounts, confirm the iframe query carries sandbox=.
 * URL presence ≠ Freemius accepted the token. Stripe “live mode” + card 4242
 * means the token was rejected (usually wrong secret/public for this product).
 * Real litmus in the overlay UI: “Prefill Form (Only visible in Sandbox Mode)”.
 * @param {{ token: string, ctx: string }} sandbox
 */
function assertOverlayIframeIsSandbox(sandbox) {
  if (typeof document === 'undefined') return
  const iframes = Array.from(
    document.querySelectorAll('iframe[id^="fs-checkout-page-"]'),
  )
  const hit = iframes.find((el) => {
    const src = String(el.getAttribute('src') || '')
    return (
      src.includes(`sandbox=${encodeURIComponent(sandbox.token)}`) ||
      src.includes(`sandbox=${sandbox.token}`)
    )
  })
  if (!hit) {
    const srcs = iframes.map((el) => el.getAttribute('src') || '(empty)')
    console.error(
      '[freemius] overlay iframe missing sandbox= query — test card 4242 will fail. iframe src(s):',
      srcs,
    )
    throw new Error(
      'Freemius overlay opened without sandbox token in the iframe URL. Reload, confirm FREEMIUS_SANDBOX=true, and retry Buy.',
    )
  }
  console.info(
    '[freemius] overlay iframe has sandbox= query. Litmus check: look for “Prefill Form (Only visible in Sandbox Mode)” in the overlay. If that link is missing, Freemius rejected the token (wrong product secret/public key) and 4242 will decline as live.',
  )
}

/**
 * FS.Checkout constructor — product keys only.
 * Never pass plan_id / pricing_id / licenses / billing_cycle here.
 * @param {{ token: string, ctx: string, is_sandbox?: boolean }|null} sandbox
 * @param {{ product_id?: string|null, public_key?: string|null }} [productKeys]
 */
function createCheckoutHandler(sandbox, productKeys = {}) {
  assertProductKeys()

  const productId =
    sanitizeFreemiusId(productKeys.product_id) ||
    FREEMIUS_CHECKOUT_CONFIG.product_id
  const publicKey =
    (typeof productKeys.public_key === 'string' &&
      productKeys.public_key.startsWith('pk_') &&
      productKeys.public_key.trim()) ||
    FREEMIUS_CHECKOUT_CONFIG.public_key

  /** @type {Record<string, unknown>} */
  const options = {
    product_id: productId,
    public_key: publicKey,
  }

  applySandboxCheckoutFlag(options, sandbox)

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
 * Build open() payload: exclusive one-time purchase params + callbacks.
 * @param {import('./freemiusPricing.js').FreemiusCheckoutIds} ids
 * @param {{ token: string, ctx: string }|null} sandbox
 * @param {object} callbacks
 */
function buildOpenOptions(ids, sandbox, callbacks) {
  const purchase = buildOneTimePurchaseParams(ids)
  if (!purchase) {
    throw new Error('Unable to build Freemius one-time purchase params.')
  }

  /** @type {Record<string, unknown>} */
  const openOpts = {
    ...purchase,
    purchaseCompleted: callbacks.purchaseCompleted,
    success: callbacks.success,
    afterOpen: callbacks.afterOpen,
  }

  applySandboxCheckoutFlag(openOpts, sandbox)

  return openOpts
}

/**
 * True only on localhost / 127.0.0.1 (never production hosts).
 */
export function isLocalhostFreemiusTestHost() {
  if (typeof window === 'undefined') return false
  const host = String(window.location.hostname || '').toLowerCase()
  return host === 'localhost' || host === '127.0.0.1'
}

/**
 * Whether local 4242 mock completion is allowed right now.
 * localhost only — never on csvhospital.com / production builds on real hosts.
 */
export function isLocalFreemiusMockAllowed() {
  if (!isLocalhostFreemiusTestHost()) return false
  if (import.meta.env.PROD) {
    // Still allow explicit localhost prod preview only.
    return true
  }
  return true
}

/**
 * Build / fetch a Freemius-shaped success payload for local test card 4242.
 * Prefers backend POST /api/freemius-mock-complete; falls back to client payload.
 * @param {{
 *   packageId?: string,
 *   files?: number,
 *   planId?: string,
 *   pricingId?: string|null,
 * }} meta
 */
export async function fetchLocalFreemiusMockSuccess(meta = {}) {
  if (!isLocalFreemiusMockAllowed()) {
    throw new Error('Freemius local mock is only available on localhost.')
  }

  try {
    const data = await fetchJson(apiUrl('/api/freemius-mock-complete'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        testCard: '4242',
        packageId: meta.packageId || 'pass-1',
        files: meta.files,
        planId: meta.planId,
        pricingId: meta.pricingId ?? null,
        productId: FREEMIUS_CHECKOUT_CONFIG.product_id,
      }),
    })
    if (data?.freemius && typeof data.freemius === 'object') {
      return data.freemius
    }
  } catch (err) {
    console.warn(
      '[freemius] local mock API unavailable — using client-side mock payload',
      err?.message || err,
    )
  }

  const purchaseId = `local-4242-${meta.packageId || 'pass-1'}-${Date.now()}`
  return {
    provider: 'freemius-local-mock',
    mock: true,
    local_test: true,
    test_card: '4242',
    is_sandbox: true,
    product_id: FREEMIUS_CHECKOUT_CONFIG.product_id,
    plan_id: meta.planId || FREEMIUS_CHECKOUT_CONFIG.plan_id,
    pricing_id: meta.pricingId ?? null,
    purchase_id: purchaseId,
    purchase: {
      id: purchaseId,
      plan_id: meta.planId || FREEMIUS_CHECKOUT_CONFIG.plan_id,
      pricing_id: meta.pricingId ?? null,
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
    license: { id: `local-license-${Date.now()}` },
    packageId: meta.packageId || 'pass-1',
    files: meta.files || 1,
  }
}

/**
 * Run the same credit-grant / success path as a Freemius purchaseCompleted callback.
 * Localhost + test card 4242 only.
 * @param {{
 *   packageId?: string,
 *   planId?: string,
 *   pricingId?: string,
 *   onPurchaseCompleted?: (data: object) => void,
 *   onSuccess?: (data: object) => void,
 *   onError?: (error: Error) => void,
 * }} [handlers]
 */
export async function completeLocalFreemiusMockPurchase(handlers = {}) {
  const {
    packageId,
    planId: planOverride,
    pricingId: pricingOverride,
    onPurchaseCompleted,
    onSuccess,
    onError,
  } = handlers

  if (!isLocalFreemiusMockAllowed()) {
    const err = new Error('Freemius local mock is only available on localhost.')
    onError?.(err)
    throw err
  }

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
    const payload = await fetchLocalFreemiusMockSuccess({
      packageId: pkg.id,
      files: pkg.files,
      planId: ids.planId,
      pricingId: ids.pricingId,
    })

    console.info(
      `[freemius] local mock success (4242) · ${pkg.id} · $${pkg.priceUsd} · ${pkg.files} file(s)`,
    )

    storeFreemiusPurchase(payload, packageMeta)
    onPurchaseCompleted?.(payload)
    onSuccess?.(payload)
    return payload
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}

/**
 * Open Freemius overlay for a one-time healing-pass package.
 * On localhost, pass `{ localTestCard: '4242' }` (or Shift+click the buy button)
 * to grant credits via the mock completion handler without Freemius gateway.
 * @param {{
 *   packageId?: string,
 *   planId?: string,
 *   pricingId?: string,
 *   localTestCard?: string,
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
    localTestCard,
    onPurchaseCompleted,
    onSuccess,
    onError,
  } = handlers

  const wantsLocal4242 =
    String(localTestCard || '')
      .replace(/\s+/g, '')
      .startsWith('4242') ||
    (typeof window !== 'undefined' &&
      /(?:\?|&)freemius_test=4242(?:&|$)/.test(window.location.search || ''))

  if (wantsLocal4242) {
    return completeLocalFreemiusMockPurchase({
      packageId,
      planId: planOverride,
      pricingId: pricingOverride,
      onPurchaseCompleted,
      onSuccess,
      onError,
    })
  }

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
    strategy: overridePricing ? 'pricing' : resolved.strategy,
  }

  const packageMeta = {
    packageId: pkg.id,
    files: pkg.files,
    planId: ids.planId,
    pricingId: ids.pricingId,
  }

  try {
    const checkoutMode = await fetchFreemiusCheckoutMode()
    const { mode, sandbox } = checkoutMode
    const sandboxPayload =
      mode === 'sandbox' ? normalizeSandboxPayload(sandbox) : null

    if (mode === 'sandbox' && !sandboxPayload) {
      throw new Error(
        'Freemius sandbox mode is on but sandbox.token/ctx are missing — overlay would charge live.',
      )
    }

    // Prefer server-minted product/plan so frontend stays locked to the token.
    const apiProductId = sanitizeFreemiusId(checkoutMode.product_id)
    const apiPlanId = sanitizeFreemiusId(checkoutMode.plan_id)
    const apiPublicKey =
      typeof checkoutMode.public_key === 'string' ? checkoutMode.public_key : null

    if (apiPlanId) {
      ids.planId = apiPlanId
      packageMeta.planId = apiPlanId
    }

    // Freemius docs: pass sandbox on the Checkout constructor (and again on open).
    const handler = createCheckoutHandler(sandboxPayload, {
      product_id: apiProductId,
      public_key: apiPublicKey,
    })
    const openOpts = buildOpenOptions(ids, sandboxPayload, {
      purchaseCompleted: (data) => {
        console.info('[freemius] purchaseCompleted', {
          packageId: packageMeta.packageId,
          purchaseId: data?.purchase?.id || data?.purchase_id || null,
          hasPayload: Boolean(data && typeof data === 'object'),
        })
        const unlocked = storeFreemiusPurchase(data, packageMeta)
        console.info('[freemius] credits after purchaseCompleted', {
          unlocked,
          balance: getHealingCreditBalance(),
        })
        // Always notify the app with packageMeta so the UI unlocks even if
        // Freemius sent null / the button callback forgot package fields.
        if (typeof window !== 'undefined') {
          const safe = data && typeof data === 'object' ? data : {}
          window.dispatchEvent(
            new CustomEvent('freemius:purchaseCompleted', {
              detail: {
                ...safe,
                packageId: packageMeta.packageId,
                files: packageMeta.files,
                planId: packageMeta.planId,
                pricingId: packageMeta.pricingId,
              },
            }),
          )
        }
        onPurchaseCompleted?.(data)
      },
      success: (data) => {
        storeFreemiusPurchase(data, packageMeta)
        if (typeof window !== 'undefined') {
          const safe = data && typeof data === 'object' ? data : {}
          window.dispatchEvent(
            new CustomEvent('freemius:purchaseCompleted', {
              detail: {
                ...safe,
                packageId: packageMeta.packageId,
                files: packageMeta.files,
                planId: packageMeta.planId,
                pricingId: packageMeta.pricingId,
              },
            }),
          )
        }
        onSuccess?.(data)
      },
      afterOpen: () => {
        if (sandboxPayload) {
          try {
            assertOverlayIframeIsSandbox(sandboxPayload)
          } catch (err) {
            onError?.(err instanceof Error ? err : new Error(String(err)))
          }
        }
      },
    })

    if (sandboxPayload && !openOpts.sandbox?.token) {
      throw new Error(
        'Freemius open() payload missing sandbox flag (token/ctx) — refusing live charge.',
      )
    }

    const purchaseNote =
      ids.strategy === 'pricing'
        ? `pricing_id=${openOpts.pricing_id}`
        : `licenses=${openOpts.licenses} · billing_cycle=lifetime`

    if (sandboxPayload && checkoutMode.hosted_sandbox_url) {
      console.info(
        '[freemius] hosted sandbox litmus URL (open in a tab; must show Prefill Form):',
        checkoutMode.hosted_sandbox_url,
      )
    }

    console.info(
      `[freemius] opening one-time checkout (${mode}${sandboxPayload ? ' · sandbox={token,ctx}' : ''}) · product=${apiProductId || FREEMIUS_CHECKOUT_CONFIG.product_id} · public_key=${(apiPublicKey || FREEMIUS_CHECKOUT_CONFIG.public_key || '').slice(0, 10)}… · ${pkg.id} · $${pkg.priceUsd} · ${pkg.files} file(s) · plan_id=${openOpts.plan_id} · ${purchaseNote}`,
    )
    await handler.open(openOpts)
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}
