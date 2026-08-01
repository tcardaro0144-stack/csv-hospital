import Stripe from 'stripe'
import { getStripeSecretKey, getUnlockSecret } from '../api/_lib/env.js'
import { readCookie, verifyUnlockToken } from './unlockToken.js'

const STRIPE_API_VERSION = '2026-06-24.dahlia'
const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/

async function retrievePaidSession(secretKey, sessionId) {
  const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION })
  const session = await stripe.checkout.sessions.retrieve(sessionId)

  const isPaid =
    session.payment_status === 'paid' &&
    (!session.metadata?.product || session.metadata.product === 'csv-hospital-pro')

  if (!isPaid) {
    return { allowed: false, reason: 'unpaid', sessionId: session.id }
  }

  return {
    allowed: true,
    sessionId: session.id,
    customerEmail: session.customer_details?.email ?? null,
    paymentStatus: session.payment_status,
  }
}

/**
 * Authorize download by Checkout Session ID (preferred for Elements flow).
 */
export async function assertPaidSession(sessionId) {
  const secretKey = getStripeSecretKey()
  if (!secretKey) {
    return { allowed: false, reason: 'not_configured' }
  }

  if (
    !sessionId ||
    typeof sessionId !== 'string' ||
    !SESSION_ID.test(sessionId.trim())
  ) {
    return { allowed: false, reason: 'missing_session' }
  }

  try {
    return await retrievePaidSession(secretKey, sessionId.trim())
  } catch (error) {
    console.error('assertPaidSession Stripe error:', error.message)
    return { allowed: false, reason: 'stripe_error' }
  }
}

/**
 * Legacy cookie-based unlock (still re-checks Stripe).
 */
export async function assertPaidUnlock(req) {
  const unlockSecret = getUnlockSecret()
  const secretKey = getStripeSecretKey()

  if (!unlockSecret || !secretKey) {
    return { allowed: false, reason: 'not_configured' }
  }

  const token = readCookie(req.headers.cookie)
  if (!token || token.length > 4096) {
    return { allowed: false, reason: 'no_cookie' }
  }

  const payload = verifyUnlockToken(token, unlockSecret)
  if (!payload?.sid) {
    return { allowed: false, reason: 'invalid_cookie' }
  }

  try {
    return await retrievePaidSession(secretKey, payload.sid)
  } catch (error) {
    console.error('assertPaidUnlock Stripe error:', error.message)
    return { allowed: false, reason: 'stripe_error' }
  }
}
