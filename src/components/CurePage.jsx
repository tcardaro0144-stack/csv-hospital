import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import CsvUpload from './CsvUpload.jsx'
import CheckoutNotice from './CheckoutNotice.jsx'
import ProDownloadGate from './ProDownloadGate.jsx'
import StripePaymentPanel from './StripePaymentPanel.jsx'
import SupportChat from './SupportChat.jsx'
import Seo from './Seo.jsx'
import PricingTiers from './PricingTiers.jsx'
import EmailCapture from './EmailCapture.jsx'
import { ingestCsvFile } from '../utils/ingestCsv.js'
import useProStatus from '../hooks/useProStatus.js'
import { ROUTES } from '../routes.js'
import { HOSPITAL_FAQS } from '../utils/seo.js'

const NAV = [
  { id: 'home', label: 'HOME (TRIAL WARD)' },
  { id: 'services', label: 'OUR SERVICES' },
  { id: 'compare', label: 'COMPARE' },
  { id: 'faqs', label: 'PATIENT FAQS' },
  { id: 'pricing', label: 'PRICING' },
  { id: 'updates', label: 'UPDATES' },
]

/** ~50-word direct answer for AEO / citation blocks (keep 40–60 words). */
const DIRECT_ANSWER =
  'CSV Hospital is a browser-based utility that repairs messy CSV spreadsheets. It removes empty rows, trims invisible whitespace, and standardizes crooked headers so imports, VLOOKUPs, and warehouse loads stop failing. Your file never uploads to a server—triage stays on your device, then you download a healed CSV when ready.'

const FEATURE_ROWS = [
  {
    feature: 'Empty-row excision',
    fixes: 'Blank stretcher-rows that inflate counts and break imports',
    where: 'In your browser only',
  },
  {
    feature: 'Whitespace physiotherapy',
    fixes: 'Leading/trailing spaces that break joins and VLOOKUP',
    where: 'In your browser only',
  },
  {
    feature: 'Header alignment',
    fixes: 'Padded or crooked column names that confuse schemas',
    where: 'In your browser only',
  },
  {
    feature: 'Bedside privacy',
    fixes: 'Risk of uploading sensitive sheets to a remote cleaner',
    where: 'File never leaves your device',
  },
]

const COMPARE_ROWS = [
  {
    need: 'Remove empty rows & trim cells',
    hospital: 'One admit → automatic triage',
    excel: 'Manual filters / Find & Replace',
    scripts: 'Write and maintain a script',
  },
  {
    need: 'Keep data on your device',
    hospital: 'Yes — local browser processing',
    excel: 'Yes — desktop file',
    scripts: 'Depends on where you run it',
  },
  {
    need: 'No engineering required',
    hospital: 'Yes — admit and review',
    excel: 'Partial — wizard steps',
    scripts: 'No — code required',
  },
  {
    need: 'Discharge a healed .csv',
    hospital: 'Download {name}-fixed.csv',
    excel: 'Save As CSV (easy to re-break)',
    scripts: 'Custom output path',
  },
]

/**
 * CSV Hospital — medical-sitcom landing + in-browser triage tool.
 * Default site view at /
 */
