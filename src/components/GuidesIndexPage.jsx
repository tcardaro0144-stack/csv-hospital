import { Link } from 'react-router-dom'
import GuideChrome from './GuideChrome.jsx'
import Seo from './Seo.jsx'
import { GUIDES } from '../content/guides/index.js'
import { ROUTES } from '../routes.js'

function formatDate(iso) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(`${iso}T12:00:00Z`))
  } catch {
    return iso
  }
}

/**
 * /guides — technical article index (SEO + GEO).
 */
export default function GuidesIndexPage() {
  return (
    <GuideChrome current="guides">
      <Seo pageKey="guides" />

      <main id="top" className="csvh-section">
        <div className="csvh-wrap">
          <header className="csvh-section-head csvh-guides-hero">
            <p className="csvh-eyebrow">
              <span className="csvh-cross csvh-cross-sm" aria-hidden="true" />
              Field manuals
            </p>
            <h1>Guides</h1>
            <p>
              Technical notes from the ward — how messy CSVs break, and how to
              stabilize them without living inside a one-off script.
            </p>
          </header>

          <ul className="csvh-guide-list" aria-label="CSV Hospital guides">
            {GUIDES.map((guide) => (
              <li key={guide.slug} className="csvh-guide-card">
                <Link to={`${ROUTES.GUIDES}/${guide.slug}`} className="csvh-guide-card-link">
                  <span className="csvh-guide-card-meta">
                    <time dateTime={guide.publishedAt}>
                      {formatDate(guide.publishedAt)}
                    </time>
                    {guide.readingMinutes ? (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span>{guide.readingMinutes} min read</span>
                      </>
                    ) : null}
                  </span>
                  <h2>{guide.title}</h2>
                  <p>{guide.description}</p>
                  <span className="csvh-guide-card-cta">Read guide →</span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="csvh-legal-back">
            <Link to={ROUTES.ROOT}>← Back to CSV Hospital</Link>
          </p>
        </div>
      </main>
    </GuideChrome>
  )
}
