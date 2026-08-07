import { useState } from 'react'
import {
  FREEMIUS_CHECKOUT_CONFIG,
  isLocalFreemiusMockAllowed,
  openFreemiusCheckout,
} from '../utils/freemiusCheckout.js'
import {
  formatUsd,
  resolvePackageCheckoutIds,
} from '../utils/freemiusPricing.js'

/**
 * Freemius one-time overlay trigger for a healing-pass package.
 * On localhost: Shift+click (or the local test link) simulates test card 4242
 * success and runs the same credit-grant / purchaseCompleted path.
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
  const localMock = isLocalFreemiusMockAllowed()

  const ids = pkg
    ? resolvePackageCheckoutIds(pkg)
    : {
        planId: FREEMIUS_CHECKOUT_CONFIG.plan_id,
        pricingId: null,
        files: 1,
        packageId: 'pass-1',
        strategy: 'plan',
      }

  const defaultLabel = pkg
    ? `Buy ${formatUsd(pkg.priceUsd)} · ${pkg.label}`
    : 'Purchase Authorized User Access'

  async function runCheckout({ localTestCard } = {}) {
    if (locked || opening) return

    setOpening(true)
    setOverlayError(null)
    try {
      await openFreemiusCheckout({
        packageId: pkg?.id || 'pass-1',
        planId: ids.planId,
        pricingId: ids.pricingId || undefined,
        localTestCard,
        onPurchaseCompleted: (response) => {
          const safe =
            response && typeof response === 'object' ? response : {}
          window.dispatchEvent(
            new CustomEvent('freemius:purchaseCompleted', {
              detail: {
                ...safe,
                packageId: pkg?.id || 'pass-1',
                files: pkg?.files ?? ids.files ?? 1,
                planId: ids.planId,
                pricingId: ids.pricingId,
              },
            }),
          )
        },
        onSuccess: (response) => {
          const safe =
            response && typeof response === 'object' ? response : {}
          window.dispatchEvent(
            new CustomEvent('freemius:purchaseCompleted', {
              detail: {
                ...safe,
                packageId: pkg?.id || 'pass-1',
                files: pkg?.files ?? ids.files ?? 1,
                planId: ids.planId,
                pricingId: ids.pricingId,
              },
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

  async function handleOverlayClick(e) {
    e.preventDefault()
    e.stopPropagation()
    // Shift+click on localhost → mock 4242 success (no Freemius gateway).
    const localTestCard =
      localMock && (e.shiftKey || e.altKey) ? '4242' : undefined
    await runCheckout({ localTestCard })
  }

  async function handleLocalMockClick(e) {
    e.preventDefault()
    e.stopPropagation()
    await runCheckout({ localTestCard: '4242' })
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto">
      <button
        type="button"
        disabled={locked || opening}
        className={className}
        onClick={handleOverlayClick}
        data-freemius-product={FREEMIUS_CHECKOUT_CONFIG.product_id}
        data-freemius-plan={ids.planId || undefined}
        data-freemius-pricing={ids.pricingId || undefined}
        data-freemius-strategy={ids.strategy || 'plan'}
        data-freemius-sandbox={
          FREEMIUS_CHECKOUT_CONFIG.isSandbox === true ? 'true' : 'false'
        }
        data-healing-files={pkg?.files ?? ids.files}
        data-billing="one_time"
      >
        {opening || isLoading ? busyLabel : label || defaultLabel}
      </button>

      {localMock ? (
        <button
          type="button"
          disabled={locked || opening}
          onClick={handleLocalMockClick}
          className="text-left text-xs text-slate-500 underline-offset-2 hover:underline disabled:opacity-50"
        >
          Local test unlock (card 4242)
        </button>
      ) : null}

      {overlayError ? (
        <p className="max-w-sm text-xs text-amber-700" role="alert">
          {overlayError}
        </p>
      ) : null}
    </div>
  )
}
