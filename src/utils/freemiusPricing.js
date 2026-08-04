/**
 * One-time Freemius data-healing pass packages (flat file credits).
 *
 * Each tier maps to Freemius checkout identifiers:
 *   - plan_id (shared one-time plan by default: 57500)
 *   - pricing_id (exact lifetime price row — preferred)
 *   - licenses fallback (= file count) when pricing_id unset but bulk lifetime prices exist
 *
 * Env:
 *   VITE_FREEMIUS_PLAN_ID              — default plan (57500)
 *   VITE_FREEMIUS_PLAN_ID_{N}          — optional per-tier plan override
 *   VITE_FREEMIUS_PRICING_ID_{N}       — preferred per-tier pricing_id
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
 * @typedef {{
 *   packageId: string,
 *   files: number,
 *   priceUsd: number,
 *   planId: string,
 *   pricingId: string|null,
 *   licenses: number,
 * }} FreemiusCheckoutIds
 */

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

const DEFAULT_PLAN_ID = '57500'

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
  // Reject zero / leading-junk
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return null
  return String(n)
}

function envId(key) {
  return sanitizeFreemiusId(import.meta.env[key])
}

/**
 * Resolve checkout identifiers for a package (always returns a valid planId).
 * @param {HealingPassPackage} pkg
 * @returns {FreemiusCheckoutIds}
 */
export function resolvePackageCheckoutIds(pkg) {
  const planId =
    envId(pkg.planEnvKey) ||
    envId('VITE_FREEMIUS_PLAN_ID') ||
    DEFAULT_PLAN_ID

  const pricingId = envId(pkg.pricingEnvKey)

  return {
    packageId: pkg.id,
    files: pkg.files,
    priceUsd: pkg.priceUsd,
    planId,
    pricingId,
    // When Freemius lifetime bulk prices use license quantity = file credits
    licenses: pkg.files,
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

  // Prefer exact per-tier plan matches over the shared default plan.
  for (const pkg of HEALING_PASS_PACKAGES) {
    const specific = envId(pkg.planEnvKey)
    if (specific && specific === planNeedle) return pkg
  }

  return null
}
