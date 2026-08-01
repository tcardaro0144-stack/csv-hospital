import { useState } from 'react'
import { apiUrl } from '../utils/apiBase.js'

/**
 * Public-facing customer service chat (frontline AI via /api/support-triage).
 * On knowledge gaps / human flags: asks for email, then queues a support handoff.
 */
export default function SupportChat() {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [awaitingEmail, setAwaitingEmail] = useState(false)
  const [pendingQuestion, setPendingQuestion] = useState(null)
  const [pendingSummary, setPendingSummary] = useState(null)
  const [thread, setThread] = useState([
    {
      role: 'assistant',
      text: "Welcome to Faceless Blur's support desk. I'm the Frontline AI — sharp on the tools, warm on the welcome. Ask about CSV Hospital, the ecosystem ethos, or what's brewing next (like Cyber Cube Heaven). You're valued here.",
    },
  ])

  async function sendMessage(event) {
    event.preventDefault()
    const text = message.trim()
    if (!text || busy) return

    setBusy(true)
    setError(null)
    setMessage('')
    setThread((prev) => [...prev, { role: 'user', text }])

    const body = awaitingEmail
      ? {
          action: 'submit_handoff',
          email: text,
          originalQuestion: pendingQuestion || text,
          summary: pendingSummary || undefined,
          message: text,
        }
      : { message: text }

    try {
      const response = await fetch(apiUrl('/api/support-triage'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok && !data.reply && !data.summary) {
        throw new Error(data.error || `Support unavailable (${response.status}).`)
      }

      if (data.outcome === 'awaiting_email' || data.collectEmail) {
        setAwaitingEmail(true)
        setPendingQuestion(
          typeof data.originalQuestion === 'string' && data.originalQuestion.trim()
            ? data.originalQuestion
            : pendingQuestion || text,
        )
        setPendingSummary(
          typeof data.summary === 'string' && data.summary.trim()
            ? data.summary
            : pendingSummary,
        )
      } else if (data.outcome === 'handoff_queued') {
        setAwaitingEmail(false)
        setPendingQuestion(null)
        setPendingSummary(null)
      } else if (!awaitingEmail) {
        setAwaitingEmail(false)
        setPendingQuestion(null)
        setPendingSummary(null)
      }

      const reply =
        (typeof data.reply === 'string' && data.reply.trim()) ||
        (data.outcome === 'awaiting_email'
          ? "I don't have a confident answer in my knowledge base. Please reply with your email so a human teammate can follow up."
          : null) ||
        (data.outcome === 'handoff_queued'
          ? "Thanks — your question is in our support queue. We'll follow up by email."
          : null) ||
        (data.outcome === 'needs_human'
          ? "I've flagged this for a human teammate. Please reply with your email so we can reach you."
          : null) ||
        "I couldn't form a reply just now. Please try again."

      setThread((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: reply,
          meta:
            data.securityFlag ||
            data.outcome === 'awaiting_email' ||
            data.outcome === 'handoff_queued' ||
            data.outcome === 'needs_human'
              ? data.outcome || data.securityFlag
              : null,
        },
      ])
    } catch (err) {
      setError(err?.message || 'Unable to reach support.')
      setThread((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Support channel hiccup — please try again in a moment.',
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      id="support-chat"
      aria-label="Customer service chat"
      className="fb-glass mt-10 rounded-lg border border-[#00ffc2]/40 px-5 py-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] uppercase tracking-widest text-[#00ffc2]">
          Support desk
        </h2>
        <span className="fb-brand-meta text-[#00ffc2]/80">Frontline AI</span>
      </div>
      <p className="fb-body fb-muted mt-1 text-sm">
        Friendly help for CSV Hospital — product questions only. Admin claims require
        verification.
      </p>

      <div
        className="mt-4 max-h-64 space-y-3 overflow-y-auto rounded border border-gray-800 bg-black/60 px-3 py-3"
        role="log"
        aria-live="polite"
      >
        {thread.map((entry, index) => (
          <div
            key={`${entry.role}-${index}`}
            className={
              entry.role === 'user'
                ? 'ml-6 rounded border border-[#00ffc2]/30 bg-[#00ffc2]/5 px-3 py-2 text-sm text-[#00ffc2]'
                : 'mr-6 rounded border border-gray-700 px-3 py-2 text-sm text-gray-200'
            }
          >
            <p className="fb-muted mb-1 text-[10px] uppercase tracking-wider">
              {entry.role === 'user' ? 'You' : 'Support'}
            </p>
            <p className="whitespace-pre-wrap">{entry.text}</p>
          </div>
        ))}
      </div>

      <form onSubmit={sendMessage} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="support-chat-input" className="sr-only">
          {awaitingEmail ? 'Email for human follow-up' : 'Message support'}
        </label>
        <input
          id="support-chat-input"
          type={awaitingEmail ? 'email' : 'text'}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={busy}
          placeholder={
            awaitingEmail
              ? 'you@email.com — so a human can follow up'
              : 'Ask about admit, discharge, or checkout…'
          }
          className="fb-body min-w-0 flex-1 rounded border border-gray-700 bg-black px-3 py-2 text-sm text-[#00ffc2] placeholder:text-gray-500 focus:border-[#00ffc2] focus:outline-none"
          maxLength={awaitingEmail ? 254 : 2000}
          autoComplete={awaitingEmail ? 'email' : 'off'}
        />
        <button
          type="submit"
          disabled={busy || !message.trim()}
          className="fb-btn disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Sending…' : awaitingEmail ? 'Send email' : 'Send'}
        </button>
      </form>

      {error ? (
        <p className="mt-2 text-xs text-amber-300" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
