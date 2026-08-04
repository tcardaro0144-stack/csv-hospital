/**
 * One-time Freemius data-healing pass packages (flat file credits).
 *
 * Each tier maps to Freemius checkout identifiers:
 *   - plan_id (shared one-time plan by default: 57500)
 *   - pricing_id (exact lifetime price row — preferred when env is set)
 *
 * When VITE_FREEMIUS_PRICING_ID_{N} is unset, checkout does NOT invent fake
 * pricing IDs (those cause Freemius "Checkout Loading" validation errors).
 * Instead it uses a safe strategy:
 *   1. plan_default — open shared plan with billing_cycle lifetime only
 *   2. licenses — only if VITE_FREEMIUS_USE_LICENSES_FALLBACK=true
 *   3. mock — local credit grant when VITE_FREEMIUS_MOCK=true (dev / staging)
 *
 * Env:
 *   VITE_FREEMIUS_PLAN_ID              — default plan (57500)
 *   VITE_FREEMIUS_PLAN_ID_{N}          — optional per-tier plan override
 *   VITE_FREEMIUS_PRICING_ID_{N}       — preferred per-tier pricing_id
 *   VITE_FREEMIUS_USE_LICENSES_FALLBACK — map files → licenses (opt-in)
 *   VITE_FREEMIUS_MOCK                 — grant credits without Freemius overlay
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
 * @typedef {'pricing_id'|'plan_default'|'licenses'|'mock'} FreemiusCheckoutStrategy
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

/** Known-good Freemius defaults (product CSV Hospital). */
export const FREEMIUS_DEFAULT_TEST_IDS = {
  productId: '34967',
  planId: '57500',
  publicKey: 'pk_96bd363d5fbf016bebe4795ecda42',
}

/** @type {HealingPassPackage[]} */
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
  const v = String(import.meta.env[key] ?? '')
    .trim()
    .toLowerCase()
  return /^(1|true|yes|on)$/.test(v)
}

function envId(key) {
  return sanitizeFreemiusId(import.meta.env[key])
}

/** Explicit mock checkout (local / staging credit grant, no Freemius overlay). */
export function isFreemiusMockEnabled() {
  return envFlag('VITE_FREEMIUS_MOCK')
}

/**
 * Opt-in: map file credits → Freemius `licenses` when pricing_id unset.
 * Off by default — wrong quantities cause Checkout Loading validation errors.
 */
export function isLicensesFallbackEnabled() {
  return envFlag('VITE_FREEMIUS_USE_LICENSES_FALLBACK')
}

/**
 * Resolve checkout identifiers for a package (always returns a valid planId).
 * Never returns empty/invalid pricing IDs.
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
    strategy = 'pricing_id'
  } else if (isLicensesFallbackEnabled()) {
    strategy = 'licenses'
  } else {
    // Safe default: shared plan lifetime price only (no fake pricing_id).
    strategy = 'plan_default'
  }

  return {
    packageId: pkg.id,
    files: pkg.files,
    priceUsd: pkg.priceUsd,
    planId,
    // Only expose pricingId when strategy is pricing_id — never pass junk to Freemius.
    pricingId: strategy === 'pricing_id' ? pricingId : null,
    licenses: pkg.files,
    strategy,
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
