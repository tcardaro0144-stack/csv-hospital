/**
 * One-time Freemius data-healing pass packages (flat file credits).
 * Strictly non-recurring — Freemius overlay opens with billing_cycle: 'lifetime'.
 * Credits stack when users buy multiple packages.
 *
 * Plan IDs come from env (create matching one-time plans in Freemius Dashboard):
 *   VITE_FREEMIUS_PLAN_ID_1, _5, _15, _25, _50, _75, _100
 * Fallback for 1-file: VITE_FREEMIUS_PLAN_ID (legacy single plan).
 */

/**
 * @typedef {{
 *   id: string,
 *   files: number,
 *   priceUsd: number,
 *   label: string,
 *   planEnvKey: string,
 * }} HealingPassPackage
 */

/** @type {HealingPassPackage[]} */
export const HEALING_PASS_PACKAGES = [
  {
    id: 'pass-1',
    files: 1,
    priceUsd: 2.99,
    label: '1 file',
    planEnvKey: 'VITE_FREEMIUS_PLAN_ID_1',
  },
  {
    id: 'pass-5',
    files: 5,
    priceUsd: 11.99,
    label: '5 files',
    planEnvKey: 'VITE_FREEMIUS_PLAN_ID_5',
  },
  {
    id: 'pass-15',
    files: 15,
    priceUsd: 29.99,
    label: '15 files',
    planEnvKey: 'VITE_FREEMIUS_PLAN_ID_15',
  },
  {
    id: 'pass-25',
    files: 25,
    priceUsd: 44.99,
    label: '25 files',
    planEnvKey: 'VITE_FREEMIUS_PLAN_ID_25',
  },
  {
    id: 'pass-50',
    files: 50,
    priceUsd: 79.99,
    label: '50 files',
    planEnvKey: 'VITE_FREEMIUS_PLAN_ID_50',
  },
  {
    id: 'pass-75',
    files: 75,
    priceUsd: 109.99,
    label: '75 files',
    planEnvKey: 'VITE_FREEMIUS_PLAN_ID_75',
  },
  {
    id: 'pass-100',
    files: 100,
    priceUsd: 139.99,
    label: '100 files',
    planEnvKey: 'VITE_FREEMIUS_PLAN_ID_100',
  },
]

export function formatUsd(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

/**
 * Resolve Freemius plan id for a package from Vite env.
 * @param {HealingPassPackage} pkg
 * @returns {string}
 */
export function resolvePackagePlanId(pkg) {
  const specific = String(import.meta.env[pkg.planEnvKey] || '').trim()
  if (specific) return specific

  // Legacy single-plan fallback only for the 1-file tier.
  if (pkg.files === 1) {
    return String(import.meta.env.VITE_FREEMIUS_PLAN_ID || '57500').trim()
  }

  return ''
}

/**
 * @param {string} packageId
 * @returns {HealingPassPackage|null}
 */
export function getPackageById(packageId) {
  return HEALING_PASS_PACKAGES.find((p) => p.id === packageId) || null
}

/**
 * Infer package from Freemius purchase plan_id when event lacks package meta.
 * @param {string|number|null|undefined} planId
 * @returns {HealingPassPackage|null}
 */
export function getPackageByPlanId(planId) {
  if (planId == null || planId === '') return null
  const needle = String(planId)
  for (const pkg of HEALING_PASS_PACKAGES) {
    if (resolvePackagePlanId(pkg) === needle) return pkg
  }
  return null
}
