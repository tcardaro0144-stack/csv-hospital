import { useState } from 'react'
import {
  FREEMIUS_CHECKOUT_CONFIG,
  openFreemiusCheckout,
  storeFreemiusPurchase,
} from '../utils/freemiusCheckout.js'

/**
 * Freemius Overlay Checkout trigger — Purchase Authorized User Access /
 * data-healing (discharge) pass. Uses @freemius/checkout via openFreemiusCheckout.
 */
export default function UpgradeButton({
  disabled = false,
  isLoading = false,
  className = 'fb-btn disabled:cursor-not-allowed disabled:opacity-60',
  label = 'Purchase Authorized User Access',
  busyLabel = 'Opening checkout…',
}) {
  const locked = disabled || isLoading
  const [opening, setOpening] = useState(false)
  const [overlayError, setOverlayError] = useState(null)

  async function handleOverlayClick(e) {
    e.preventDefault()
    e.stopPropagation()
    if (locked || opening) return

    setOpening(true)
    setOverlayError(null)
    try {
      await openFreemiusCheckout({
        onPurchaseCompleted: (response) => {
          storeFreemiusPurchase(response)
          window.dispatchEvent(
            new CustomEvent('freemius:purchaseCompleted', { detail: response }),
          )
        },
        onSuccess: (response) => {
          storeFreemiusPurchase(response)
          window.dispatchEvent(
            new CustomEvent('freemius:purchaseCompleted', { detail: response }),
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
        id="overlay-checkout-btn"
        type="button"
        disabled={locked || opening}
        className={className}
        onClick={handleOverlayClick}
        data-freemius-store={FREEMIUS_CHECKOUT_CONFIG.store_id || undefined}
        data-freemius-product={FREEMIUS_CHECKOUT_CONFIG.product_id}
        data-freemius-plan={FREEMIUS_CHECKOUT_CONFIG.plan_id}
      >
        {opening || isLoading ? busyLabel : label}
      </button>

      {overlayError ? (
        <p className="max-w-sm text-xs text-amber-700" role="alert">
          {overlayError}
        </p>
      ) : null}
    </div>
  )
}
