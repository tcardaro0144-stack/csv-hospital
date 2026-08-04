import { useState } from 'react'
import {
  FREEMIUS_CHECKOUT_CONFIG,
  openFreemiusCheckout,
} from '../utils/freemiusCheckout.js'
import {
  formatUsd,
  resolvePackagePlanId,
} from '../utils/freemiusPricing.js'

/**
 * Freemius one-time overlay trigger for a healing-pass package.
 */
export default function UpgradeButton({
  disabled = false,
  isLoading = false,
  className = 'fb-btn disabled:cursor-not-allowed disabled:opacity-60',
  label,
  busyLabel = 'Opening checkout…',
  /** @type {import('../utils/freemiusPricing.js').HealingPassPackage|null} */
  package: pkg = null,
}) {
  const locked = disabled || isLoading
  const [opening, setOpening] = useState(false)
  const [overlayError, setOverlayError] = useState(null)

  const planId = pkg ? resolvePackagePlanId(pkg) : FREEMIUS_CHECKOUT_CONFIG.plan_id
  const defaultLabel = pkg
    ? `Buy ${formatUsd(pkg.priceUsd)} · ${pkg.label}`
    : 'Purchase Authorized User Access'

  async function handleOverlayClick(e) {
    e.preventDefault()
    e.stopPropagation()
    if (locked || opening) return

    if (pkg && !planId) {
      setOverlayError(
        `Missing Freemius plan id for ${pkg.label}. Set ${pkg.planEnvKey} in env.`,
      )
      return
    }

    setOpening(true)
    setOverlayError(null)
    try {
      await openFreemiusCheckout({
        packageId: pkg?.id,
        planId,
        onPurchaseCompleted: (response) => {
          window.dispatchEvent(
            new CustomEvent('freemius:purchaseCompleted', {
              detail: { ...response, packageId: pkg?.id, files: pkg?.files },
            }),
          )
        },
        onSuccess: (response) => {
          window.dispatchEvent(
            new CustomEvent('freemius:purchaseCompleted', {
              detail: { ...response, packageId: pkg?.id, files: pkg?.files },
            }),
          )
        },
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to open Freemius overlay.'
      setOverlayError(message)
      console.error('[freemius] overlay open failed', err)
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto">
      <button
        type="button"
        disabled={locked || opening}
        className={className}
        onClick={handleOverlayClick}
        data-freemius-store={FREEMIUS_CHECKOUT_CONFIG.store_id || undefined}
        data-freemius-product={FREEMIUS_CHECKOUT_CONFIG.product_id}
        data-freemius-plan={planId || undefined}
        data-healing-files={pkg?.files}
        data-billing="one_time"
      >
        {opening || isLoading ? busyLabel : label || defaultLabel}
      </button>

      {overlayError ? (
        <p className="max-w-sm text-xs text-amber-700" role="alert">
          {overlayError}
        </p>
      ) : null}
    </div>
  )
}
