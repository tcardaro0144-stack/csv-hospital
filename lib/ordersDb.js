import { createHash, randomBytes } from 'crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { queueMakeTrigger } from './makeWebhook.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const STORE_PATH = join(__dirname, '..', '.data', 'orders.json')

function loadOrders() {
  try {
    const raw = readFileSync(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveOrders(orders) {
  try {
    mkdirSync(dirname(STORE_PATH), { recursive: true })
    writeFileSync(STORE_PATH, JSON.stringify(orders, null, 2), 'utf8')
  } catch (error) {
    console.error('ordersDb save failed:', error.message)
  }
}

function publicOrder(order) {
  if (!order) return null
  return {
    id: order.id,
    sessionId: order.sessionId,
    status: order.status,
    downloadUrl: order.status === 'paid' ? order.downloadUrl : null,
    downloadToken: order.status === 'paid' ? order.downloadToken : null,
    paidAt: order.paidAt ?? null,
    createdAt: order.createdAt,
  }
}

/**
 * Create a pending order tied to a Checkout Session.
 */
export function createPendingOrder({ sessionId, email = null }) {
  const orders = loadOrders()
  const existing = orders[sessionId]
  // Webhook may arrive before checkout response finishes — never downgrade paid.
  if (existing?.status === 'paid') {
    return publicOrder(existing)
  }

  const id = existing?.id ?? `ord_${randomBytes(8).toString('hex')}`
  const order = {
    id,
    sessionId,
    status: 'pending',
    downloadToken: null,
    downloadUrl: null,
    email: email ?? existing?.email ?? null,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    paidAt: null,
  }
  const isNew = !existing
  orders[sessionId] = order
  saveOrders(orders)

  if (isNew) {
    queueMakeTrigger('order.pending', {
      orderId: order.id,
      sessionId: order.sessionId,
      email: order.email,
      status: order.status,
      createdAt: order.createdAt,
    })
  }

  return publicOrder(order)
}

/**
 * Mark order paid and issue a tokenized download URL.
 * Called from checkout.session.completed webhook (and verify fallback).
 */
export function markOrderPaid(sessionId, { email = null } = {}) {
  const orders = loadOrders()
  let order = orders[sessionId]
  const wasPaid = order?.status === 'paid' && Boolean(order?.downloadToken)

  if (!order) {
    order = {
      id: `ord_${randomBytes(8).toString('hex')}`,
      sessionId,
      status: 'pending',
      downloadToken: null,
      downloadUrl: null,
      email,
      createdAt: new Date().toISOString(),
      paidAt: null,
    }
  }

  if (order.status !== 'paid' || !order.downloadToken) {
    const downloadToken = randomBytes(24).toString('hex')
    order.status = 'paid'
    order.downloadToken = downloadToken
    // Query form works on both Express and Vercel serverless.
    order.downloadUrl = `/api/download?token=${downloadToken}`
    order.paidAt = new Date().toISOString()
    if (email) order.email = email
  }

  orders[sessionId] = order
  // Also index by download token for fast lookup
  orders[`token:${order.downloadToken}`] = { sessionId }
  saveOrders(orders)

  if (!wasPaid && order.status === 'paid') {
    queueMakeTrigger('order.paid', {
      orderId: order.id,
      sessionId: order.sessionId,
      email: order.email,
      status: order.status,
      paidAt: order.paidAt,
      downloadUrl: order.downloadUrl,
    })
  }

  return publicOrder(order)
}

export function getOrderBySessionId(sessionId) {
  if (!sessionId) return null
  const orders = loadOrders()
  return publicOrder(orders[sessionId] ?? null)
}

export function getOrderByDownloadToken(token) {
  if (!token || typeof token !== 'string') return null
  const orders = loadOrders()
  const ref = orders[`token:${token}`]
  if (!ref?.sessionId) {
    // Fallback scan
    for (const [key, order] of Object.entries(orders)) {
      if (key.startsWith('token:')) continue
      if (order?.downloadToken === token) return publicOrder(order)
    }
    return null
  }
  return publicOrder(orders[ref.sessionId] ?? null)
}

export function isValidDownloadToken(token) {
  const order = getOrderByDownloadToken(token)
  return Boolean(order && order.status === 'paid' && order.downloadToken === token)
}

/** Hash helper if needed for logging without exposing tokens. */
export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex').slice(0, 12)
}
