import { useState } from 'react'
import { apiUrl } from '../utils/apiBase.js'

/**
 * Lightweight, privacy-focused email capture for CSV Hospital.
 * Matches csvh medical layout; no CSV upload — email + explicit consent only.
 */
export default function EmailCapture({ source = 'homepage' }) {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [message, setMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    if (status === 'loading') return

    setStatus('loading')
    setMessage('')

    try {
      const response = await fetch(apiUrl('/api/email-capture'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email,
          consent,
          source,
          website: honeypot,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok || data?.ok !== true) {
        setStatus('error')
        setMessage(
          typeof data?.error === 'string'
            ? data.error
            : 'Could not save your email. Please try again.',
        )
        return
      }

      setStatus('success')
      setMessage(
        typeof data?.message === 'string'
          ? data.message
          : 'You are on the list. Check your inbox for confirmation.',
      )
      setEmail('')
      setConsent(false)
    } catch {
      setStatus('error')
      setMessage('Network error. Please try again in a moment.')
    }
  }

  return (
    <section
      id="updates"
      className="csvh-section csvh-band"
      aria-labelledby="email-capture-heading"
    >
      <div className="csvh-wrap csvh-narrow">
        <div className="csvh-section-head">
          <h2 id="email-capture-heading">Stay on the ward list</h2>
          <p>
            Occasional discharge tips only. We never ask for your spreadsheet here —
            email stays optional and private.
          </p>
        </div>

        <form className="csvh-email-capture" onSubmit={handleSubmit} noValidate>
          {/* Honeypot — visually hidden from humans */}
          <label className="csvh-hp" aria-hidden="true">
            Company website
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </label>

          <div className="csvh-email-capture-row">
            <label className="sr-only" htmlFor="csvh-email-capture-input">
              Email address
            </label>
            <input
              id="csvh-email-capture-input"
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === 'loading' || status === 'success'}
              className="csvh-email-capture-input"
            />
            <button
              type="submit"
              className="csvh-cta csvh-cta-secondary"
              disabled={status === 'loading' || status === 'success' || !consent}
            >
              {status === 'loading' ? 'Saving…' : 'Join the list'}
            </button>
          </div>

          <label className="csvh-email-capture-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={status === 'loading' || status === 'success'}
              required
            />
            <span>
              I agree to receive occasional product notes from CSV Hospital. No CSV
              files are uploaded with this form. Unsubscribe anytime by reply.
            </span>
          </label>

          {message ? (
            <p
              className={
                status === 'error' ? 'csvh-email-capture-msg is-error' : 'csvh-email-capture-msg'
              }
              role={status === 'error' ? 'alert' : 'status'}
            >
              {message}
            </p>
          ) : (
            <p className="csvh-email-capture-privacy">
              Privacy-first: this captures your email only — triage of spreadsheets still
              happens on your device.
            </p>
          )}
        </form>
      </div>
    </section>
  )
}
