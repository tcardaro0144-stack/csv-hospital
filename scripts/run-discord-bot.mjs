/**
 * Standalone 24/7 Faceless Discord bot (Bridge + Manager / Guardian / Frontline).
 *
 * Local Gateway mode — channel chat, presence, Manager/Guardian. For production
 * slash commands without persistent Gateway timeouts, deploy the Cloudflare
 * Worker instead:
 *
 *   npm run discord:deploy      # Worker + secrets from .env (DISCORD_PUBLIC_KEY, …)
 *   npm run discord:commands    # register /ask /frontline /bridge /ping
 *
 * Usage (local Gateway): npm run discord:bot
 *
 * Required .env:
 *   DISCORD_BOT_TOKEN
 *   DISCORD_COMMAND_CHANNEL_ID
 * Recommended:
 *   DISCORD_NOTIFY_CHANNEL_ID
 *   DISCORD_FRONTLINE_LOGS_CHANNEL_ID
 *   CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (Workers AI replies)
 * Optional:
 *   DISCORD_PRESENCE_INTERVAL_MS (default 300000)
 *   DISCORD_DEBUG=1
 *
 * Pass --deploy to compile/deploy the Worker then exit (same as discord:deploy):
 *   node scripts/run-discord-bot.mjs --deploy
 */
import 'dotenv/config'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ManagerAi } from '../lib/managerAi.js'
import { SecurityGuardian } from '../lib/securityGuardian.js'
import { startDiscordBot } from '../lib/discordBot.js'
import { installDiscordProcessGuards } from '../lib/discordAlwaysOn.js'
import { isWorkersAiConfigured } from '../lib/aiClient.js'

if (process.argv.includes('--deploy')) {
  const deployScript = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'deploy-discord-worker.mjs',
  )
  console.log('[discord:bot] --deploy → Cloudflare Worker (HTTP interactions)…')
  const result = spawnSync(process.execPath, [deployScript], {
    stdio: 'inherit',
    env: process.env,
  })
  process.exit(result.status ?? 1)
}

installDiscordProcessGuards({ label: 'faceless-bridge-24-7' })

console.log('[discord:bot] starting Faceless Bridge always-on process…')
console.log('[discord:bot] Workers AI configured:', isWorkersAiConfigured())
console.log(
  '[discord:bot] tip: production slash commands → npm run discord:deploy (no Gateway)',
)

const guardian = new SecurityGuardian()
const manager = new ManagerAi({ guardian })
guardian.setManager?.(manager)

const discord = startDiscordBot({ manager, guardian })
if (!discord) {
  console.error(
    '[discord:bot] Bot did not start — check DISCORD_BOT_TOKEN and DISCORD_COMMAND_CHANNEL_ID in .env',
  )
  process.exit(1)
}

discord.loginPromise.catch((error) => {
  console.error(
    '[discord:bot] fatal login failure — exiting:',
    error?.message || error,
  )
  process.exit(1)
})

discord.whenReady
  .then(async (readyClient) => {
    if (!readyClient) {
      console.error(
        '[discord:bot] ready resolved empty after login abort — exiting',
      )
      process.exit(1)
      return
    }
    console.log('[discord:bot] online — 24/7 loop armed (Ctrl+C to stop)')
    try {
      await guardian.sendStartupGreeting()
    } catch (err) {
      console.warn('[discord:bot] guardian greeting:', err?.message || err)
    }
    try {
      await manager.sendStartupCheckIn()
      manager.startRoutineCheckIns()
    } catch (err) {
      console.warn('[discord:bot] manager check-in:', err?.message || err)
    }
  })
  .catch((err) => {
    console.error('[discord:bot] ready failed:', err?.message || err)
  })

process.on('SIGINT', () => {
  console.log('\n[discord:bot] SIGINT — shutting down cleanly')
  try {
    discord.stopPresence?.()
    discord.client?.destroy?.()
  } catch {
    // ignore
  }
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('[discord:bot] SIGTERM — shutting down cleanly')
  try {
    discord.stopPresence?.()
    discord.client?.destroy?.()
  } catch {
    // ignore
  }
  process.exit(0)
})
