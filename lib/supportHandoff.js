/**
 * Human support handoff — collect visitor email, then forward to the support queue.
 */

import { notifySupport } from './notifySupport.js'
import { queueMakeTrigger } from './makeWebhook.js'
import { logFrontlineCsEvent } from './frontlineCsLogs.js'

export const HANDOFF_EMAIL_PROMPT =
  "I don't have a confident answer for that in my knowledge base, so I'd like a human teammate to follow up. Please reply with the best email address to reach you — I'll pass along your question so we can get back to you directly."

export const HANDOFF_CONFIRM_REPLY =
  "Thanks — I've passed your question and email to our support queue. A human teammate will follow up as soon as they can. You're welcome to ask another product question anytime."

export const HANDOFF_EMAIL_RETRY =
  "I still need a valid email address to route this to a human teammate (for example, you@domain.com). Please send just your email and I'll take it from there."

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

/**
 * @param {unknown} value
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function validateCustomerEmail(value) {
  if (value == null || value === '') {
    return { ok: false, error: 'Email is required.' }
  }
  if (typeof value !== 'string') {
    return { ok: false, error: 'Invalid email.' }
  }

  const trimmed = value.trim().toLowerCase().replace(/[<>]/g, '')
  if (trimmed.length < 5 || trimmed.length > 254) {
    return { ok: false, error: 'Invalid email.' }
  }
  if (!EMAIL_RE.test(trimmed) || trimmed.endsWith('@example.com')) {
    return { ok: false, error: 'Please provide a valid email address.' }
  }
  return { ok: true, value: trimmed }
}

/**
 * Pull a single email from free-form chat text if present.
 * @param {string} text
 */
export function extractEmailFromText(text) {
  const match = String(text || '').match(
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  )
  if (!match) return null
  const result = validateCustomerEmail(match[0])
  return result.ok ? result.value : null
}

/**
 * Public reply when triage escalates — ask for email before queueing.
 * @param {{ reply?: string | null, summary?: string | null }} result
 */
export function buildAwaitingEmailReply(result) {
  const prior =
    typeof result?.reply === 'string' && result.reply.trim()
      ? `${result.reply.trim()}\n\n`
      : ''
  return `${prior}${HANDOFF_EMAIL_PROMPT}`
}

/**
 * Forward handoff ticket to Resend inbox + Make webhook + Frontline CS logs.
 * @param {{
 *   email: string,
 *   question: string,
 *   summary?: string | null,
 *   source?: string,
 * }} payload
 */
export async function queueSupportHandoff(payload) {
  const email = String(payload.email || '').trim().toLowerCase()
  const question = String(payload.question || '').trim().slice(0, 4000)
  const summary = String(
    payload.summary || 'Visitor requested human follow-up after Frontline handoff.',
  ).slice(0, 1000)
  const source = payload.source || 'web-support'

  const notification = await notifySupport({
    summary,
    message: question,
    customerEmail: email,
  })

  queueMakeTrigger('support.handoff', {
    customerEmail: email,
    question,
    summary,
    source,
  })

  logFrontlineCsEvent({
    kind: 'escalation',
    source,
    outcome: 'handoff_queued',
    message: question,
    summary: `Handoff queued for ${email}: ${summary}`,
    reply: HANDOFF_CONFIRM_REPLY,
    extra: `Customer email: ${email} · notify=${notification?.queued ? 'queued' : 'not queued'} (${notification?.provider || 'n/a'})`,
  }).catch(() => {})

  return {
    queued: Boolean(notification?.queued) || Boolean(process.env.MAKE_WEBHOOK_URL),
    provider: notification?.provider || 'make',
    notification,
  }
}

export default {
  validateCustomerEmail,
  extractEmailFromText,
  buildAwaitingEmailReply,
  queueSupportHandoff,
  HANDOFF_EMAIL_PROMPT,
  HANDOFF_CONFIRM_REPLY,
  HANDOFF_EMAIL_RETRY,
}
