import { useState } from 'react'
import {
  FREEMIUS_CHECKOUT_CONFIG,
  openFreemiusCheckout,
  storeFreemiusPurchase,
} from '../utils/freemiusCheckout.js'

/**
 * Official Freemius Overlay Checkout integration (in-page modal, no redirect).
 * SDK is loaded globally in index.html: <script src="https://checkout.freemius.com/js/v1/">
 * facelessblur.com always opens LIVE checkout (no /api/freemius-sandbox call).
 */
export default function UpgradeButton({ disabled = false, isLoading = false }) {
  const locked = disabled || isLoading
  const [opening, setOpening] = useState(false)
  const [overlayError, setOverlayError] = useState(null)

  async function handleOverlayClick(e) {
    // Stop any navigation/redirect — overlay modal only
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
        className="fb-btn disabled:cursor-not-allowed disabled:opacity-60"
        onClick={handleOverlayClick}
        data-freemius-product={FREEMIUS_CHECKOUT_CONFIG.product_id}
      >
        {opening || isLoading
          ? 'Opening checkout…'
          : 'Purchase Authorized User Access'}
      </button>

      {overlayError ? (
        <p className="max-w-sm text-xs text-amber-300" role="alert">
          {overlayError}
        </p>
      ) : null}
    </div>
  )
}
