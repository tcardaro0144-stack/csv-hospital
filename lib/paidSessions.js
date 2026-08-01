import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const STORE_PATH = join(__dirname, '..', '.data', 'paid-sessions.json')

function loadStore() {
  try {
    const raw = readFileSync(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveStore(store) {
  try {
    mkdirSync(dirname(STORE_PATH), { recursive: true })
    writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8')
  } catch (error) {
    console.error('paidSessions save failed:', error.message)
  }
}

/**
 * Record a paid Checkout Session (from webhook or verify-session).
 */
export function markSessionPaid(sessionId, meta = {}) {
  if (!sessionId || typeof sessionId !== 'string') return
  const store = loadStore()
  store[sessionId] = {
    paidAt: new Date().toISOString(),
    ...meta,
  }
  saveStore(store)
}

export function isSessionMarkedPaid(sessionId) {
  if (!sessionId) return false
  const store = loadStore()
  return Boolean(store[sessionId])
}
