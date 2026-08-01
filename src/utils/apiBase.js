/**
 * Resolve where /api/* requests should go.
 *
 * Dev strategy (localhost:5193 UI → :4242 API):
 * 1. Prefer Vite proxy with relative `/api` (same-origin, no CORS/CORP issues).
 * 2. If VITE_API_URL is set, use that absolute base (e.g. http://localhost:4242).
 * 3. If the UI is on localhost but VITE_USE_DIRECT_API=true, call :4242 directly.
 */
export function getApiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_URL
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/$/, '')
  }

  // Optional escape hatch: force direct Express URL (needs CORS + CORP cross-origin).
  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_USE_DIRECT_API === 'true' &&
    typeof window !== 'undefined' &&
    /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
  ) {
    return 'http://localhost:4242'
  }

  // Default: relative paths → Vite proxies /api → http://localhost:4242
  return ''
}

export function apiUrl(path) {
  const base = getApiBaseUrl()
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}
