/**
 * Manual Make.com webhook smoke test.
 * Usage: npm run test:make-webhook
 *
 * Sends one payload via MAKE_WEBHOOK_URL (same shape as production triggers).
 */
import 'dotenv/config'
import { getMakeWebhookUrl } from '../api/_lib/env.js'
import { sendMakeTrigger } from '../lib/makeWebhook.js'

const url = getMakeWebhookUrl()
if (!url) {
  console.error(
    '[test:make] MAKE_WEBHOOK_URL is missing or invalid. Set it in .env first.',
  )
  process.exit(1)
}

const host = new URL(url).hostname
console.log(`[test:make] POST → ${host} …`)

const result = await sendMakeTrigger('system.test', {
  note: 'Manual smoke test from CSV Hospital',
  test: true,
  triggeredBy: 'npm run test:make-webhook',
})

if (result.sent) {
  console.log(`[test:make] OK — Make accepted the payload (HTTP ${result.status ?? 'n/a'})`)
  console.log(
    '[test:make] Check your Make scenario history for event "system.test".',
  )
  process.exit(0)
}

console.error('[test:make] FAILED', result)
process.exit(1)
