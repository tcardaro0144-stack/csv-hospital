/**
 * Safe JSON response parsing for /api fetches.
 * Avoids `Unexpected token '<'` when an SPA fallback or proxy returns HTML.
 */

/**
 * @param {Response} res
 * @returns {Promise<{ ok: boolean, status: number, data: any, rawText: string, isJson: boolean, contentType: string }>}
 */
export async function readResponsePayload(res) {
  const contentType = String(res.headers.get('content-type') || '').toLowerCase()
  const rawText = await res.text()
  const looksJson =
    contentType.includes('application/json') ||
    contentType.includes('+json') ||
    (/^\s*[{[]/.test(rawText) && !/^\s*</.test(rawText))

  let data = null
  let isJson = false
  if (looksJson && rawText) {
    try {
      data = JSON.parse(rawText)
      isJson = true
    } catch {
      data = null
      isJson = false
    }
  }

  return {
    ok: res.ok,
    status: res.status,
    data,
    rawText,
    isJson,
    contentType,
  }
}

/**
 * Fetch a JSON API endpoint with graceful non-JSON handling.
 * @param {string} url
 * @param {RequestInit} [init]
 */
export async function fetchJson(url, init = {}) {
  let res
  try {
    res = await fetch(url, init)
  } catch (networkErr) {
    const err = new Error(
      `Network error calling ${url}. Is the API reachable?`,
    )
    err.cause = networkErr
    err.code = 'NETWORK'
    throw err
  }

  const payload = await readResponsePayload(res)

  if (!payload.isJson) {
    const err = new Error(
      payload.status === 404
        ? `API route not found (${url}). On static hosts, /api/* must not fall through to index.html.`
        : `Expected JSON from ${url} but got ${payload.contentType || 'non-JSON'} (HTTP ${payload.status}).`,
    )
    err.code = 'NOT_JSON'
    err.status = payload.status
    err.contentType = payload.contentType
    err.rawPreview = String(payload.rawText || '').slice(0, 120)
    throw err
  }

  if (!payload.ok) {
    const message =
      (payload.data && (payload.data.error || payload.data.message)) ||
      `Request failed (${payload.status})`
    const err = new Error(String(message))
    err.code = 'HTTP_ERROR'
    err.status = payload.status
    err.data = payload.data
    throw err
  }

  return payload.data
}
