import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../routes.js'
import Seo from './Seo.jsx'

const PAGE_SIZE = 3

/**
 * Root directory ops (1-based display ids).
 * Page 1: [01]–[03] with Glitched Reality fully revealed in slot 3.
 * Page 2: only [04] [REDACTED].
 */
const DIRECTORY_OPS = [
  {
    id: 1,
    kind: 'link',
    label: 'CSV Hospital',
    status: 'ONLINE',
    statusClass: 'text-[#00ffc2]/90 group-hover:text-[#00ffc2]',
    to: ROUTES.HOSPITAL,
  },
  {
    id: 2,
    kind: 'static',
    label: 'Cyber Cube Heaven',
    status: 'IN_DEVELOPMENT',
    statusClass: 'text-amber-300',
  },
  {
    id: 3,
    kind: 'glitched',
    label: 'Glitched Reality',
    status: 'SIGNAL_DETECTED',
  },
  {
    id: 4,
    kind: 'redacted',
    status: 'LOCKED',
  },
]

function padId(id) {
  return String(id).padStart(2, '0')
}

function RedactedRow({ id, status }) {
  const [active, setActive] = useState(false)
  const isFourth = id === 4

  return (
    <div
      className={`fb-body fb-status fb-redact-row flex flex-col gap-1 px-2 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 ${
        isFourth ? 'fb-redact-row--fourth' : ''
      } ${isFourth && active ? 'fb-glitch-active' : ''}`}
      aria-disabled="true"
      data-redaction={id}
      onMouseEnter={() => isFourth && setActive(true)}
      onMouseLeave={() => isFourth && setActive(false)}
      onFocus={() => isFourth && setActive(true)}
      onBlur={() => isFourth && setActive(false)}
      tabIndex={isFourth ? 0 : undefined}
    >
      <span className={`text-gray-200 ${isFourth && active ? 'fb-glitch-text' : ''}`}>
        [{padId(id)}]{' '}
        <span
          className={
            isFourth && active ? 'fb-redact-bars fb-glitch-label' : 'fb-redact-bars'
          }
          data-text="[REDACTED]"
        >
          [REDACTED]
        </span>
      </span>
      <span className="text-gray-300">[STATUS: {status}]</span>
    </div>
  )
}

function GlitchedRealityRow({ op }) {
  const [active, setActive] = useState(false)

  return (
    <div
      className={`fb-body fb-glitch-row flex flex-col gap-1 border border-transparent px-2 py-2 transition hover:border-[#00ffc2]/50 hover:bg-[#00ffc2]/5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 ${
        active ? 'fb-glitch-active' : ''
      }`}
      aria-disabled="true"
      data-codename={op.label}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      tabIndex={0}
      role="listitem"
    >
      <span className="fb-glitch-text font-semibold text-[#00ffc2]">
        [{padId(op.id)}]{' '}
        <span className="fb-glitch-label" data-text={op.label}>
          {op.label}
        </span>
      </span>
      <span className="text-[#00ffc2]/80">[STATUS: {op.status}]</span>
    </div>
  )
}

function DirectoryRow({ op }) {
  if (op.kind === 'link') {
    return (
      <Link
        to={op.to}
        className="fb-body group flex flex-col gap-1 border border-transparent px-2 py-2 transition hover:border-[#00ffc2] hover:bg-[#00ffc2]/5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
      >
        <span className="font-semibold text-[#00ffc2] group-hover:underline">
          [{padId(op.id)}] {op.label}
        </span>
        <span className={op.statusClass}>[STATUS: {op.status}]</span>
      </Link>
    )
  }

  if (op.kind === 'static') {
    return (
      <div
        className="fb-body fb-status flex flex-col gap-1 px-2 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
        aria-disabled="true"
      >
        <span className="text-gray-200">
          [{padId(op.id)}] {op.label}
        </span>
        <span className={op.statusClass}>[STATUS: {op.status}]</span>
      </div>
    )
  }

  if (op.kind === 'glitched') {
    return <GlitchedRealityRow op={op} />
  }

  return <RedactedRow id={op.id} status={op.status} />
}

/**
 * Home (/) — Faceless Blur Root Directory hub (primary landing page).
 */
export default function LandingPage() {
  const [page, setPage] = useState(0)
  const pageCount = Math.ceil(DIRECTORY_OPS.length / PAGE_SIZE)

  const pageOps = useMemo(() => {
    const start = page * PAGE_SIZE
    return DIRECTORY_OPS.slice(start, start + PAGE_SIZE)
  }, [page])

  const isPage2 = page === 1

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
          <div
            className={`fb-glass rounded-lg p-5 sm:p-6 ${isPage2 ? 'fb-dir-page2' : ''}`}
            data-page={page + 1}
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
              {pageOps.map((op) => (
                <DirectoryRow key={op.id} op={op} />
              ))}
            </nav>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#00ffc2]/20 pt-4">
              <p className="fb-body fb-muted text-sm">
                $ ls ./ops — page {page + 1}/{pageCount}
              </p>
              <div
                className="flex items-center gap-2"
                role="group"
                aria-label="Directory pagination"
              >
                <button
                  type="button"
                  className="fb-page-btn"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  aria-label="Previous page"
                >
                  ← prev
                </button>
                <button
                  type="button"
                  className="fb-page-btn"
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={page >= pageCount - 1}
                  aria-label="Next page"
                >
                  next →
                </button>
              </div>
            </div>

            <p className="fb-body fb-muted mt-4">
              {isPage2
                ? '$ scan ./ops/page_2 — [04] classified / locked'
                : '$ ls ./ops — enter [01] to launch CSV Hospital'}
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
