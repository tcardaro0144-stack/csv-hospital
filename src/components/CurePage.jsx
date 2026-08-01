import { useState } from 'react'
import { Link } from 'react-router-dom'
import CsvUpload from './CsvUpload.jsx'
import CheckoutNotice from './CheckoutNotice.jsx'
import ProDownloadGate from './ProDownloadGate.jsx'
import StripePaymentPanel from './StripePaymentPanel.jsx'
import SupportChat from './SupportChat.jsx'
import Seo from './Seo.jsx'
import { ingestCsvFile } from '../utils/ingestCsv.js'
import useProStatus from '../hooks/useProStatus.js'
import { ROUTES } from '../routes.js'

/**
 * CSV Hospital utility — routed at /hospital
 */
export default function CurePage() {
  const [readyData, setReadyData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const {
    isPaid,
    isVerifying,
    isCheckingOut,
    showPaymentForm,
    clientSecret,
    publishableKey,
    checkoutError,
    checkoutNotice,
    dismissNotice,
    startCheckout,
    cancelPayment,
    handlePaymentSuccess,
    confirmUnlock,
  } = useProStatus()

  const paid = isPaid === true

  async function handleFileChange(file) {
    if (!file || isLoading) return

    setIsLoading(true)
    setError(null)
    setReadyData(null)

    try {
      const ready = await ingestCsvFile(file)
      setReadyData(ready)
    } catch (err) {
      setReadyData(null)
      setError(err?.message ?? 'Failed to process CSV.')
    } finally {
      setIsLoading(false)
    }
  }

  function requirePayment() {
    if (isLoading) return
    window.alert('Discharge requires payment. Complete checkout to download.')
    startCheckout()
    window.setTimeout(() => {
      document.getElementById('payment-panel')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 100)
  }

  return (
    <div className="relative min-h-screen bg-black">
      <Seo pageKey="hospital" />
      <div className="fb-atmosphere" aria-hidden="true" />

      <div className="relative z-10">
        <header className="border-b border-[#00ffc2]/40 bg-black">
          <div className="mx-auto flex max-w-3xl items-start justify-between gap-4 px-6 py-8">
            <div>
              <Link to={ROUTES.ROOT} className="fb-brand mb-2 inline-block">
                Faceless Blur
              </Link>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
                CSV Hospital
              </h1>
              <p className="fb-body fb-muted mt-1">
                Admit a CSV for triage — surgery runs locally in your browser.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {paid ? (
                <span className="fb-brand-meta rounded-full border border-[#00ffc2] px-3 py-1 text-[#00ffc2]">
                  Cleared
                </span>
              ) : (
                <span className="fb-brand-meta">CSV Tool</span>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-10">
          <CsvUpload
            onFileChange={handleFileChange}
            isLoading={isLoading}
            disabled={isLoading}
            readyFileName={readyData?.fileName ?? null}
          />

          <CheckoutNotice notice={checkoutNotice} onDismiss={dismissNotice} />

          {(error || checkoutError) && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-[#00ffc2] bg-black px-4 py-3 text-sm text-[#00ffc2]"
            >
              {error || checkoutError}
            </div>
          )}

          {!isLoading && readyData ? (
            <div className="mt-6 space-y-4">
              <div className="fb-glass rounded-lg px-5 py-4">
                <h2 className="fb-muted text-[11px] uppercase tracking-widest">
                  Patient file
                </h2>
                <p className="mt-1 text-lg font-semibold text-[#00ffc2]">
                  {readyData.fileName}
                </p>
                <dl className="fb-body mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <dt className="fb-muted">Original rows</dt>
                    <dd className="font-medium text-[#00ffc2]">
                      {readyData.originalRowCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="fb-muted">Stabilized rows</dt>
                    <dd className="font-medium text-[#00ffc2]">{readyData.rowCount}</dd>
                  </div>
                  <div>
                    <dt className="fb-muted">Columns</dt>
                    <dd className="font-medium text-[#00ffc2]">
                      {readyData.columnCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="fb-muted">Excised empty</dt>
                    <dd className="font-medium text-[#00ffc2]">
                      {readyData.removedRowCount}
                    </dd>
                  </div>
                </dl>
              </div>

              <div
                id="payment-panel"
                className="fb-glass rounded-lg px-5 py-4"
              >
                <h2 className="text-[11px] uppercase tracking-widest text-[#00ffc2]">
                  Procedure complete
                </h2>
                <ul className="fb-body fb-muted mt-2 list-inside list-disc">
                  <li>Removed entirely empty rows</li>
                  <li>Trimmed whitespace from all cells</li>
                  <li>Standardized headers (trimmed extra spaces)</li>
                </ul>
                <div className="mt-4 space-y-4">
                  {showPaymentForm && clientSecret && !isLoading ? (
                    <StripePaymentPanel
                      clientSecret={clientSecret}
                      publishableKey={
                        publishableKey ||
                        import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
                      }
                      onPaid={handlePaymentSuccess}
                      onCancel={cancelPayment}
                      onError={(msg) => setError(msg)}
                    />
                  ) : (
                    <ProDownloadGate
                      isPaid={paid}
                      isVerifying={isVerifying}
                      isCheckingOut={isCheckingOut || isLoading}
                      disabled={isLoading}
                      onUpgrade={startCheckout}
                      onConfirmUnlock={confirmUnlock}
                      onRequirePayment={requirePayment}
                      headers={readyData.headers}
                      rows={readyData.rows}
                      fileName={readyData.fileName}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <SupportChat />
        </main>
      </div>
    </div>
  )
}
