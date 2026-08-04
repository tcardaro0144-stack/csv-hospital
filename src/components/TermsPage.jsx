import { Link } from 'react-router-dom'
import Seo from './Seo.jsx'
import { ROUTES } from '../routes.js'

const EFFECTIVE_DATE = 'August 4, 2026'

/**
 * CSV Hospital — Terms of Service (/terms).
 */
export default function TermsPage() {
  return (
    <div className="csvh-page min-h-screen">
      <Seo pageKey="terms" />

      <header className="csvh-header sticky top-0 z-40">
        <div className="csvh-wrap flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link to={ROUTES.ROOT} className="csvh-logo group inline-flex items-center gap-2.5">
            <span className="csvh-cross" aria-hidden="true" />
            <span>
              <span className="block text-lg font-extrabold tracking-tight text-[var(--csvh-ink)]">
                CSV Hospital
              </span>
              <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--csvh-blue)]">
                Digital ER for data
              </span>
            </span>
          </Link>

          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="CSV Hospital">
            <Link to={ROUTES.ROOT} className="csvh-nav-link">
              HOME
            </Link>
            <Link to={ROUTES.TERMS} className="csvh-nav-link" aria-current="page">
              TERMS OF SERVICE
            </Link>
          </nav>
        </div>
      </header>

      <main id="top" className="csvh-section">
        <article className="csvh-wrap csvh-legal">
          <header className="csvh-section-head">
            <p className="csvh-eyebrow">
              <span className="csvh-cross csvh-cross-sm" aria-hidden="true" />
              Legal ward
            </p>
            <h1>Terms of Service</h1>
            <p>Effective date: {EFFECTIVE_DATE}</p>
          </header>

          <section aria-labelledby="tos-owner">
            <h2 id="tos-owner">Ownership &amp; operation</h2>
            <p>
              CSV Hospital (the &ldquo;Service&rdquo;), available at{' '}
              <a href="https://csvhospital.com">csvhospital.com</a>, is owned and
              operated by <strong>T.J.C.</strong> By accessing or using the Service,
              you agree to these Terms of Service.
            </p>
          </section>

          <section aria-labelledby="tos-service">
            <h2 id="tos-service">The Service</h2>
            <p>
              CSV Hospital provides browser-based tools to triage and repair CSV
              files (including removing empty rows, trimming whitespace, and
              standardizing headers). File processing is designed to run locally in
              your browser. Optional one-time purchases unlock downloadable file
              credits for discharged (repaired) CSVs.
            </p>
          </section>

          <section aria-labelledby="tos-asis">
            <h2 id="tos-asis">As-is file processing</h2>
            <p>
              The Service is provided on an <strong>&ldquo;as is&rdquo;</strong> and{' '}
              <strong>&ldquo;as available&rdquo;</strong> basis. Data-repair and
              cleaning features are automated helpers, not a guarantee of perfect,
              complete, or error-free results for every file, dataset, encoding, or
              spreadsheet layout.
            </p>
            <p>
              T.J.C. and CSV Hospital make no warranties—express or implied—regarding
              fitness for a particular purpose, accuracy of repaired output,
              uninterrupted availability, or freedom from defects. You use the
              Service and any repaired files at your own risk.
            </p>
          </section>

          <section aria-labelledby="tos-backup">
            <h2 id="tos-backup">Your backup responsibility</h2>
            <p>
              You are solely responsible for retaining original copies and backups of
              your data before admitting a file to CSV Hospital. Always keep a
              separate backup of important CSVs. We are not liable for data loss,
              corruption, or incomplete repairs, including losses that result from
              browser crashes, device failure, network issues, or misuse of the
              Service.
            </p>
          </section>

          <section aria-labelledby="tos-credits">
            <h2 id="tos-credits">One-time credits — non-refundable</h2>
            <p>
              Healing-pass and discharge unlocks are sold as{' '}
              <strong>one-time, non-recurring credit purchases</strong> (not
              subscriptions). Unless required by applicable law,{' '}
              <strong>all credit purchases are final and non-refundable</strong>,
              including unused credits, accidental purchases, and purchases made for
              files that do not meet your expectations after processing.
            </p>
            <p>
              Credits are personal to your browser session / local unlock state unless
              otherwise stated at checkout. They have no cash value and are not
              transferable.
            </p>
          </section>

          <section aria-labelledby="tos-conduct">
            <h2 id="tos-conduct">Acceptable use</h2>
            <p>
              You agree not to misuse the Service, attempt to disrupt it, reverse
              engineer payment or unlock mechanisms, or use CSV Hospital for unlawful
              purposes. We may refuse or limit access when we reasonably believe these
              Terms have been violated.
            </p>
          </section>

          <section aria-labelledby="tos-liability">
            <h2 id="tos-liability">Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, T.J.C. and CSV Hospital shall
              not be liable for any indirect, incidental, special, consequential, or
              punitive damages, or any loss of data, profits, or business, arising
              from your use of the Service or reliance on repaired files—even if
              advised of the possibility of such damages.
            </p>
          </section>

          <section aria-labelledby="tos-changes">
            <h2 id="tos-changes">Changes</h2>
            <p>
              We may update these Terms from time to time. The effective date at the
              top of this page will be revised when material changes are posted.
              Continued use of the Service after changes constitutes acceptance of the
              updated Terms.
            </p>
          </section>

          <section aria-labelledby="tos-contact">
            <h2 id="tos-contact">Contact</h2>
            <p>
              Questions about these Terms may be directed through the support desk on{' '}
              <Link to={ROUTES.ROOT}>csvhospital.com</Link>.
            </p>
          </section>

          <p className="csvh-legal-back">
            <Link to={ROUTES.ROOT}>← Back to CSV Hospital</Link>
          </p>
        </article>
      </main>

      <footer className="csvh-footer">
        <div className="csvh-wrap csvh-footer-inner">
          <p>
            CSV Hospital is not a real hospital, but we are serious about clean data.
          </p>
          <p>
            <Link to={ROUTES.TERMS}>Terms of Service</Link>
            <span aria-hidden="true"> · </span>
            Owned &amp; operated by T.J.C.
          </p>
        </div>
      </footer>
    </div>
  )
}
