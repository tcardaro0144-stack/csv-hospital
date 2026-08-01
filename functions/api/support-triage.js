/**
 * Cloudflare Pages Function — POST /api/support-triage
 * Includes human handoff email collection + support queue forwarding.
 */
import { processSupportTriage } from '../../lib/supportTriageHandler.js'
import { detectObfuscatedPayload } from '../../lib/identityVerification.js'
import { checkRateLimit } from '../../api/_lib/rateLimit.js'

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  Allow: 'POST, OPTIONS',
}

function applyPagesEnv(env) {
  if (!env || typeof env !== 'object') return
  const g = globalThis
  if (!g.process) g.process = { env: {} }
  if (!g.process.env) g.process.env = {}
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string' && value.length > 0) {
      g.process.env[key] = value
    }
  }
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  })
}

function clientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: 'POST, OPTIONS',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
    },
  })
}

async function onRequestPost(context) {
  const { request, env } = context
  applyPagesEnv(env)

  const triageLimit = Number(
    env?.RATE_LIMIT_TRIAGE || globalThis.process?.env?.RATE_LIMIT_TRIAGE || 20,
  )
  const windowMs = Number(
    env?.RATE_LIMIT_WINDOW_MS ||
      globalThis.process?.env?.RATE_LIMIT_WINDOW_MS ||
      60_000,
  )
  const limited = checkRateLimit(`triage:${clientIp(request)}`, {
    limit: triageLimit,
    windowMs,
  })
  if (!limited.allowed) {
    return json(429, { error: 'Too many requests. Please try again shortly.' })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json(400, { error: 'Invalid JSON body.' })
  }

  try {
    const { status, payload } = await processSupportTriage(body, {
      source: 'web-support',
      inspectText: (text) => {
        const obfuscation = detectObfuscatedPayload(text)
        if (obfuscation.suspicious) {
          return { action: 'REJECT', reasons: obfuscation.reasons }
        }
        return { action: 'ALLOW' }
      },
    })
    return json(status, payload)
  } catch (error) {
    console.error('Support triage error:', error?.message || error)
    return json(500, { error: 'Unable to triage message.' })
  }
}

export async function onRequest(context) {
  const method = context.request.method
  if (method === 'OPTIONS') return onRequestOptions()
  if (method === 'POST') return onRequestPost(context)
  return json(405, { error: 'Method not allowed. Use POST.' })
}
