/**
 * Perimeter-layer HTTP headers.
 * Compatible with Cloudflare WAF / Bot Management sitting in front:
 * standard header names, no custom challenge protocol, no brittle fingerprinting.
 */

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-DNS-Prefetch-Control': 'off',
}

/**
 * Content-Security-Policy for the static SPA.
 * Stripe Checkout is a top-level redirect (not framed); API calls stay same-origin.
 */
export function buildContentSecurityPolicy() {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://checkout.stripe.com https://hooks.stripe.com",
    "img-src 'self' data: https://*.stripe.com",
    "font-src 'self' https://*.stripe.com https://*.stripecdn.com",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' https://js.stripe.com https://*.stripe.com",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.stripe.com",
    "connect-src 'self' https://api.stripe.com https://*.stripe.com",
    'upgrade-insecure-requests',
  ].join('; ')
}

/**
 * Apply perimeter headers onto a Node/Express/Vercel response.
 * @param {import('http').ServerResponse} res
 * @param {{ includeCsp?: boolean, isApi?: boolean }} [options]
 */
export function applySecurityHeaders(res, { includeCsp = false, isApi = false } = {}) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    // Allow localhost Vite (any port) to read API responses when calling :4242 directly.
    if (isApi && key === 'Cross-Origin-Resource-Policy') {
      res.setHeader(key, 'cross-origin')
      continue
    }
    res.setHeader(key, value)
  }

  if (includeCsp) {
    res.setHeader('Content-Security-Policy', buildContentSecurityPolicy())
  }

  if (isApi) {
    res.setHeader('Cache-Control', 'no-store, max-age=0')
    res.setHeader('Pragma', 'no-cache')
  }

  // HSTS only when the request is (or will be) HTTPS — CF terminates TLS in production
  const clientUrl = process.env.CLIENT_URL || ''
  if (clientUrl.startsWith('https://')) {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    )
  }
}

/**
 * Wrap a Vercel serverless handler with perimeter headers.
 */
export function withPerimeter(handler, { isApi = true } = {}) {
  return async function perimeterHandler(req, res) {
    applySecurityHeaders(res, { isApi, includeCsp: false })
    try {
      return await handler(req, res)
    } catch (err) {
      console.error('[perimeter]', err?.message || err)
      if (res.headersSent) return undefined
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      return res.status(500).json({
        error: 'Internal server error.',
      })
    }
  }
}

export { SECURITY_HEADERS }
