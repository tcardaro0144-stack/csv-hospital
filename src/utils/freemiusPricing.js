/**
 * One-time Freemius data-healing pass packages (flat file credits).
 *
 * Each UI tier maps to a Freemius one-time (lifetime) checkout config.
 * File counts are OUR credit units — never Freemius multi-site `licenses`.
 *
 * Freemius open() modes (mutually exclusive — never combine):
 *   pricing  → { plan_id, pricing_id }           // exact price row
 *   plan     → { plan_id, licenses: 1, billing_cycle: 'lifetime' }
 *   mock     → local credit grant (VITE_FREEMIUS_MOCK)
 *
 * Env:
 *   VITE_FREEMIUS_PLAN_ID              — shared one-time plan (default 57500)
 *   VITE_FREEMIUS_PLAN_ID_{N}          — per-tier plan (preferred when each price is its own plan)
 *   VITE_FREEMIUS_PRICING_ID_{N}       — per-tier pricing_id under the plan
 *   VITE_FREEMIUS_MOCK                 — local mock checkout
 */

/**
 * @typedef {{
 *   id: string,
 *   files: number,
 *   priceUsd: number,
 *   label: string,
 *   planEnvKey: string,
 *   pricingEnvKey: string,
 * }} HealingPassPackage
 */

/**
 * @typedef {'pricing'|'plan'|'mock'} FreemiusCheckoutStrategy
 */

/**
 * @typedef {{
 *   packageId: string,
 *   files: number,
 *   priceUsd: number,
 *   planId: string,
 *   pricingId: string|null,
 *   strategy: FreemiusCheckoutStrategy,
 * }} FreemiusCheckoutIds
 */

/** Known-good Freemius defaults (CSV Hospital product). */
export const FREEMIUS_DEFAULT_TEST_IDS = {
  productId: '34967',
  planId: '57500',
  publicKey: 'pk_96bd363d5fbf016bebe4795ecda42',
}

/**
 * Flat non-recurring tiers — amounts are display/credit mapping truth.
 * Freemius IDs come from env (Dashboard → Plans / Pricing).
 * @type {HealingPassPackage[]}
 */
export const HEALING_PASS_PACKAGES = [
  {
    id: 'pass-1',
    files: 1,
    priceUsd: 2.99,
    label: '1 file',
    planEnvKey: 'VITE_FREEMIUS_PLAN_ID_1',
    pricingEnvKey: 'VITE_FREEMIUS_PRICING_ID_1',
  },
  {
    id: 'pass-5',
    files: 5,
    priceUsd: 11.99,
    label: '5 files',
    planEnvKey: 'VITE_FREEMIUS_PLAN_ID_5',
    pricingEnvKey: 'VITE_FREEMIUS_PRICING_ID_5',
  },
  {
    id: 'pass-15',
    files: 15,
    priceUsd: 29.99,
    label: '15 files',
    planEnvKey: 'VITE_FREEMIUS_PLAN_ID_15',
    pricingEnvKey: 'VITE_FREEMIUS_PRICING_ID_15',
  },
  {
    id: 'pass-25',
    files: 25,
    priceUsd: 44.99,
    label: '25 files',
    planEnvKey: 'VITE_FREEMIUS_PLAN_ID_25',
    pricingEnvKey: 'VITE_FREEMIUS_PRICING_ID_25',
  },
  {
    id: 'pass-50',
    files: 50,
    priceUsd: 79.99,
    label: '50 files',
    planEnvKey: 'VITE_FREEMIUS_PLAN_ID_50',
    pricingEnvKey: 'VITE_FREEMIUS_PRICING_ID_50',
  },
  {
    id: 'pass-75',
    files: 75,
    priceUsd: 109.99,
    label: '75 files',
    planEnvKey: 'VITE_FREEMIUS_PLAN_ID_75',
    pricingEnvKey: 'VITE_FREEMIUS_PRICING_ID_75',
  },
  {
    id: 'pass-100',
    files: 100,
    priceUsd: 139.99,
    label: '100 files',
    planEnvKey: 'VITE_FREEMIUS_PLAN_ID_100',
    pricingEnvKey: 'VITE_FREEMIUS_PRICING_ID_100',
  },
]

