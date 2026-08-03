import { writeFileSync } from 'node:fs'

const base = 'https://csvhospital.com'
const html = await (await fetch(`${base}/hospital`)).text()
const jsMatch = html.match(/assets\/(index-[^"']+\.js)/)
const report = {
  js_bundle: jsMatch?.[1] || null,
  html_mentions_freemius_sandbox: html.includes('freemius-sandbox'),
}

if (jsMatch) {
  const js = await (await fetch(`${base}/assets/${jsMatch[1]}`)).text()
  report.bundle_has_freemius_sandbox = js.includes('freemius-sandbox')
  report.bundle_has_NOT_JSON = js.includes('NOT_JSON')
  report.bundle_has_Expected_JSON = js.includes('Expected JSON')
  report.bundle_has_live_fallback =
    js.includes('opening in live mode') || js.includes('checkout config API unavailable')
  const idx = js.indexOf('freemius-sandbox')
  report.freemius_sandbox_idx = idx
  if (idx >= 0) {
    report.context = js.slice(Math.max(0, idx - 60), idx + 100).replace(/\s+/g, ' ')
  }
}

const api = await fetch(`${base}/api/freemius-sandbox`)
const body = await api.text()
report.api_status = api.status
report.api_content_type = api.headers.get('content-type')
report.api_starts = body.slice(0, 80).replace(/\n/g, ' ')

writeFileSync('tmp-freemius-live-check.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
