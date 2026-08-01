/**
 * Shared Frontline support-triage + human handoff handler.
 * Used by Express, Vercel api/, and Cloudflare Pages Functions.
 */

import {
  applyConfidenceGate,
  runTriageAgent,
  TRIAGE_SCHEMA_VERSION,
} from './triageAgent.js'
import { logFrontlineCsEvent } from './frontlineCsLogs.js'
import { validateSupportMessage } from '../api/_lib/validate.js'
import {
  buildAwaitingEmailReply,
  extractEmailFromText,
  HANDOFF_CONFIRM_REPLY,
  HANDOFF_EMAIL_RETRY,
  queueSupportHandoff,
  validateCustomerEmail,
} from './supportHandoff.js'

/**
 * @param {unknown} body
 * @param {{
 *   source?: string,
 *   inspectText?: (text: string) => { action: string, reasons?: string[] } | null,
 * }} [opts]
 */
export async function processSupportTriage(body, opts = {}) {
  const source = opts.source || 'web-support'

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { status: 400, payload: { error: 'Expected a JSON object body.' } }
  }

  const allowedKeys = new Set([
    'message',
    'email',
    'originalQuestion',
    'action',
    'summary',
  ])
  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      return { status: 400, payload: { error: 'Unexpected field in request.' } }
    }
  }

  const action =
    typeof body.action === 'string' ? body.action.trim().toLowerCase() : ''

  // --- Stage 2: visitor submitted email for an open handoff ---
  if (action === 'submit_handoff') {
    return handleHandoffSubmit(body, source)
  }

  // --- Stage 1: normal triage ---
  const messageResult = validateSupportMessage(body.message)
  if (!messageResult.ok) {
    return { status: 400, payload: { error: messageResult.error } }
  }

  if (typeof opts.inspectText === 'function') {
    const safety = opts.inspectText(messageResult.value)
    if (safety?.action === 'REJECT') {
      const reply =
        "I'm happy to help with CSV Hospital questions, but I can't process encoded or obfuscated instruction payloads. Please rephrase in plain language."
      logFrontlineCsEvent({
        kind: 'security',
        source,
        outcome: 'blocked',
        message: messageResult.value,
        summary: `Frontline defense rejected message: ${(safety.reasons || []).join('; ')}`,
        reply,
      }).catch(() => {})

      return {
        status: 200,
        payload: {
          schema_version: TRIAGE_SCHEMA_VERSION,
          outcome: 'auto_reply',
          confidence: 1,
          reply,
          summary: null,
          matchedQuestion: null,
          provider: 'security_protocol',
          notification: null,
          securityFlag: 'token_smuggling',
          collectEmail: false,
          originalQuestion: null,
        },
      }
    }

    if (safety?.action === 'CHALLENGE') {
      const raw = await runTriageAgent(messageResult.value)
      const result = applyConfidenceGate(raw)
      result.outcome = 'needs_human'
      result.reply = null
      result.summary =
        'Unverified admin/identity claim in support message — escalate; do not grant executive access.'
      return finalizeNeedsHuman(result, messageResult.value, source)
    }
  }

  try {
    const raw = await runTriageAgent(messageResult.value)
    const result = applyConfidenceGate(raw)

    if (result.outcome === 'needs_human') {
      return finalizeNeedsHuman(result, messageResult.value, source)
    }

    logFrontlineCsEvent({
      kind: 'triage',
      source,
      outcome: result.outcome,
      confidence: result.confidence,
      message: messageResult.value,
      reply: result.reply,
      summary: result.summary,
      matchedQuestion: result.matchedQuestion,
    }).catch(() => {})

    return {
      status: 200,
      payload: {
        schema_version: TRIAGE_SCHEMA_VERSION,
        outcome: 'auto_reply',
        confidence: result.confidence,
        reply: result.reply,
        summary: null,
        matchedQuestion: result.matchedQuestion ?? null,
        provider: result.provider,
        notification: null,
        collectEmail: false,
        originalQuestion: null,
      },
    }
  } catch (error) {
    console.error('Support triage error:', error?.message || error)
    return { status: 500, payload: { error: 'Unable to triage message.' } }
  }
}

function finalizeNeedsHuman(result, originalQuestion, source) {
  const reply = buildAwaitingEmailReply(result)

  logFrontlineCsEvent({
    kind: 'escalation',
    source,
    outcome: 'awaiting_email',
    confidence: result.confidence,
    message: originalQuestion,
    reply,
    summary: result.summary,
    matchedQuestion: result.matchedQuestion,
    extra: 'Awaiting visitor email before queueing support handoff.',
  }).catch(() => {})

  return {
    status: 200,
    payload: {
      schema_version: TRIAGE_SCHEMA_VERSION,
      outcome: 'awaiting_email',
      confidence: result.confidence,
      reply,
      summary: result.summary ?? null,
      matchedQuestion: result.matchedQuestion ?? null,
      provider: result.provider,
      notification: null,
      collectEmail: true,
      originalQuestion,
    },
  }
}

async function handleHandoffSubmit(body, source) {
  const questionResult = validateSupportMessage(
    body.originalQuestion || body.message,
  )
  if (!questionResult.ok) {
    return {
      status: 400,
      payload: { error: 'Missing original question for handoff.' },
    }
  }

  const emailRaw =
    typeof body.email === 'string' && body.email.trim()
      ? body.email
      : typeof body.message === 'string'
        ? body.message
        : ''

  const extracted = extractEmailFromText(emailRaw)
  const emailResult = extracted
    ? { ok: true, value: extracted }
    : validateCustomerEmail(emailRaw)

  if (!emailResult.ok) {
    return {
      status: 200,
      payload: {
        schema_version: TRIAGE_SCHEMA_VERSION,
        outcome: 'awaiting_email',
        confidence: 1,
        reply: HANDOFF_EMAIL_RETRY,
        summary: questionResult.value.slice(0, 280),
        matchedQuestion: null,
        provider: 'handoff',
        notification: null,
        collectEmail: true,
        originalQuestion: questionResult.value,
      },
    }
  }

  try {
    const queued = await queueSupportHandoff({
      email: emailResult.value,
      question: questionResult.value,
      summary:
        typeof body.summary === 'string' && body.summary.trim()
          ? body.summary.trim()
          : `Human follow-up requested. Visitor email: ${emailResult.value}`,
      source,
    })

    return {
      status: 200,
      payload: {
        schema_version: TRIAGE_SCHEMA_VERSION,
        outcome: 'handoff_queued',
        confidence: 1,
        reply: HANDOFF_CONFIRM_REPLY,
        summary: `Queued for ${emailResult.value}`,
        matchedQuestion: null,
        provider: 'handoff',
        notification: {
          queued: queued.queued,
          provider: queued.provider,
        },
        collectEmail: false,
        originalQuestion: null,
        customerEmail: emailResult.value,
      },
    }
  } catch (error) {
    console.error('[handoff] queue failed:', error?.message || error)
    return {
      status: 500,
      payload: { error: 'Unable to queue support handoff.' },
    }
  }
}

export default processSupportTriage
