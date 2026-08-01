/**
 * Frontline CS log bus — transcripts / triage / escalations only.
 * Posts to #frontline-cs-logs (never command-channel or agent-notifications).
 */

/** @type {null | ((content: string, opts?: object) => Promise<object>)} */
let frontlineLogSender = null

export function setDiscordFrontlineLogSender(fn) {
  frontlineLogSender = typeof fn === 'function' ? fn : null
}

export function hasDiscordFrontlineLogSender() {
  return typeof frontlineLogSender === 'function'
}

/**
 * @param {string} content
 * @param {{ kind?: string, title?: string }} [opts]
 */
export async function sendFrontlineCsLog(content, opts = {}) {
  const text = String(content || '').trim().slice(0, 1900)
  if (!text) return { delivered: false, channel: 'empty' }
  if (!frontlineLogSender) {
    return { delivered: false, channel: 'none' }
  }
  try {
    return await frontlineLogSender(text, {
      agent: 'frontline',
      kind: opts.kind || 'transcript',
      title: opts.title,
    })
  } catch (error) {
    console.error('[frontline-cs-logs] send failed:', error.message)
    return { delivered: false, channel: 'error', error: String(error.message || error) }
  }
}

/**
 * Format a triage / Discord Frontline exchange for the CS logs channel.
 * @param {object} entry
 */
export function formatFrontlineCsLog(entry = {}) {
  const kind = String(entry.kind || 'transcript').toUpperCase()
  const source = entry.source || 'unknown'
  const outcome = entry.outcome || 'n/a'
  const confidence =
    entry.confidence != null && Number.isFinite(Number(entry.confidence))
      ? Number(entry.confidence).toFixed(2)
      : null

  const customer = String(entry.message || entry.customerMessage || '')
    .trim()
    .slice(0, 700)
  const reply = entry.reply ? String(entry.reply).trim().slice(0, 700) : null
  const summary = entry.summary
    ? String(entry.summary).trim().slice(0, 500)
    : null
  const matched = entry.matchedQuestion
    ? String(entry.matchedQuestion).trim().slice(0, 200)
    : null

  const lines = [
    `\`[${kind}]\` **Frontline CS log** · ${source}`,
    `Outcome: \`${outcome}\`${confidence != null ? ` · confidence ${confidence}` : ''}`,
    entry.discordTag ? `Discord: ${entry.discordTag}` : null,
    matched ? `FAQ: ${matched}` : null,
    '',
    customer ? `**Customer**\n${customer}` : null,
    reply ? `\n**Frontline reply**\n${reply}` : null,
    summary ? `\n**Triage / escalation note**\n${summary}` : null,
    entry.extra ? `\n${String(entry.extra).slice(0, 400)}` : null,
  ].filter(Boolean)

  return lines.join('\n').slice(0, 1900)
}

/**
 * Log a Frontline interaction (best-effort; never throws to callers).
 */
export async function logFrontlineCsEvent(entry) {
  const body = formatFrontlineCsLog(entry)
  const kind =
    entry.outcome === 'needs_human'
      ? 'escalation'
      : entry.kind || 'transcript'
  const result = await sendFrontlineCsLog(body, {
    kind,
    title: entry.title,
  })
  if (!result.delivered) {
    console.log('[frontline-cs-logs] (undelivered)', {
      channel: result.channel,
      outcome: entry.outcome,
      source: entry.source,
    })
  }
  return result
}

export default {
  setDiscordFrontlineLogSender,
  hasDiscordFrontlineLogSender,
  sendFrontlineCsLog,
  formatFrontlineCsLog,
  logFrontlineCsEvent,
}
