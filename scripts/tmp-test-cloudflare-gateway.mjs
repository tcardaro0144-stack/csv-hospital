import 'dotenv/config'
import {
  getAiApiKey,
  getAiModel,
  getCloudflareAccountId,
  getWorkersAiRunUrl,
} from '../api/_lib/env.js'

function mask(value) {
  if (!value) return '(missing)'
  if (value.length <= 8) return '***'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

async function main() {
  const url = getWorkersAiRunUrl()
  const apiKey = getAiApiKey()
  const model = getAiModel()
  const accountId = getCloudflareAccountId()

  console.log('Cloudflare Workers AI /ai/run test')
  console.log(`- account: ${accountId || '(missing)'}`)
  console.log(`- model: ${model}`)
  console.log(`- url: ${url || '(missing)'}`)
  console.log(`- token: ${mask(apiKey)}`)

  if (!url || !apiKey) {
    console.error(
      '\nFAIL: Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (or AI_API_KEY) in .env',
    )
    process.exitCode = 1
    return
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: 'Reply with exactly: gateway-ok',
    }),
  })

  const data = await response.json().catch(() => ({}))
  console.log(`\nHTTP ${response.status}`)
  if (!response.ok || data?.success === false) {
    console.error('FAIL:', JSON.stringify(data?.errors || data).slice(0, 500))
    process.exitCode = 1
    return
  }

  const text = data?.result?.response || data?.result || '(no text)'
  console.log('PASS')
  console.log('Reply:', String(text).slice(0, 200))
}

await main()
