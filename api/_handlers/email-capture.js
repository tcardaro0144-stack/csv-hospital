import { processEmailCapture } from '../../lib/emailCapture.js'
import { enforceRateLimit } from '../_lib/rateLimit.js'
import { withPerimeter } from '../_lib/securityHeaders.js'
import { requireMethod } from '../_lib/validate.js'

/**
 * POST /api/email-capture
 * Body: { email, consent: true, source?: string, website?: '' }
 *
 * Privacy-focused list signup. Stores via Make.com (`email.capture`) and
 * sends an automated confirmation email (Resend). No CSV content accepted.
 */
async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return
  if (!enforceRateLimit(req, res, 'emailCapture')) return

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid JSON body.' })
    }
  }

  try {
    const { status, payload } = await processEmailCapture(body || {})
    return res.status(status).json(payload)
  } catch (error) {
    console.error('[email-capture]', error?.message || error)
    return res.status(500).json({
      ok: false,
      error: 'Unable to save your email right now. Please try again shortly.',
    })
  }
}

export default withPerimeter(handler)