export default function CurePage() {
  const [readyData, setReadyData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [admitOpen, setAdmitOpen] = useState(false)
  const admitRef = useRef(null)

  const {
    isPaid,
    creditBalance,
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

  useEffect(() => {
    const id = 'csvh-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;700&family=Nunito:wght@400;600;700;800&display=swap'
    document.head.appendChild(link)
  }, [])

  async function handleFileChange(file) {
    if (!file || isLoading) return

    setAdmitOpen(true)
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

  function openAdmitWard() {
    setAdmitOpen(true)
    window.requestAnimationFrame(() => {
      admitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function scrollToSection(id) {
    if (id === 'home') {
      openAdmitWard()
      return
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="csvh-page min-h-screen">
      <Seo pageKey="hospital" />

      <header className="csvh-header sticky top-0 z-40">
        <div className="csvh-wrap flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <a href="#top" className="csvh-logo group inline-flex items-center gap-2.5">
            <span className="csvh-cross" aria-hidden="true" />
            <span>
              <span className="block text-lg font-extrabold tracking-tight text-[var(--csvh-ink)]">
                CSV Hospital
              </span>
              <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--csvh-blue)]">
                Digital ER for data
              </span>
            </span>
          </a>

          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="CSV Hospital">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className="csvh-nav-link"
                onClick={() => scrollToSection(item.id)}
              >
                {item.label}
              </button>
            ))}
            <Link to={ROUTES.GUIDES} className="csvh-nav-link">
              GUIDES
            </Link>
          </nav>
        </div>
      </header>

      <main id="top">
        {/* Hero — split screen */}
        <section className="csvh-hero csvh-wrap" aria-labelledby="csvh-headline">
          <div className="csvh-hero-art">
            <img
              src="/csv-patient-character.png"
              alt="A slumped, sad spreadsheet character spilling colorful numbers and error codes like ERR#, CORRUPT, and DATA_FAIL"
              width={640}
              height={640}
              className="csvh-patient-img"
            />
          </div>

          <div className="csvh-hero-copy">
            <p className="csvh-eyebrow">
              <span className="csvh-cross csvh-cross-sm" aria-hidden="true" />
              Welcome to the trial ward
            </p>
            <h1 id="csvh-headline" className="csvh-headline">
              IS YOUR DATA TERMINALLY MESSY?
            </h1>
            <aside
              className="csvh-aeo-answer"
              data-aeo="direct-answer"
              aria-label="Direct answer: what CSV Hospital solves"
            >
              <p className="csvh-aeo-answer-label">Direct answer</p>
              <p className="csvh-aeo-answer-text">{DIRECT_ANSWER}</p>
            </aside>
            <p className="csvh-subhead">
              Don&apos;t be like this guy. Bring your CSV files to CSV Hospital—the
              only digital ER for data repair.
            </p>
            <button type="button" className="csvh-cta" onClick={openAdmitWard}>
              [ ADMIT &amp; HEAL YOUR CSV ]
            </button>
            {paid ? (
              <p className="csvh-badge-line">
                <span className="csvh-badge">Cleared for discharge</span>
              </p>
            ) : null}
          </div>
        </section>

        {/* Admit / upload */}
        <section
          id="admit"
          ref={admitRef}
          className="csvh-section csvh-admit"
          aria-labelledby="admit-heading"
        >
          <div className="csvh-wrap">
            <div className="csvh-section-head">
              <h2 id="admit-heading">Trial Ward · Admit a patient</h2>
              <p>
                Drag a CSV onto the gurney. Triage runs locally — no ambulance ride to
                the cloud.
              </p>
            </div>

            {!admitOpen ? (
              <div className="csvh-admit-gate">
                <p className="csvh-admit-hint">
                  Press the big red-cross energy button above, or open the ward here.
                </p>
                <button type="button" className="csvh-cta csvh-cta-secondary" onClick={openAdmitWard}>
                  [ OPEN ADMIT DESK ]
                </button>
              </div>
            ) : (
              <div className="csvh-admit-panel">
                <CsvUpload
                  variant="medical"
                  onFileChange={handleFileChange}
                  isLoading={isLoading}
                  disabled={isLoading}
                  readyFileName={readyData?.fileName ?? null}
                />

                <CheckoutNotice notice={checkoutNotice} onDismiss={dismissNotice} />

                {(error || checkoutError) && (
                  <div role="alert" className="csvh-alert">
                    {error || checkoutError}
                  </div>
                )}

                {!isLoading && readyData ? (
                  <div className="mt-6 space-y-4">
                    <div className="csvh-card">
                      <h3 className="csvh-card-kicker">Patient file</h3>
                      <p className="csvh-card-title">{readyData.fileName}</p>
                      <dl className="csvh-stats">
                        <div>
                          <dt>Original rows</dt>
                          <dd>{readyData.originalRowCount}</dd>
                        </div>
                        <div>
                          <dt>Stabilized rows</dt>
                          <dd>{readyData.rowCount}</dd>
                        </div>
                        <div>
                          <dt>Columns</dt>
                          <dd>{readyData.columnCount}</dd>
                        </div>
                        <div>
                          <dt>Excised empty</dt>
                          <dd>{readyData.removedRowCount}</dd>
                        </div>
                      </dl>
                    </div>

                    <div id="payment-panel" className="csvh-card">
                      <h3 className="csvh-card-kicker">Procedure complete</h3>
                      <ul className="csvh-bullets">
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
                            creditBalance={creditBalance}
                            isVerifying={isVerifying}
                            isCheckingOut={isCheckingOut || isLoading}
                            disabled={isLoading}
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

                <div className="csvh-support-wrap">
                  <SupportChat />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Services — scannable feature table (AEO) */}
        <section id="services" className="csvh-section csvh-band" aria-labelledby="services-heading">
          <div className="csvh-wrap">
            <div className="csvh-section-head">
              <h2 id="services-heading">Our services</h2>
              <p>Four bedside manners. Zero judgment about how the sheet got this bad.</p>
            </div>
            <div className="csvh-table-scroll">
              <table className="csvh-aeo-table">
                <caption className="sr-only">
                  CSV Hospital features: what each service fixes and where processing runs
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Feature</th>
                    <th scope="col">What it fixes</th>
                    <th scope="col">Where it runs</th>
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_ROWS.map((row) => (
                    <tr key={row.feature}>
                      <th scope="row">{row.feature}</th>
                      <td>{row.fixes}</td>
                      <td>{row.where}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Comparison table (AEO) */}
        <section id="compare" className="csvh-section" aria-labelledby="compare-heading">
          <div className="csvh-wrap">
            <div className="csvh-section-head">
              <h2 id="compare-heading">CSV Hospital vs common fixes</h2>
              <p>A quick scan of how the ward compares to Excel busywork and one-off scripts.</p>
            </div>
            <div className="csvh-table-scroll">
              <table className="csvh-aeo-table csvh-aeo-table-compare">
                <caption className="sr-only">
                  Comparison of CSV Hospital, Excel, and custom scripts for common CSV repair needs
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Need</th>
                    <th scope="col">CSV Hospital</th>
                    <th scope="col">Excel</th>
                    <th scope="col">Custom script</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row) => (
                    <tr key={row.need}>
                      <th scope="row">{row.need}</th>
                      <td>{row.hospital}</td>
                      <td>{row.excel}</td>
                      <td>{row.scripts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section id="faqs" className="csvh-section csvh-band" aria-labelledby="faqs-heading">
          <div className="csvh-wrap csvh-narrow">
            <div className="csvh-section-head">
              <h2 id="faqs-heading">Patient FAQs</h2>
              <p>Answers from the front desk, before the clipboard arrives.</p>
            </div>
            <div className="csvh-faq-list">
              {HOSPITAL_FAQS.map((item) => (
                <details key={item.q} className="csvh-faq">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="csvh-section csvh-band" aria-labelledby="pricing-heading">
          <div className="csvh-wrap">
            <div className="csvh-section-head">
              <h2 id="pricing-heading">Pricing</h2>
              <p>
                Flat one-time file credits — combine packs anytime. Never a subscription.
              </p>
            </div>
            <PricingTiers
              isCheckingOut={isCheckingOut}
              creditBalance={creditBalance}
              onAdmit={openAdmitWard}
            />
          </div>
        </section>

        <EmailCapture source="homepage" />
      </main>

      <footer className="csvh-footer">
        <div className="csvh-wrap csvh-footer-inner">
          <p>
            CSV Hospital is not a real hospital, but we are serious about clean data.
          </p>
          <p>
            <Link to={ROUTES.GUIDES}>Guides</Link>
            <span aria-hidden="true"> · </span>
            <Link to={ROUTES.TERMS}>Terms of Service</Link>
            <span aria-hidden="true"> · </span>
            Owned &amp; operated by T.J.C.
          </p>
        </div>
      </footer>
    </div>
  )
}
