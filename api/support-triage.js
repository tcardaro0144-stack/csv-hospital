import { processSupportTriage } from '../lib/supportTriageHandler.js'
import { detectObfuscatedPayload } from '../lib/identityVerification.js'
import { enforceRateLimit } from './_lib/rateLimit.js'
import { withPerimeter } from './_lib/securityHeaders.js'
import { requireMethod } from './_lib/validate.js'

/**
 * POST /api/support-triage
 * Body:
 *   { message } — triage a visitor question
 *   { action: 'submit_handoff', email, originalQuestion, summary? } — queue human follow-up
 */
async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return
  if (!enforceRateLimit(req, res, 'triage')) return

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body.' })
    }
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
    return res.status(status).json(payload)
  } catch (error) {
    console.error('Support triage error:', error?.message || error)
    return res.status(500).json({ error: 'Unable to triage message.' })
  }
}

export default withPerimeter(handler)
