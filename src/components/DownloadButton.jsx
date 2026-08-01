import { downloadCsv } from '../utils/exportCsv.js'

/**
 * Downloads the in-memory fixed CSV blob after payment gates pass.
 * Does not open a file picker.
 */
export default function DownloadButton({
  headers,
  rows,
  fileName,
  disabled = false,
  isPaid = false,
  onBeforeDownload,
  onRequirePayment,
}) {
  async function handleDownload(event) {
    event.preventDefault()
    event.stopPropagation()

    // --- Security Gate ---
    if (isPaid !== true) {
      window.alert('Payment required. Please complete checkout to download.')
      onRequirePayment?.()
      return
    }

    if (typeof onBeforeDownload !== 'function') {
      window.alert('Payment verification is unavailable. Download blocked.')
      return
    }

    const allowed = await onBeforeDownload()
    if (allowed !== true) {
      window.alert('Payment not confirmed. Please complete checkout to download.')
      onRequirePayment?.()
      return
    }

    try {
      const baseName = String(fileName || 'file').replace(/\.csv$/i, '')
      downloadCsv({
        headers,
        rows,
        fileName: `${baseName}-fixed.csv`,
        isPaid: true,
      })
    } catch (error) {
      if (error?.message === 'PAYMENT_REQUIRED') {
        window.alert('Payment required. Please complete checkout to download.')
        onRequirePayment?.()
        return
      }
      window.alert(error?.message || 'Download failed.')
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={disabled || isPaid !== true}
      aria-disabled={disabled || isPaid !== true}
      className="fb-btn disabled:cursor-not-allowed disabled:opacity-60"
    >
      Download Discharged CSV
    </button>
  )
}
