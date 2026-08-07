/**
 * One-time Freemius data-healing pass packages (flat file credits).
 *
 * Live Freemius product (csvhospital.com):
 *   product 36475 · plan 60396 · lifetime multi-activation prices
 *
 * Each UI tier maps to an exact Freemius pricing_id under plan 60396.
 * File counts are OUR credit units (and match Freemius license quantities).
 *
 * Freemius open() modes (mutually exclusive — never combine):
 *   pricing  → { plan_id, pricing_id }   // preferred — exact price row
 *   plan     → { plan_id, licenses, billing_cycle: 'lifetime' }  // fallback
 *
 * Env overrides (optional):
 *   VITE_FREEMIUS_PLAN_ID / VITE_FREEMIUS_PLAN_ID_{N}
 *   VITE_FREEMIUS_PRICING_ID_{N}
 */

import {
  FREEMIUS_PLAN_ID,
  FREEMIUS_PRODUCT_ID,
  FREEMIUS_PUBLIC_KEY,
} from '../../shared/freemiusCatalog.js'

/**
 * @typedef {{
 *   id: string,
 *   files: number,
 *   priceUsd: number,
 *   label: string,
 *   planEnvKey: string,
 *   pricingEnvKey: string,
 *   defaultPricingId: string,
 * }} HealingPassPackage
 */

/**
 * @typedef {'pricing'|'plan'} FreemiusCheckoutStrategy
 */

/**
 * @typedef {{
 *   packageId: string,
 *   files: number,
 *   priceUsd: number,
 *   planId: string,
 *   pricingId: string|null,
 *   licenses: number,
 *   strategy: FreemiusCheckoutStrategy,
 * }} FreemiusCheckoutIds
 */

/** Live Freemius defaults for CSV Hospital Credit Passes. */
export const FREEMIUS_DEFAULT_TEST_IDS = {
  productId: FREEMIUS_PRODUCT_ID,
  planId: FREEMIUS_PLAN_ID,
  publicKey: FREEMIUS_PUBLIC_KEY,
}

/**
 * Flat non-recurring tiers with exact Freemius pricing_id defaults
 * (Dashboard → product 36475 → plan 60396 → Pricing).
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
    defaultPricingId: '80492',
  },
  {
    id: 'pass-5',
    files: 5,
    priceUsd: 11.99,
    label: '5 files',
    planEnvKey: 'VITE_FREEMIUS_PLAN_ID_5',
    pricingEnvKey: 'VITE_FREEMIUS_PRICING_ID_5',
    defaultPricingId: '80493',
  },
  {
    id: 'pass-15',
    files: 15,
    priceUsd: 29.99,
    label: '15 files',
    planEnvKey: 'VITE_FREEMIUS_PLAN_ID_15',
    pricingEnvKey: 'VITE_FREEMIUS_PRICING_ID_15',
    defaultPricingId: '80494',
  },
  {
    id: 'pass-25',
    files: 25,
    priceUsd: 44.99,
    label: '25 files',
    planEnvKey: 'VITE_FREEMIUS_PLAN_ID_25',
    pricingEnvKey: 'VITE_FREEMIUS_PRICING_ID_25',
    defaultPricingId: '80495',
  },
  {
    id: 'pass-50',
    files: 50,
    priceUsd: 79.99,
    label: '50 files',
    planEnvKey: 'VITE_FREEMIUS_PLAN_ID_50',
    pricingEnvKey: 'VITE_FREEMIUS_PRICING_ID_50',
    defaultPricingId: '80496',
  },
  {
    id: 'pass-75',
    files: 75,
    priceUsd: 109.99,
    label: '75 files',
    planEnvKey: 'VITE_FREEMIUS_PLAN_ID_75',
    pricingEnvKey: 'VITE_FREEMIUS_PRICING_ID_75',
    defaultPricingId: '80498',
  },
  {
    id: 'pass-100',
    files: 100,
    priceUsd: 139.99,
    label: '100 files',
    planEnvKey: 'VITE_FREEMIUS_PLAN_ID_100',
    pricingEnvKey: 'VITE_FREEMIUS_PRICING_ID_100',
    defaultPricingId: '80499',
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

function envId(key) {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined
  return sanitizeFreemiusId(env?.[key])
}

export function resolvePackageCheckoutIds(pkg) {
  const planId =
    envId(pkg.planEnvKey) ||
    envId('VITE_FREEMIUS_PLAN_ID') ||
    DEFAULT_PLAN_ID

  const pricingId =
    envId(pkg.pricingEnvKey) || sanitizeFreemiusId(pkg.defaultPricingId)

  /** @type {FreemiusCheckoutStrategy} */
  const strategy = pricingId ? 'pricing' : 'plan'

  return {
    packageId: pkg.id,
    files: pkg.files,
    priceUsd: pkg.priceUsd,
    planId,
    pricingId: strategy === 'pricing' ? pricingId : null,
    licenses: pkg.files,
    strategy,
  }
}

/**
 * Build the exact Freemius JS SDK open() purchase fields for a one-time tier.
 * Mutually exclusive modes — never mixes pricing_id with licenses/billing flags.
 *
 * @param {FreemiusCheckoutIds} ids
 * @returns {Record<string, string|number|boolean>|null}
 */
export function buildOneTimePurchaseParams(ids) {
  if (!ids) return null

  const planId = sanitizeFreemiusId(ids.planId)
  if (!planId) return null

  if (ids.strategy === 'pricing') {
    const pricingId = sanitizeFreemiusId(ids.pricingId)
    if (!pricingId) return null
    // pricing_id already encodes license qty + lifetime billing
    return {
      plan_id: Number(planId),
      pricing_id: Number(pricingId),
      currency: 'usd',
    }
  }

  // Fallback: map file credits → Freemius multi-activation quantity
  const licenses = Number(ids.licenses) > 0 ? Number(ids.licenses) : 1
  return {
    plan_id: Number(planId),
    licenses,
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
      if (sanitizeFreemiusId(pkg.defaultPricingId) === priceNeedle) return pkg
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
