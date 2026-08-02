import { useState } from 'react'
import { Link } from 'react-router-dom'
import Seo from './Seo.jsx'
import { ROUTES } from '../routes.js'

const LAUNCH_NOTIFY_KEY = 'fb_cch_launch_notify_email'

/**
 * Cyber Cube Heaven — routed at /cyber-cube-heaven
 * Terminal / Root Directory visual language (black + neon cyan).
 * Final build shipping soon — not an early-access / beta track.
 */
export default function CyberCubeHeavenPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState(() => {
    if (typeof window === 'undefined') return 'idle'
    return window.localStorage.getItem(LAUNCH_NOTIFY_KEY) ? 'done' : 'idle'
  })
  const [error, setError] = useState(null)

  function handleNotify(e) {
    e.preventDefault()
    setError(null)
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Invalid address — retry with a valid email.')
      setStatus('error')
      return
    }
    try {
      window.localStorage.setItem(LAUNCH_NOTIFY_KEY, trimmed)
    } catch {
      /* ignore quota / private mode */
    }
    setStatus('done')
    setEmail('')
  }

  return (
    <div className="relative min-h-screen bg-black">
      <Seo pageKey="cyberCubeHeaven" />
      <div className="fb-atmosphere" aria-hidden="true" />

      <div className="relative z-10">
        <header className="border-b border-[#00ffc2]/40 bg-black">
          <div className="mx-auto flex max-w-3xl items-start justify-between gap-4 px-6 py-8">
            <div>
              <Link to={ROUTES.ROOT} className="fb-brand mb-2 inline-block">
                Faceless Blur
              </Link>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
                Cyber Cube Heaven
              </h1>
              <p className="fb-body fb-muted mt-1">
                Where everyone is welcome — neon grid · Summer Engine
              </p>
            </div>
            <span className="fb-brand-meta shrink-0 rounded-full border border-[#00ffc2]/60 px-3 py-1 text-[#00ffc2]">
              COMING_SOON
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
          <section className="fb-glass rounded-lg p-5 sm:p-6" aria-labelledby="cch-world">
            <p className="fb-body text-[#00ffc2]">
              FACELESS_BLUR_OS // OPS/[02]_CYBER_CUBE_HEAVEN
            </p>
            <p className="fb-body fb-muted mt-3">
              $ cat ./world.md_
              <span className="ml-0.5 inline-block animate-pulse text-[#00ffc2]">▌</span>
            </p>

            <h2 id="cch-world" className="mt-8 text-lg font-semibold text-white">
              Atmospheric mainframe
            </h2>
            <p className="fb-body mt-3 text-gray-200">
              Pilot Sentinel-7 across the infinite cyber grid — cyan wireframes,
              purple nebula voids, and glitch sectors humming under a constant
              C-sharp. Cyber Cube Heaven is a top-down arcade survival run through
              a hyperdimensional lattice: waves escalate, bosses corrupt the
              perimeter, and the neon never forgets how close the Null Signal
              came.
            </p>
            <p className="fb-body fb-muted mt-4">
              Built with Summer Engine. Brand signal stays loud — welcome to the
              cube, even when the grid wants you gone.
            </p>
          </section>

          <section className="fb-glass rounded-lg p-5 sm:p-6" aria-labelledby="cch-controls">
            <p className="fb-body text-[#00ffc2]">$ cat ./controls.mobile</p>
            <h2 id="cch-controls" className="mt-4 text-lg font-semibold text-white">
              Custom-tuned mobile controls
            </h2>
            <p className="fb-body mt-3 text-gray-200">
              Touch layouts are tuned for one-handed precision on the neon grid —
              not a pasted desktop map. Movement, fire, and module picks are
              spaced for thumbs under pressure so survival stays readable when
              the wave clock is screaming.
            </p>
            <ul className="fb-body mt-4 space-y-2 text-gray-300">
              <li>
                <span className="text-[#00ffc2]">›</span> Thumb-first movement
                arc calibrated for portrait play
              </li>
              <li>
                <span className="text-[#00ffc2]">›</span> Fire / module actions
                kept clear of the combat viewport
              </li>
              <li>
                <span className="text-[#00ffc2]">›</span> Pause and upgrade flows
                stay controller- and touch-legible
              </li>
            </ul>
          </section>

          <section
            className="fb-glass rounded-lg border border-[#00ffc2]/30 p-5 sm:p-6"
            aria-labelledby="cch-release"
            id="release"
          >
            <p className="fb-body text-[#00ffc2]">$ ./status --release final_build</p>
            <h2 id="cch-release" className="mt-4 text-lg font-semibold text-white">
              Final build — shipping soon
            </h2>
            <p className="fb-body mt-2 text-gray-200">
              No beta track. No drip access. When it drops, it&apos;s the full
              Cyber Cube Heaven release.
            </p>
            <p className="fb-body fb-muted mt-3">
              Optional: leave an address for a one-shot launch ping.
            </p>

            {status === 'done' ? (
              <div className="mt-6 rounded border border-[#00ffc2]/40 bg-[#00ffc2]/5 px-4 py-3">
                <p className="fb-body text-[#00ffc2]">
                  [OK] Launch notify armed. You&apos;ll hear when the final build
                  is live.
                </p>
              </div>
            ) : (
              <form className="mt-6 space-y-4" onSubmit={handleNotify} noValidate>
                <label className="block">
                  <span className="fb-body fb-muted text-sm">email@node</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(ev) => {
                      setEmail(ev.target.value)
                      if (status === 'error') setStatus('idle')
                    }}
                    placeholder="operator@domain.net"
                    className="fb-body mt-2 w-full rounded border border-[#00ffc2]/40 bg-black px-3 py-3 text-gray-100 outline-none placeholder:text-gray-600 focus:border-[#00ffc2] focus:ring-1 focus:ring-[#00ffc2]/40"
                  />
                </label>
                {error ? (
                  <p className="fb-body text-sm text-[#ff6b4a]" role="alert">
                    [ERR] {error}
                  </p>
                ) : null}
                <button type="submit" className="fb-page-btn w-full sm:w-auto">
                  notify --on-launch
                </button>
              </form>
            )}
          </section>

          <p className="fb-body fb-muted text-sm">
            <Link to={ROUTES.ROOT} className="text-[#00ffc2] hover:underline">
              ← cd ../ROOT_DIRECTORY
            </Link>
            {' · '}
            <Link to={ROUTES.HOSPITAL} className="text-[#00ffc2]/80 hover:underline">
              [01] CSV Hospital
            </Link>
          </p>
        </main>
      </div>
    </div>
  )
}
