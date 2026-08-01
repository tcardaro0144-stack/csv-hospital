/**
 * Discord outbound bus — split streams:
 *  - Command channel: conversational replies (optional chat sender)
 *  - Notifications channel: automated alerts / health / status only
 *
 * Notifications never run gauntlets or LLM chat.
 */

/** @type {null | ((content: string, opts?: object) => Promise<object>)} */
let chatSender = null
/** @type {null | ((content: string, opts?: object) => Promise<object>)} */
let notifySender = null

export function setDiscordChannelSender(fn) {
  chatSender = typeof fn === 'function' ? fn : null
}

export function setDiscordNotifySender(fn) {
  notifySender = typeof fn === 'function' ? fn : null
}

export function hasDiscordChannelSender() {
  return typeof chatSender === 'function'
}

export function hasDiscordNotifySender() {
  return typeof notifySender === 'function'
}

/**
 * Conversational / command-channel send (legacy name kept for compatibility).
 */
export async function sendViaDiscordBot(content, opts = {}) {
  if (!chatSender) {
    return { delivered: false, channel: 'none' }
  }
  try {
    return await chatSender(String(content || '').slice(0, 1900), opts)
  } catch (error) {
    console.error('[discord] chat outbound failed:', error.message)
    return { delivered: false, channel: 'error', error: String(error.message || error) }
  }
}

/**
 * Automated notification stream — health, anomalies, startup, status.
 * @param {string} content
 * @param {{ agent?: string, kind?: string, title?: string }} [opts]
 */
export async function sendDiscordNotification(content, opts = {}) {
  const text = formatNotificationPayload(content, opts)
  if (!notifySender) {
    return { delivered: false, channel: 'none' }
  }
  try {
    return await notifySender(text, {
      agent: opts.agent || 'bridge',
      kind: opts.kind || 'system',
      notify: true,
    })
  } catch (error) {
    console.error('[discord] notify outbound failed:', error.message)
    return { delivered: false, channel: 'error', error: String(error.message || error) }
  }
}

/**
 * Build a clean notification body (no chat prompts / gauntlet noise).
 */
export function formatNotificationPayload(content, opts = {}) {
  const body = String(content || '').trim().slice(0, 1800)
  if (!body) return ''

  const kind = String(opts.kind || 'system').toLowerCase()
  const title =
    opts.title ||
    (kind === 'anomaly'
      ? 'Security alert'
      : kind === 'health' || kind === 'check-in' || kind === 'startup'
        ? 'Status signal'
        : kind === 'greeting'
          ? 'Agent online'
          : 'System notification')

  const kindTag =
    kind === 'anomaly'
      ? 'ALERT'
      : kind === 'health' || kind === 'check-in'
        ? 'HEALTH'
        : kind === 'startup' || kind === 'greeting'
          ? 'STARTUP'
          : 'STATUS'

  // If content already looks structured, pass through with a light header
  if (/^\*\*/.test(body) || body.startsWith('⚠️') || body.startsWith('🧭')) {
    return `\`[${kindTag}]\` ${body}`.slice(0, 1900)
  }

  return [`\`[${kindTag}]\` **${title}**`, '', body].join('\n').slice(0, 1900)
}

export default {
  setDiscordChannelSender,
  setDiscordNotifySender,
  hasDiscordChannelSender,
  hasDiscordNotifySender,
  sendViaDiscordBot,
  sendDiscordNotification,
  formatNotificationPayload,
}
