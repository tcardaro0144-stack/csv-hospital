import {
  ALLOWED_CSV_TYPES,
  MAX_COLUMNS,
  MAX_CSV_BYTES,
  MAX_CSV_CHARS,
  MAX_DATA_ROWS,
} from './csvLimits.js'

/**
 * Client-side pre-validation before FileReader (size, extension, MIME).
 */
export function validateCsvFile(file) {
  if (!file) {
    throw new Error('No file provided.')
  }

  if (file.size <= 0) {
    throw new Error('File is empty.')
  }

  if (file.size > MAX_CSV_BYTES) {
    throw new Error(
      `File is too large. Maximum size is ${Math.floor(MAX_CSV_BYTES / (1024 * 1024))} MB.`,
    )
  }

  const name = String(file.name || '').toLowerCase()
  if (!name.endsWith('.csv')) {
    throw new Error('Please upload a .csv file.')
  }

  const type = String(file.type || '')
  if (!ALLOWED_CSV_TYPES.has(type)) {
    throw new Error('Unsupported file type. Please upload a .csv file.')
  }

  return true
}

/**
 * Reject binary / NUL-poisoned text early (data-poisoning guard).
 */
function assertTextSafe(text) {
  if (typeof text !== 'string') {
    throw new Error('Invalid file content.')
  }

  if (text.length > MAX_CSV_CHARS) {
    throw new Error('File content exceeds the maximum allowed size.')
  }

  // NUL bytes strongly indicate binary / poisoned payloads
  if (text.includes('\u0000')) {
    throw new Error('File contains invalid binary data.')
  }

  // High ratio of non-text replacement/control can indicate corruption
  let suspicious = 0
  const sample = text.slice(0, Math.min(text.length, 8000))
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i)
    if (code === 0xfffd || (code < 32 && code !== 9 && code !== 10 && code !== 13)) {
      suspicious += 1
    }
  }
  if (sample.length > 0 && suspicious / sample.length > 0.05) {
    throw new Error('File does not look like valid CSV text.')
  }
}

/**
 * Parse CSV text into headers and rows.
 * Handles quoted fields, escaped quotes, and commas inside quotes.
 */
export function parseCsv(text) {
  assertTextSafe(text)

  if (!text.trim()) {
    throw new Error('File is empty.')
  }

  const rows = []
  let currentRow = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        currentField += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      currentRow.push(currentField)
      currentField = ''
    } else if (char === '\r' && nextChar === '\n') {
      currentRow.push(currentField)
      rows.push(currentRow)
      currentRow = []
      currentField = ''
      i++
    } else if (char === '\n' || char === '\r') {
      currentRow.push(currentField)
      rows.push(currentRow)
      currentRow = []
      currentField = ''
    } else {
      currentField += char
    }

    // Fail fast on row explosion (DoS / poison)
    if (rows.length > MAX_DATA_ROWS + 1) {
      throw new Error(`CSV has too many rows. Maximum is ${MAX_DATA_ROWS.toLocaleString()}.`)
    }
    if (currentRow.length > MAX_COLUMNS) {
      throw new Error(`CSV has too many columns. Maximum is ${MAX_COLUMNS}.`)
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField)
    rows.push(currentRow)
  }

  if (rows.length === 0) {
    throw new Error('No data found in file.')
  }

  if (rows.length > MAX_DATA_ROWS + 1) {
    throw new Error(`CSV has too many rows. Maximum is ${MAX_DATA_ROWS.toLocaleString()}.`)
  }

  const headers = rows[0]
  const dataRows = rows.slice(1)

  if (headers.length === 0) {
    throw new Error('CSV header row is empty.')
  }

  if (headers.length > MAX_COLUMNS) {
    throw new Error(`CSV has too many columns. Maximum is ${MAX_COLUMNS}.`)
  }

  return {
    headers,
    rows: dataRows,
    rowCount: dataRows.length,
    columnCount: headers.length,
  }
}

/**
 * Read a File object and parse CSV rows (may include uneven widths from
 * unquoted commas). Cleaning/repair happens in ingestCsv → cleanCsv.
 */
export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    try {
      validateCsvFile(file)
    } catch (error) {
      reject(error)
      return
    }

    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const parsed = parseCsv(event.target.result)
        resolve({
          fileName: file.name,
          headers: parsed.headers,
          rows: parsed.rows,
          rowCount: parsed.rowCount,
          columnCount: parsed.columnCount,
        })
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file.'))
    }

    reader.readAsText(file)
  })
}
