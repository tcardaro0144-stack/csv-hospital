/**
 * In-memory sliding-window rate limiter.
 * Compatible with Cloudflare: prefers CF-Connecting-IP when present.
 * For multi-instance production, replace store with KV/Upstash — same API.
 */

const buckets = new Map()

const DEFAULTS = {
  checkout: { limit: 10, windowMs: 60_000 },
  verify: { limit: 30, windowMs: 60_000 },
  unlockStatus: { limit: 60, windowMs: 60_000 },
  triage: { limit: 20, windowMs: 60_000 },
}

function prune(key, now, windowMs) {
  const entry = buckets.get(key)
  if (!entry) return
  entry.hits = entry.hits.filter((t) => now - t < windowMs)
  if (entry.hits.length === 0) buckets.delete(key)
}

/**
 * @param {string} key
 * @param {{ limit: number, windowMs: number }} options
 * @returns {{ allowed: boolean, remaining: number, retryAfterSec: number }}
 */
export function checkRateLimit(key, { limit, windowMs }) {
  const now = Date.now()
  prune(key, now, windowMs)

  let entry = buckets.get(key)
  if (!entry) {
    entry = { hits: [] }
    buckets.set(key, entry)
  }

  if (entry.hits.length >= limit) {
    const oldest = entry.hits[0]
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000))
    return { allowed: false, remaining: 0, retryAfterSec }
  }

  entry.hits.push(now)
  return {
    allowed: true,
    remaining: Math.max(0, limit - entry.hits.length),
    retryAfterSec: 0,
  }
}

export function getClientIp(req) {
  const cfIp = req.headers?.['cf-connecting-ip']
  if (typeof cfIp === 'string' && cfIp.trim()) return cfIp.trim()

  const forwarded = req.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }

  return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown'
}

export function rateLimitConfig(name) {
  const presets = {
    checkout: {
      limit: Number(process.env.RATE_LIMIT_CHECKOUT || DEFAULTS.checkout.limit),
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || DEFAULTS.checkout.windowMs),
    },
    verify: {
      limit: Number(process.env.RATE_LIMIT_VERIFY || DEFAULTS.verify.limit),
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || DEFAULTS.verify.windowMs),
    },
    unlockStatus: {
      limit: Number(process.env.RATE_LIMIT_UNLOCK_STATUS || DEFAULTS.unlockStatus.limit),
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || DEFAULTS.unlockStatus.windowMs),
    },
    triage: {
      limit: Number(process.env.RATE_LIMIT_TRIAGE || DEFAULTS.triage.limit),
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || DEFAULTS.triage.windowMs),
    },
  }
  return presets[name] || DEFAULTS.checkout
}

/**
 * Apply rate limit; returns true if request may proceed.
 */
export function enforceRateLimit(req, res, bucketName) {
  const config = rateLimitConfig(bucketName)
  const ip = getClientIp(req)
  const result = checkRateLimit(`${bucketName}:${ip}`, config)

  res.setHeader('X-RateLimit-Limit', String(config.limit))
  res.setHeader('X-RateLimit-Remaining', String(result.remaining))

  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSec))
    res.status(429).json({
      error: 'Too many requests. Please try again shortly.',
    })
    return false
  }

  return true
}
