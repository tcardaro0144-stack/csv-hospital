import {
  getResendApiKey,
  getSupportFromEmail,
} from '../api/_lib/env.js'
import { queueMakeTrigger } from './makeWebhook.js'

/** Fixed recipient for needs_human Resend alerts. */
const SUPPORT_ALERT_EMAIL = 'tcardaro0144@gmail.com'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildEmailBodies({ summary, message, customerEmail }) {
  const safeSummary = String(summary || 'No summary provided.').slice(0, 1000)
  const safeMessage = String(message || '').slice(0, 4000)
  const safeCustomer = customerEmail
    ? String(customerEmail).slice(0, 254)
    : null

  const text = [
    'CSV Hospital — support handoff',
    '',
    'Summary:',
    safeSummary,
    '',
    safeCustomer ? `Visitor email:\n${safeCustomer}\n` : null,
    'Original customer question:',
    safeMessage,
    '',
    '— Sent by CSV Hospital Frontline handoff',
  ]
    .filter((line) => line != null)
    .join('\n')

  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a">
      <h2 style="margin:0 0 12px">Support handoff — needs human</h2>
      <p style="margin:0 0 8px"><strong>Summary</strong></p>
      <p style="margin:0 0 16px;white-space:pre-wrap">${escapeHtml(safeSummary)}</p>
      ${
        safeCustomer
          ? `<p style="margin:0 0 8px"><strong>Visitor email</strong></p>
      <p style="margin:0 0 16px"><a href="mailto:${escapeHtml(safeCustomer)}">${escapeHtml(safeCustomer)}</a></p>`
          : ''
      }
      <p style="margin:0 0 8px"><strong>Original customer question</strong></p>
      <pre style="margin:0;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;white-space:pre-wrap;font-family:inherit">${escapeHtml(safeMessage)}</pre>
    </div>
  `.trim()

  const subjectEmail = safeCustomer ? ` · ${safeCustomer}` : ''
  return {
    text,
    html,
    subject: `support handoff${subjectEmail}: ${safeSummary.slice(0, 60)}`,
  }
}

async function sendViaResend({
  to,
  from,
  summary,
  message,
  customerEmail,
  apiKey,
}) {
  const { text, html, subject } = buildEmailBodies({
    summary,
    message,
    customerEmail,
  })

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
        to: [to],
        reply_to: customerEmail || undefined,
        subject,
        text,
        html,
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('Resend error:', response.status, detail.slice(0, 300))
      throw new Error('Email provider request failed.')
    }

    const data = await response.json().catch(() => ({}))
    return {
      queued: true,
      provider: 'resend',
      to,
      id: typeof data.id === 'string' ? data.id : null,
    }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Send a support handoff / needs_human alert to the internal inbox.
 *
 * @param {{
 *   summary: string,
 *   message: string,
 *   customerEmail?: string,
 *   supportEmail?: string,
 * }} payload
 */
export async function notifySupport({
  summary,
  message,
  customerEmail,
  supportEmail,
}) {
  const to = SUPPORT_ALERT_EMAIL
  const apiKey = getResendApiKey()
  const from =
    getSupportFromEmail() || 'CSV Hospital Support <onboarding@resend.dev>'
  const visitorEmail =
    typeof customerEmail === 'string' && customerEmail.trim()
      ? customerEmail.trim().toLowerCase()
      : null

  // Optional override kept for tests; production always alerts the fixed inbox above.
  void supportEmail

  queueMakeTrigger('support.needs_human', {
    summary: String(summary || '').slice(0, 1000),
    message: String(message || '').slice(0, 4000),
    customerEmail: visitorEmail,
    to,
  })

  if (!apiKey) {
    console.warn(
      '[notifySupport] RESEND_API_KEY is missing or still a placeholder (re_...).',
      `Alert to ${to} was not sent.`,
    )
    return {
      queued: false,
      provider: 'placeholder',
      to,
      id: null,
    }
  }

  try {
    return await sendViaResend({
      to,
      from,
      summary,
      message,
      customerEmail: visitorEmail,
      apiKey,
    })
  } catch (error) {
    console.error('notifySupport Resend send failed:', error.message)
    return {
      queued: false,
      provider: 'resend_error',
      to,
      id: null,
    }
  }
}
