import { sanitizeCell, sanitizeHeader } from './sanitizePayload.js'

function normalizeWhitespace(value) {
  return sanitizeHeader(value)
}

function isRowEmpty(row) {
  return row.every((cell) => cell === '')
}

function isNaToken(value) {
  const t = String(value ?? '').trim()
  return /^(n\/?a|null|none|-)$/i.test(t)
}

/**
 * Merge currency values split by an unquoted thousands comma,
 * e.g. ["$65", "000", "Marketing"] → ["$65000", "Marketing"]
 */
export function mergeSplitCurrencyFields(cells) {
  const input = Array.isArray(cells) ? cells.map((c) => String(c ?? '')) : []
  const out = []

  for (let i = 0; i < input.length; i++) {
    const cur = input[i].trim()
    const next = (input[i + 1] ?? '').trim()

    // "$65" + "000" or "65" + "000" (thousands group)
    if (/^\$?\d{1,3}$/.test(cur) && /^\d{3}$/.test(next)) {
      const merged = `${cur.replace(/,/g, '')}${next}`
      out.push(merged)
      i += 1
      continue
    }

    out.push(input[i])
  }

  return out
}

/**
 * Strip currency formatting → plain number string.
 * "$65,000" / "$65000" / "65,000" → "65000"
 */
export function cleanMoneyValue(value) {
  let text = String(value ?? '').trim()
  if (!text || isNaToken(text)) return '0'
  text = text.replace(/\$/g, '').replace(/,/g, '').trim()
  if (!text || isNaToken(text)) return '0'
  if (!/^-?\d+(\.\d+)?$/.test(text)) return text
  return text
}

/**
 * Normalize common date forms to YYYY-MM-DD.
 * Supports: YYYY/MM/DD, YYYY-MM-DD, YYYY.MM.DD,
 *           DD-MM-YYYY, DD/MM/YYYY, MM-DD-YYYY (when unambiguous).
 */
export function standardizeDate(value) {
  const raw = String(value ?? '').trim()
  if (!raw || isNaToken(raw)) return ''

  // Already ISO
  let m = raw.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/)
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  }

  // D-M-Y or M-D-Y
  m = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    const y = m[3]
    let day
    let month
    if (a > 12) {
      // DD-MM-YYYY
      day = a
      month = b
    } else if (b > 12) {
      // MM-DD-YYYY
      month = a
      day = b
    } else {
      // Ambiguous (e.g. 12-05-2023): prefer DD-MM-YYYY to match sample intent
      day = a
      month = b
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return raw
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return raw
}

function findColumnIndex(headers, pattern) {
  return headers.findIndex((h) => pattern.test(String(h)))
}

function normalizeRowWidth(row, columnCount) {
  const next = []
  for (let i = 0; i < columnCount; i++) {
    next.push(row[i] ?? '')
  }
  return next
}

/**
 * Clean parsed CSV data for CSV Hospital exports (*-fixed.csv):
 * - Merge salary fields split by unquoted commas
 * - Strip $ and thousands commas from salary
 * - Replace N/A with 0
 * - Standardize dates to YYYY-MM-DD
 * - Trim / sanitize cells, drop empty rows, pad/truncate width
 */
export function cleanCsv({ headers, rows }) {
  const cleanedHeaders = headers.map(normalizeWhitespace)
  const columnCount = cleanedHeaders.length
  const salaryIdx = findColumnIndex(cleanedHeaders, /salary|pay|wage|compensation/i)
  const dateIdx = findColumnIndex(cleanedHeaders, /date|joined|join_date|hire/i)

  const cleanedRows = rows
    .map((row) => mergeSplitCurrencyFields(row))
    .map((row) => {
      const widthAdjusted = normalizeRowWidth(row, columnCount)

      return widthAdjusted.map((cell, index) => {
        let value = sanitizeCell(cell)

        if (isNaToken(value)) {
          value = '0'
        }

        if (index === salaryIdx || (salaryIdx < 0 && /^\$[\d,]+/.test(value))) {
          value = cleanMoneyValue(value)
        }

        if (index === dateIdx) {
          value = standardizeDate(value)
        }

        return value
      })
    })
    .filter((row) => !isRowEmpty(row))

  const removedRowCount = rows.length - cleanedRows.length

  return {
    headers: cleanedHeaders,
    rows: cleanedRows,
    rowCount: cleanedRows.length,
    columnCount,
    removedRowCount,
  }
}
