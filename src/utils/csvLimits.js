/**
 * Payload-layer limits for CSV ingestion.
 * Sized for browser processing and Cloudflare AI / WAF-friendly structured payloads.
 */

/** Max upload size (5 MB). */
export const MAX_CSV_BYTES = 5 * 1024 * 1024

/** Max characters of CSV text after read. */
export const MAX_CSV_CHARS = MAX_CSV_BYTES

/** Max data rows (excluding header). */
export const MAX_DATA_ROWS = 50_000

/** Max columns. */
export const MAX_COLUMNS = 200

/** Max characters per cell after sanitize. */
export const MAX_CELL_CHARS = 2_000

/** Max characters per header label. */
export const MAX_HEADER_CHARS = 200

/** Allowed MIME types (empty string allowed for some OS pickers). */
export const ALLOWED_CSV_TYPES = new Set([
  '',
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.ms-excel',
])

export const CSV_SCHEMA_VERSION = 'csv-hospital.csv.v1'
