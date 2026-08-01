function escapeField(value) {
  const text = String(value ?? '')
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function rowToCsv(row) {
  return row.map(escapeField).join(',')
}

export function serializeCsv({ headers, rows }) {
  return [rowToCsv(headers), ...rows.map(rowToCsv)].join('\r\n')
}

/**
 * Create and trigger a CSV download from an in-memory blob.
 * HARD GATE: refuses to build the blob unless isPaid === true.
 * Never opens a file picker — only saves the generated Blob.
 */
export function downloadCsv({
  headers,
  rows,
  fileName = 'fixed.csv',
  isPaid = false,
}) {
  if (isPaid !== true) {
    throw new Error('PAYMENT_REQUIRED')
  }

  if (!Array.isArray(headers) || !Array.isArray(rows)) {
    throw new Error('Invalid CSV payload.')
  }

  const safeName = String(fileName || 'fixed.csv').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
  const downloadName = safeName.toLowerCase().endsWith('.csv')
    ? safeName
    : `${safeName}.csv`

  const content = serializeCsv({ headers, rows })
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })

  // IE / legacy Edge
  if (typeof window.navigator?.msSaveOrOpenBlob === 'function') {
    window.navigator.msSaveOrOpenBlob(blob, downloadName)
    return
  }

  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = downloadName
    link.target = '_self'
    link.rel = 'noopener'
    link.style.display = 'none'
    document.body.appendChild(link)
    // Synthetic click on a download-anchor — must not open <input type="file">
    link.dispatchEvent(
      new MouseEvent('click', {
        bubbles: false,
        cancelable: true,
        view: window,
      }),
    )
    link.remove()
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
  }
}
