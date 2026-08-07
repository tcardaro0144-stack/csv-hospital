import { Link, Navigate, useParams } from 'react-router-dom'
import GuideChrome from './GuideChrome.jsx'
import Seo from './Seo.jsx'
import { loadGuide } from '../content/guides/index.js'
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

function GuideBlockView({ block }) {
  if (block.type === 'h2') {
    return <h2>{block.text}</h2>
  }
  if (block.type === 'h3') {
    return <h3>{block.text}</h3>
  }
  if (block.type === 'p') {
    return <p>{block.text}</p>
  }
  if (block.type === 'ul') {
    return (
      <ul>
        {(block.items || []).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }
  if (block.type === 'ol') {
    return (
      <ol>
        {(block.items || []).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    )
  }
  if (block.type === 'pre') {
    return (
      <pre className="csvh-guide-pre">
        <code>{block.code}</code>
      </pre>
    )
  }
  if (block.type === 'callout') {
    return (
      <aside
        className={`csvh-guide-callout csvh-guide-callout--${block.tone || 'signal'}`}
        role="note"
      >
        <p>{block.text}</p>
      </aside>
    )
  }
  return null
}

/**
 * /guides/:slug — single guide article with meta + Article JSON-LD.
 */
export default function GuideArticlePage() {
  const { slug } = useParams()
  const loaded = loadGuide(slug)

  if (!loaded) {
    return <Navigate to={ROUTES.GUIDES} replace />
  }

  const { meta, body } = loaded

  return (
    <GuideChrome current="guides">
      <Seo
        pageKey="guide"
        guide={{
          title: meta.title,
          description: meta.description,
          path: `/guides/${meta.slug}`,
          publishedAt: meta.publishedAt,
          updatedAt: meta.updatedAt || meta.publishedAt,
        }}
      />

      <main id="top" className="csvh-section">
        <article className="csvh-wrap csvh-guide-article">
          <header className="csvh-section-head">
            <p className="csvh-eyebrow">
              <span className="csvh-cross csvh-cross-sm" aria-hidden="true" />
              Guide
            </p>
            <h1>{meta.title}</h1>
            <p className="csvh-guide-byline">
              <time dateTime={meta.publishedAt}>{formatDate(meta.publishedAt)}</time>
              {meta.readingMinutes ? (
                <>
                  <span aria-hidden="true"> · </span>
                  <span>{meta.readingMinutes} min read</span>
                </>
              ) : null}
              <span aria-hidden="true"> · </span>
              <Link to={ROUTES.ROOT}>csvhospital.com</Link>
            </p>
          </header>

          <div className="csvh-guide-body">
            {(body.blocks || []).map((block, i) => (
              <GuideBlockView key={`${block.type}-${i}`} block={block} />
            ))}
          </div>

          <p className="csvh-guide-admit">
            <Link to={ROUTES.ROOT} className="csvh-btn">
              Admit a CSV at CSV Hospital
            </Link>
          </p>

          <p className="csvh-legal-back">
            <Link to={ROUTES.GUIDES}>← All guides</Link>
          </p>
        </article>
      </main>
    </GuideChrome>
  )
}
