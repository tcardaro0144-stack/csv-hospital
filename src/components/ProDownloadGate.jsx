import { useState } from 'react'
import UpgradeButton from './UpgradeButton.jsx'
import DownloadButton from './DownloadButton.jsx'
import ExportAttribution from './ExportAttribution.jsx'
import { HEALING_PASS_PACKAGES } from '../utils/freemiusPricing.js'

/**
 * Download is hidden until isPaid === true (credits or legacy unlock).
 * Even then, DownloadButton re-asserts payment before export.
 */
export default function ProDownloadGate({
  isPaid = false,
  isPro, // legacy alias
  creditBalance = 0,
  isVerifying,
  isCheckingOut,
  disabled = false,
  onConfirmUnlock,
  onRequirePayment,
  headers,
  rows,
  fileName,
}) {
  const paid = isPaid === true || isPro === true
  const [isConfirming, setIsConfirming] = useState(false)
  const uiLocked = disabled === true || isCheckingOut === true
  const starterPack = HEALING_PASS_PACKAGES[0]

  async function handleDownloadAttempt() {
    if (paid !== true) {
      onRequirePayment?.()
      return false
    }
    if (!onConfirmUnlock) {
      console.error('[download] Blocked: missing payment guard.')
      return false
    }
    setIsConfirming(true)
    try {
      return (await onConfirmUnlock()) === true
    } finally {
      setIsConfirming(false)
    }
  }

  if (isVerifying) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#00ffc2]">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#00ffc2] border-t-transparent" />
        Confirming clearance…
      </div>
    )
  }

  if (paid === true) {
    return (
      <div className="space-y-3">
        {creditBalance > 0 ? (
          <p className="text-xs text-[#00ffc2]">
            File credits remaining: {creditBalance}
          </p>
        ) : null}
        <DownloadButton
          headers={headers}
          rows={rows}
          fileName={fileName}
          disabled={isConfirming || uiLocked}
          isPaid={true}
          onBeforeDownload={handleDownloadAttempt}
          onRequirePayment={onRequirePayment}
        />
        {isConfirming ? (
          <p className="text-xs text-[#00ffc2]">
            Verifying payment before discharge…
          </p>
        ) : null}
        <ExportAttribution />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#00ffc2] bg-black px-4 py-4">
        <h3 className="text-sm font-semibold text-[#00ffc2]">Discharge locked</h3>
        <p className="mt-1 text-sm text-gray-400">
          Buy a one-time Freemius file-credit pack to unlock download. Credits stack —
          combine packs for higher volume. See Pricing for all flat tiers.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <UpgradeButton
            package={starterPack}
            disabled={uiLocked}
            isLoading={isCheckingOut}
          />
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-gray-700 bg-black px-4 py-2.5 text-sm font-medium text-gray-500 opacity-70"
            title="Complete payment to enable download"
          >
            Discharge CSV (locked)
          </button>
        </div>
      </div>
      <ExportAttribution compact />
    </div>
  )
}
