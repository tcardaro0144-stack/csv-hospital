import {
  CSV_SCHEMA_VERSION,
  MAX_CELL_CHARS,
  MAX_HEADER_CHARS,
} from './csvLimits.js'

/**
 * Strip characters that are unsafe for structured / AI-guardrail pipelines:
 * - NUL and other C0 controls (except TAB / LF / CR, which are normalized away)
 * - DEL and common C1 controls
 * - Zero-width / bidi override chars that can poison downstream NLP
 */
const UNSAFE_CHARS =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g

/**
 * Sanitize a single cell for a structured CSV payload.
 */
export function sanitizeCell(value, { maxLength = MAX_CELL_CHARS } = {}) {
  let text = String(value ?? '')

  text = text.replace(UNSAFE_CHARS, '')
  // Normalize newlines/tabs inside cells to spaces (cells are flat strings)
  text = text.replace(/[\t\r\n]+/g, ' ')
  text = text.trim()

  if (text.length > maxLength) {
    text = text.slice(0, maxLength)
  }

  return text
}

/**
 * Sanitize a header label (stricter length).
 */
export function sanitizeHeader(value) {
  return sanitizeCell(value, { maxLength: MAX_HEADER_CHARS }).replace(/\s+/g, ' ')
}

/**
 * Build a Cloudflare AI–compatible structured payload.
 * Only typed string arrays — no free-form blobs or nested objects.
 *
 * @returns {{
 *   schema_version: string,
 *   fileName: string,
 *   headers: string[],
 *   rows: string[][],
 *   rowCount: number,
 *   columnCount: number,
 * }}
 */
export function toSafeCsvPayload({ fileName, headers, rows }) {
  const safeHeaders = headers.map(sanitizeHeader)
  const safeRows = rows.map((row) => {
    // Normalize row width to header count (pad / truncate) for schema stability
    const normalized = []
    for (let i = 0; i < safeHeaders.length; i++) {
      normalized.push(sanitizeCell(row[i]))
    }
    return normalized
  })

  const safeName = sanitizeCell(fileName || 'upload.csv', { maxLength: 255 })
    .replace(/[^\w.\- ()[\]]+/g, '_')
    .replace(/\.+/g, '.')

  return {
    schema_version: CSV_SCHEMA_VERSION,
    fileName: safeName.endsWith('.csv') ? safeName : `${safeName}.csv`,
    headers: safeHeaders,
    rows: safeRows,
    rowCount: safeRows.length,
    columnCount: safeHeaders.length,
  }
}
