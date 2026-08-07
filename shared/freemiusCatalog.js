/**
 * Canonical Freemius catalog for CSV Hospital Credit Passes.
 * Single source of truth for product + plan defaults (frontend + backend).
 *
 * Hierarchy:
 *   product_id  36475  — CSV Hospital Credit Passes (live product)
 *   plan_id     60396  — active lifetime plan for product 36475 (not 80396)
 *   pricing_id  80492+ — per-tier rows under plan 60396 (not product/plan)
 *
 * Freemius uses the same keys for live and sandbox; mode is controlled by
 * FREEMIUS_SANDBOX / VITE_FREEMIUS_SANDBOX (false = live charges).
 */

export const FREEMIUS_PRODUCT_ID = '36475'
export const FREEMIUS_PLAN_ID = '60396'
export const FREEMIUS_PUBLIC_KEY = 'pk_1411029c3e32680a04780cd82936a'

/** @deprecated Prefer named exports above */
export const FREEMIUS_CATALOG = {
  productId: FREEMIUS_PRODUCT_ID,
  planId: FREEMIUS_PLAN_ID,
  publicKey: FREEMIUS_PUBLIC_KEY,
}
