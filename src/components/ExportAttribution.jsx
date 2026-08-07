import { useState } from 'react'
import { CSV_EXPORT_FOOTER } from '../utils/exportCsv.js'

const SHARE_URL = 'https://csvhospital.com/'
const SHARE_BLURB =
  'CSV Hospital — heal messy spreadsheets in your browser. https://csvhospital.com/'

/**
 * Subtle neon attribution strip on the post-triage / discharge panel.
 * One-click copy for sharing the tool; mirrors the lightweight `#` footer
 * appended to discharged CSV files.
 */
export default function ExportAttribution({ compact = false }) {
  const [copied, setCopied] = useState(false)

  async function copyShare(event) {
    event.preventDefault()
    const payload = SHARE_BLURB
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload)
      } else {
        const ta = document.createElement('textarea')
        ta.value = payload
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <aside
      className="csvh-export-mark"
      aria-label="CSV Hospital export attribution"
    >
      <div className="csvh-export-mark-row">
        <span className="csvh-export-mark-sig" aria-hidden="true">
          ⌁
        </span>
        <p className="csvh-export-mark-text">
          <span className="csvh-export-mark-brand">CSV Hospital</span>
          {!compact ? (
            <>
              {' '}
              · healed in-browser ·{' '}
              <a href={SHARE_URL} target="_blank" rel="noopener noreferrer">
                csvhospital.com
              </a>
            </>
          ) : (
            <>
              {' '}
              ·{' '}
              <a href={SHARE_URL} target="_blank" rel="noopener noreferrer">
                csvhospital.com
              </a>
            </>
          )}
        </p>
        <button
          type="button"
          className="csvh-export-mark-share"
          onClick={copyShare}
          aria-live="polite"
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      {!compact ? (
        <p className="csvh-export-mark-meta">
          Discharged files end with a one-line comment you can delete anytime:{' '}
          <code>{CSV_EXPORT_FOOTER}</code>
        </p>
      ) : null}
    </aside>
  )
}
