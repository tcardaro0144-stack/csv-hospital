/**
 * Privacy-focused email capture for CSV Hospital.
 *
 * Storage: Make.com webhook (event `email.capture`) — secure CRM / sheet / datastore.
 * Auto-response: Resend email to the subscriber + Make can also drive SMS/email scenarios.
 * No CSV or spreadsheet content is accepted or stored.
 */

import {
  getResendApiKey,
  getSupportFromEmail,
} from '../api/_lib/env.js'
import { validateCustomerEmail } from './supportHandoff.js'
import { queueMakeTrigger, sendMakeTrigger } from './makeWebhook.js'
import { notifySupport } from './notifySupport.js'

const ALLOWED_SOURCES = new Set([
  'homepage',
  'footer',
  'guides',
  'discharge',
  'unknown',
])

const AUTO_REPLY_SUBJECT = 'You are on the CSV Hospital list'
const AUTO_REPLY_TEXT = [
  'Thanks for joining the CSV Hospital list.',
  '',
  'We only use this email for occasional product notes and discharge tips.',
  'Your spreadsheets stay on your device — this signup never uploads a CSV.',
  '',
  'If this was not you, reply “unsubscribe” and we will remove you.',
  '',
  '— CSV Hospital',
  'https://csvhospital.com/',
].join('\n')

function buildAutoReplyHtml() {
  return `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;max-width:32rem">
      <h2 style="margin:0 0 12px;color:#0f172a">You are on the CSV Hospital list</h2>
      <p style="margin:0 0 12px">Thanks for joining.</p>
      <p style="margin:0 0 12px">We only use this email for occasional product notes and discharge tips. Your spreadsheets stay on your device — this signup never uploads a CSV.</p>
      <p style="margin:0 0 12px">If this was not you, reply <strong>unsubscribe</strong> and we will remove you.</p>
      <p style="margin:16px 0 0;font-size:13px;color:#64748b">— CSV Hospital · <a href="https://csvhospital.com/">csvhospital.com</a></p>
    </div>
  `.trim()
}

/**
 * @param {unknown} value
 */
function normalizeSource(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase().slice(0, 40) : ''
  return ALLOWED_SOURCES.has(raw) ? raw : 'unknown'
}

/**
 * Send confirmation email to the subscriber via Resend.
 * @param {string} email
 */
async function sendCaptureAutoReply(email) {
  const apiKey = getResendApiKey()
  const from =
    getSupportFromEmail() || 'CSV Hospital <onboarding@resend.dev>'

  if (!apiKey) {
    return { sent: false, reason: 'resend_not_configured' }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        from,
        to: [email],
        subject: AUTO_REPLY_SUBJECT,
        text: AUTO_REPLY_TEXT,
        html: buildAutoReplyHtml(),
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error(
        '[email-capture] auto-reply failed',
        response.status,
        detail.slice(0, 200),
      )
      return { sent: false, reason: 'resend_http_error' }
    }

    const data = await response.json().catch(() => ({}))
    return {
      sent: true,
      id: typeof data.id === 'string' ? data.id : null,
    }
  } catch (error) {
    console.error('[email-capture] auto-reply error:', error?.message || error)
    return {
      sent: false,
      reason: error?.name === 'AbortError' ? 'timeout' : 'network',
    }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Capture an opt-in email: validate → Make (secure store + flows) → auto-reply.
 *
 * @param {{
 *   email?: unknown,
 *   consent?: unknown,
 *   source?: unknown,
 *   honeypot?: unknown,
 *   notifyInbox?: boolean,
 * }} body
 * @returns {Promise<{ status: number, payload: Record<string, unknown> }>}
 */
export async function processEmailCapture(body = {}) {
  const input = body && typeof body === 'object' ? body : {}

  // Honeypot — bots fill hidden fields; humans leave blank.
  const honeypot = typeof input.website === 'string' ? input.website.trim() : ''
  if (honeypot) {
    return {
      status: 200,
      payload: { ok: true, queued: true },
    }
  }

  if (input.consent !== true && input.consent !== 'true' && input.consent !== 1) {
    return {
      status: 400,
      payload: {
        ok: false,
        error: 'Consent is required to join the list.',
      },
    }
  }

  const emailResult = validateCustomerEmail(input.email)
  if (!emailResult.ok) {
    return {
      status: 400,
      payload: { ok: false, error: emailResult.error },
    }
  }

  const email = emailResult.value
  const source = normalizeSource(input.source)

  // Await Make so failures can soft-warn; still return success to the visitor
  // when validation passed (do not leak infrastructure status).
  const makeResult = await sendMakeTrigger('email.capture', {
    email,
    source,
    consent: true,
    privacy: 'email_only_no_csv',
    autoReply: 'email',
  })

  const autoReply = await sendCaptureAutoReply(email)

  // Fire-and-forget duplicate signal for Make routers that only listen on queue.
  queueMakeTrigger('email.capture.queued', {
    email,
    source,
    makeSent: makeResult.sent === true,
    autoReplySent: autoReply.sent === true,
  })

  if (input.notifyInbox === true) {
    void notifySupport({
      summary: `New list signup (${source})`,
      message: `Privacy-focused email capture from csvhospital.com.\nSource: ${source}`,
      customerEmail: email,
    })
  }

  const masked = email.replace(/(.{2}).+(@.+)/, '$1…$2')

  return {
    status: 200,
    payload: {
      ok: true,
      queued: true,
      message:
        'You are on the list. Check your inbox for a short confirmation from CSV Hospital.',
      hint: `Confirmation headed to ${masked}`,
    },
  }
}
