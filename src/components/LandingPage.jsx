import { Link } from 'react-router-dom'
import { ROUTES } from '../routes.js'
import Seo from './Seo.jsx'

/**
 * Home (/) — Faceless Blur Root Directory hub (primary landing page).
 */
export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-black">
      <Seo pageKey="home" />
      <div className="fb-atmosphere" aria-hidden="true" />

      <div className="relative z-10">
        <header className="border-b border-[#00ffc2]/40 bg-black">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-8">
            <p className="fb-brand">Faceless Blur</p>
            <span className="fb-brand-meta">Portfolio Hub</span>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-10">
          <div className="fb-glass rounded-lg p-5 sm:p-6">
            <p className="fb-body text-[#00ffc2]">
              FACELESS_BLUR_OS // ROOT_DIRECTORY
            </p>
            <p className="fb-body fb-muted mt-3">
              Select an operation:_
              <span className="ml-0.5 inline-block animate-pulse text-[#00ffc2]">
                ▌
              </span>
            </p>

            <nav className="mt-8 space-y-3" aria-label="Project directory">
              <Link
                to={ROUTES.HOSPITAL}
                className="fb-body group flex flex-col gap-1 border border-transparent px-2 py-2 transition hover:border-[#00ffc2] hover:bg-[#00ffc2]/5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <span className="font-semibold text-[#00ffc2] group-hover:underline">
                  [01] CSV Hospital
                </span>
                <span className="text-[#00ffc2]/90 group-hover:text-[#00ffc2]">
                  [STATUS: ONLINE]
                </span>
              </Link>

              <div
                className="fb-body fb-status flex flex-col gap-1 px-2 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                aria-disabled="true"
              >
                <span className="text-gray-200">[02] Cyber Cube Heaven</span>
                <span className="text-amber-300">[STATUS: IN_DEVELOPMENT]</span>
              </div>

              <div
                className="fb-body fb-status flex flex-col gap-1 px-2 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                aria-disabled="true"
              >
                <span className="text-gray-200">[03] [REDACTED]</span>
                <span className="text-gray-300">[STATUS: LOCKED]</span>
              </div>
            </nav>

            <p className="fb-body fb-muted mt-8">
              $ ls ./ops — enter [01] to launch CSV Hospital
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
