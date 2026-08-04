/**
 * Stackable one-time data-healing file credits (Freemius purchases).
 * Credits combine across packages and persist in localStorage.
 */

import { getPackageById, getPackageByPlanId } from './freemiusPricing.js'

const CREDITS_KEY = 'csv-hospital-healing-credits'

/**
 * @returns {{ balance: number, purchases: object[], updatedAt: string|null }}
 */
export function getHealingCreditsState() {
  try {
    const raw = localStorage.getItem(CREDITS_KEY)
    if (!raw) {
      return { balance: 0, purchases: [], updatedAt: null }
    }
    const parsed = JSON.parse(raw)
    const balance = Number(parsed?.balance)
    return {
      balance: Number.isFinite(balance) && balance > 0 ? Math.floor(balance) : 0,
      purchases: Array.isArray(parsed?.purchases) ? parsed.purchases : [],
      updatedAt: parsed?.updatedAt || null,
    }
  } catch {
    return { balance: 0, purchases: [], updatedAt: null }
  }
}

export function getHealingCreditBalance() {
  return getHealingCreditsState().balance
}

export function hasHealingCredits() {
  return getHealingCreditBalance() > 0
}

function persist(state) {
  localStorage.setItem(
    CREDITS_KEY,
    JSON.stringify({
      balance: state.balance,
      purchases: state.purchases.slice(-40),
      updatedAt: new Date().toISOString(),
    }),
  )
}

/**
 * Add credits from a one-time Freemius package purchase (stackable).
 * @param {{ packageId?: string, files?: number, planId?: string|number, purchaseId?: string|null, raw?: object }} meta
 * @returns {number} new balance
 */
export function addHealingCredits(meta = {}) {
  const pkg =
    (meta.packageId && getPackageById(meta.packageId)) ||
    getPackageByPlanId(meta.planId)

  const files =
    Number(meta.files) > 0
      ? Math.floor(Number(meta.files))
      : pkg?.files || 0

  if (files < 1) {
    console.warn('[freemius] addHealingCredits skipped — unknown package/files', meta)
    return getHealingCreditBalance()
  }

  const state = getHealingCreditsState()
  const purchaseId = meta.purchaseId != null ? String(meta.purchaseId) : null
  if (
    purchaseId &&
    state.purchases.some((p) => p.purchaseId && String(p.purchaseId) === purchaseId)
  ) {
    return state.balance
  }

  // Freemius often fires purchaseCompleted + success; collapse near-duplicate grants.
  const recent = state.purchases[state.purchases.length - 1]
  if (
    recent &&
    !purchaseId &&
    recent.packageId === (pkg?.id || meta.packageId) &&
    recent.files === files &&
    Date.now() - new Date(recent.at).getTime() < 8000
  ) {
    return state.balance
  }

  state.balance += files
  state.purchases.push({
    at: new Date().toISOString(),
    files,
    packageId: pkg?.id || meta.packageId || null,
    planId: meta.planId != null ? String(meta.planId) : null,
    purchaseId,
  })
  persist(state)
  return state.balance
}

/**
 * Spend one file credit for a discharge download.
 * @returns {boolean} true if a credit was consumed
 */
export function consumeHealingCredit() {
  const state = getHealingCreditsState()
  if (state.balance < 1) return false
  state.balance -= 1
  persist(state)
  return true
}

/** Does not wipe credits — only used for Stripe/legacy session keys elsewhere. */
export function clearHealingCredits() {
  localStorage.removeItem(CREDITS_KEY)
}
