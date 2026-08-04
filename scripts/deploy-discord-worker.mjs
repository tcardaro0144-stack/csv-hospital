/**
 * Deploy CSV Hospital Discord Interactions Worker + sync secrets from .env
 *
 * Usage: npm run discord:deploy
 *
 * Required in .env:
 *   DISCORD_PUBLIC_KEY   — Developer Portal → General Information → Public Key
 *   CLOUDFLARE_API_TOKEN — Wrangler auth (Account → Workers Scripts:Edit)
 *   CLOUDFLARE_ACCOUNT_ID
 * Optional:
 *   DISCORD_BOT_TOKEN
 *   DISCORD_APPLICATION_ID / DISCORD_CLIENT_ID / DISCORD_APP_ID
 *   AI_MODEL
 *
 * After deploy: paste the Worker URL into Discord → Interactions Endpoint URL
 * then run: npm run discord:commands
 */

import 'dotenv/config'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const config = path.join(root, 'workers', 'discord-interactions', 'wrangler.toml')

/**
 * Normalize Cloudflare auth for modern Wrangler.
 * Maps legacy CF_* → CLOUDFLARE_* and drops deprecated names so Wrangler
 * does not warn / mis-read credentials.
 */
function wranglerEnv() {
  const apiToken =
    process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || ''
  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID || ''

  const env = { ...process.env }
  if (apiToken) env.CLOUDFLARE_API_TOKEN = apiToken.trim()
  if (accountId) env.CLOUDFLARE_ACCOUNT_ID = accountId.trim()
  delete env.CF_API_TOKEN
  delete env.CF_ACCOUNT_ID
  return env
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: opts.stdio ?? 'inherit',
    shell: true,
    encoding: 'utf8',
    input: opts.input,
    env: { ...wranglerEnv(), ...(opts.env || {}) },
  })
  if (result.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(' ')} failed with exit ${result.status}`,
    )
  }
  return result
}

function putSecret(name, value) {
  if (!value) {
    console.warn(`[discord:deploy] skip secret ${name} (not set in .env)`)
    return
  }
  console.log(`[discord:deploy] syncing secret ${name}…`)
  run('npx', ['wrangler', 'secret', 'put', name, '-c', config], {
    input: String(value).trim() + '\n',
    stdio: ['pipe', 'inherit', 'inherit'],
  })
}

function main() {
  const env = wranglerEnv()
  if (!env.CLOUDFLARE_API_TOKEN) {
    console.error(
      '[discord:deploy] CLOUDFLARE_API_TOKEN is required in .env\n' +
        '  Create a token with Account → Workers Scripts:Edit\n' +
        '  https://developers.cloudflare.com/fundamentals/api/get-started/create-token/',
    )
    process.exit(1)
  }
  if (!env.CLOUDFLARE_ACCOUNT_ID) {
    console.error(
      '[discord:deploy] CLOUDFLARE_ACCOUNT_ID is required in .env',
    )
    process.exit(1)
  }

  const publicKey = process.env.DISCORD_PUBLIC_KEY
  if (!publicKey) {
    console.error(
      '[discord:deploy] DISCORD_PUBLIC_KEY is required in .env\n' +
        '  Discord Developer Portal → Your App → General Information → Public Key',
    )
    process.exit(1)
  }

  const appId =
    process.env.DISCORD_APPLICATION_ID ||
    process.env.DISCORD_CLIENT_ID ||
    process.env.DISCORD_APP_ID ||
    ''

  console.log(
    '[discord:deploy] auth via CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID',
  )
  console.log('[discord:deploy] deploying Worker (csv-hospital-discord)…')
  run('npx', ['wrangler', 'deploy', '-c', config])

  putSecret('DISCORD_PUBLIC_KEY', publicKey)
  putSecret('DISCORD_BOT_TOKEN', process.env.DISCORD_BOT_TOKEN)
  if (appId) putSecret('DISCORD_APPLICATION_ID', appId)

  console.log(`
[discord:deploy] done.

Next steps:
  1. Copy the Worker URL from the deploy output (*.workers.dev)
     or https://csvhospital.com/api/discord/interactions if you enabled [[routes]]
  2. Discord Developer Portal → General Information → Interactions Endpoint URL
  3. Save (Discord sends a PING — Worker returns PONG after signature verify)
  4. npm run discord:commands   # register /ask /frontline /bridge /ping
`)
}

try {
  main()
} catch (error) {
  console.error('[discord:deploy]', error?.message || error)
  process.exit(1)
}