const DEFAULT_PLAN_ID = FREEMIUS_DEFAULT_TEST_IDS.planId

export function formatUsd(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

/** Freemius IDs must be positive integer strings — never empty. */
export function sanitizeFreemiusId(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  if (!/^\d+$/.test(raw)) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return null
  return String(n)
}

function envFlag(key) {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined
  const v = String(env?.[key] ?? '')
    .trim()
    .toLowerCase()
  return /^(1|true|yes|on)$/.test(v)
}

function envId(key) {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined
  return sanitizeFreemiusId(env?.[key])
}

export function isFreemiusMockEnabled() {
  return envFlag('VITE_FREEMIUS_MOCK')
}

/**
 * Resolve checkout identifiers for a package (always returns a valid planId).
 * Never invents fake pricing IDs. Never maps file credits → Freemius licenses.
 * @param {HealingPassPackage} pkg
 * @returns {FreemiusCheckoutIds}
 */
export function resolvePackageCheckoutIds(pkg) {
  const planId =
    envId(pkg.planEnvKey) ||
    envId('VITE_FREEMIUS_PLAN_ID') ||
    DEFAULT_PLAN_ID

  const pricingId = envId(pkg.pricingEnvKey)

  /** @type {FreemiusCheckoutStrategy} */
  let strategy
  if (isFreemiusMockEnabled()) {
    strategy = 'mock'
  } else if (pricingId) {
    strategy = 'pricing'
  } else {
    strategy = 'plan'
  }

  return {
    packageId: pkg.id,
    files: pkg.files,
    priceUsd: pkg.priceUsd,
    planId,
    pricingId: strategy === 'pricing' ? pricingId : null,
    strategy,
  }
}

/**
 * Build the exact Freemius JS SDK open() purchase fields for a one-time tier.
 * Mutually exclusive modes — never mixes pricing_id with licenses/billing flags.
 *
 * @param {FreemiusCheckoutIds} ids
 * @returns {Record<string, string|number|boolean>|null} null for mock
 */
export function buildOneTimePurchaseParams(ids) {
  if (!ids || ids.strategy === 'mock') return null

  const planId = sanitizeFreemiusId(ids.planId)
  if (!planId) return null

  if (ids.strategy === 'pricing') {
    const pricingId = sanitizeFreemiusId(ids.pricingId)
    if (!pricingId) return null
    // pricing_id already encodes license qty + billing — do NOT add licenses/billing_cycle
    return {
      plan_id: Number(planId),
      pricing_id: Number(pricingId),
      currency: 'usd',
    }
  }

  // Dedicated one-time / lifetime plan: single-site only (licenses: 1).
  // File-credit quantity lives in our app, not Freemius multi-site licenses.
  return {
    plan_id: Number(planId),
    licenses: 1,
    billing_cycle: 'lifetime',
    currency: 'usd',
    disable_licenses_selector: true,
  }
}

/** @deprecated Prefer resolvePackageCheckoutIds */
export function resolvePackagePlanId(pkg) {
  return resolvePackageCheckoutIds(pkg).planId
}

/**
 * @param {string} packageId
 * @returns {HealingPassPackage|null}
 */
export function getPackageById(packageId) {
  return HEALING_PASS_PACKAGES.find((p) => p.id === packageId) || null
}

/**
 * @param {string|number|null|undefined} planId
 * @param {string|number|null|undefined} [pricingId]
 * @returns {HealingPassPackage|null}
 */
export function getPackageByPlanId(planId, pricingId = null) {
  const priceNeedle = sanitizeFreemiusId(pricingId)
  if (priceNeedle) {
    for (const pkg of HEALING_PASS_PACKAGES) {
      const ids = resolvePackageCheckoutIds(pkg)
      if (ids.pricingId === priceNeedle) return pkg
    }
  }

  const planNeedle = sanitizeFreemiusId(planId)
  if (!planNeedle) return null

  for (const pkg of HEALING_PASS_PACKAGES) {
    const specific = envId(pkg.planEnvKey)
    if (specific && specific === planNeedle) return pkg
  }

  return null
}
