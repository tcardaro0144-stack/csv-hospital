import { parseCsvFile } from './parseCsv.js'
import { cleanCsv } from './cleanCsv.js'
import { toSafeCsvPayload } from './sanitizePayload.js'

/**
 * Single-step CSV ingestion:
 * read → parse (keep split columns) → clean/repair → sanitize → UI payload.
 */
export async function ingestCsvFile(file) {
  const parsed = await parseCsvFile(file)
  const cleaned = cleanCsv(parsed)
  const safe = toSafeCsvPayload({
    fileName: parsed.fileName,
    headers: cleaned.headers,
    rows: cleaned.rows,
  })

  return {
    fileName: safe.fileName,
    originalRowCount: parsed.rowCount,
    headers: safe.headers,
    rows: safe.rows,
    rowCount: safe.rowCount,
    columnCount: safe.columnCount,
    removedRowCount: cleaned.removedRowCount,
    originalHeaders: parsed.headers,
    originalRows: parsed.rows,
  }
}
