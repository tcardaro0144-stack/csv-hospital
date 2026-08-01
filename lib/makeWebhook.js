import { getMakeWebhookUrl } from '../api/_lib/env.js'

/**
 * Fire-and-forget POST to the Make.com scenario webhook (CSV Hospital data triggers).
 * Never throws to callers — failures are logged only.
 *
 * @param {string} event - e.g. 'order.paid', 'support.needs_human'
 * @param {Record<string, unknown>} [data]
 * @returns {Promise<{ sent: boolean, status?: number, reason?: string }>}
 */
export async function sendMakeTrigger(event, data = {}) {
  const url = getMakeWebhookUrl()
  if (!url) {
    return { sent: false, reason: 'not_configured' }
  }

  const eventName = String(event || '').trim()
  if (!eventName) {
    return { sent: false, reason: 'missing_event' }
  }

  const payload = {
    source: 'csv-hospital',
    site: 'facelessblur.com',
    event: eventName,
    occurredAt: new Date().toISOString(),
    data: data && typeof data === 'object' && !Array.isArray(data) ? data : {},
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error(
        `[make] webhook ${eventName} failed status=${response.status}`,
        detail.slice(0, 200),
      )
      return { sent: false, status: response.status, reason: 'http_error' }
    }

    return { sent: true, status: response.status }
  } catch (error) {
    console.error(`[make] webhook ${eventName} error:`, error.message)
    return { sent: false, reason: error.name === 'AbortError' ? 'timeout' : 'network' }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Queue a Make trigger without blocking the request path.
 * @param {string} event
 * @param {Record<string, unknown>} [data]
 */
export function queueMakeTrigger(event, data = {}) {
  void sendMakeTrigger(event, data).catch((error) => {
    console.error('[make] unexpected queue failure:', error.message)
  })
}
