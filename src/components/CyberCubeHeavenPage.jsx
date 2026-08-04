import { Link } from 'react-router-dom'
import Seo from './Seo.jsx'
import { ROUTES } from '../routes.js'

/**
 * Cyber Cube Heaven — routed at /cyber-cube-heaven
 * Terminal / Root Directory visual language (black + neon cyan).
 * Final build shipping soon — public frequencies still closed.
 */
export default function CyberCubeHeavenPage() {
  return (
    <div className="relative min-h-screen bg-black">
      <Seo pageKey="cyberCubeHeaven" />
      <div className="fb-atmosphere" aria-hidden="true" />

      <div className="relative z-10">
        <header className="border-b border-[#00ffc2]/40 bg-black">
          <div className="mx-auto flex max-w-3xl items-start justify-between gap-4 px-6 py-8">
            <div>
              <Link to={ROUTES.ROOT} className="fb-brand mb-2 inline-block">
                CSV Hospital
              </Link>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
                Cyber Cube Heaven
              </h1>
              <p className="fb-body fb-muted mt-1">
                Where everyone is welcome — neon grid
              </p>
            </div>
            <span className="fb-brand-meta shrink-0 rounded-full border border-[#00ffc2]/60 px-3 py-1 text-[#00ffc2]">
              COMING_SOON
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
          <section className="fb-glass rounded-lg p-5 sm:p-6" aria-labelledby="cch-world">
            <p className="fb-body text-[#00ffc2]">Cyber Cube Heaven</p>
            <div className="mt-6 flex flex-col items-center text-center">
              <p className="fb-body text-2xl font-bold tracking-tight text-[#00ffc2] sm:text-3xl">
                A T.J.C. Production
              </p>
            </div>

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
              Brand signal stays loud — welcome to the cube, even when the grid
              wants you gone.
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
            className="fb-glass fb-terminal-glow rounded-lg border border-[#00ffc2]/30 p-5 sm:p-6"
            aria-label="Public broadcast status"
            id="release"
          >
            <p className="fb-body">$ status --public_broadcast</p>
            <p className="fb-body mt-4">
              -&gt; awaiting final video deployment before opening public
              frequencies
            </p>
            <p className="fb-body mt-2">
              -&gt; check back on the home page for status updates
            </p>
          </section>

          <p className="fb-body fb-muted text-sm">
            <Link to={ROUTES.ROOT} className="text-[#00ffc2] hover:underline">
              ← Home
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
