import { Link } from 'react-router-dom'
import Seo from './Seo.jsx'
import { DirectoryRow } from './DirectoryRows.jsx'
import { pageCount } from '../directoryOps.js'
import { ROUTES } from '../routes.js'

/**
 * Shared Root Directory chrome for page 1 (/) and page 2 (/2).
 * @param {{ pageIndex: number, ops: object[], seoKey?: string, footerHint: string }} props
 */
export default function RootDirectoryShell({
  pageIndex,
  ops,
  seoKey = 'home',
  footerHint,
}) {
  const total = pageCount()
  const pageNum = pageIndex + 1
  const isPage2 = pageIndex === 1

  return (
    <div className="relative min-h-screen bg-black">
      <Seo pageKey={seoKey} />
      <div className="fb-atmosphere" aria-hidden="true" />

      <div className="relative z-10">
        <header className="border-b border-[#00ffc2]/40 bg-black">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-8">
            <p className="fb-brand">Faceless Blur</p>
            <span className="fb-brand-meta">Portfolio Hub</span>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-10">
          <div
            className={`fb-glass rounded-lg p-5 sm:p-6 ${isPage2 ? 'fb-dir-page2' : ''}`}
            data-page={pageNum}
          >
            <p className="fb-body text-[#00ffc2]">
              FACELESS_BLUR_OS // ROOT_DIRECTORY
            </p>
            <p className="fb-body fb-muted mt-3">
              Select an operation:_
              <span className="ml-0.5 inline-block animate-pulse text-[#00ffc2]">
                ▌
              </span>
            </p>

            <nav
              className="mt-8 space-y-3"
              aria-label="Project directory"
              aria-live="polite"
            >
              {/* Explicit map — every op in the passed list is rendered */}
              {ops.map((op) => (
                <DirectoryRow key={`op-${op.id}-${op.kind}`} op={op} />
              ))}
            </nav>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#00ffc2]/20 pt-4">
              <p className="fb-body fb-muted text-sm">
                $ ls ./ops — page {pageNum}/{total}
              </p>
              <div
                className="flex items-center gap-2"
                role="group"
                aria-label="Directory pagination"
              >
                {pageIndex === 0 ? (
                  <button
                    type="button"
                    className="fb-page-btn"
                    disabled
                    aria-label="Previous page"
                  >
                    ← prev
                  </button>
                ) : (
                  <Link
                    to={ROUTES.ROOT}
                    className="fb-page-btn"
                    aria-label="Previous page"
                  >
                    ← prev
                  </Link>
                )}
                {pageIndex >= total - 1 ? (
                  <button
                    type="button"
                    className="fb-page-btn"
                    disabled
                    aria-label="Next page"
                  >
                    next →
                  </button>
                ) : (
                  <Link
                    to={ROUTES.ROOT_PAGE_2}
                    className="fb-page-btn"
                    aria-label="Next page"
                  >
                    next →
                  </Link>
                )}
              </div>
            </div>

            <p className="fb-body fb-muted mt-4">{footerHint}</p>
          </div>
        </main>
      </div>
    </div>
  )
}
