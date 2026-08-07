import { Link } from 'react-router-dom'
import { ROUTES } from '../routes.js'

/**
 * Shared chrome for /guides (index + article) — matches CSV Hospital site system.
 */
export default function GuideChrome({ children, current = 'guides' }) {
  return (
    <div className="csvh-page min-h-screen">
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
            <Link
              to={ROUTES.GUIDES}
              className="csvh-nav-link"
              aria-current={current === 'guides' ? 'page' : undefined}
            >
              GUIDES
            </Link>
            <Link
              to={ROUTES.TERMS}
              className="csvh-nav-link"
              aria-current={current === 'terms' ? 'page' : undefined}
            >
              TERMS
            </Link>
          </nav>
        </div>
      </header>

      {children}

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
