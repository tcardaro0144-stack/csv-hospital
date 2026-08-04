/**
 * Register global slash commands for the CSV Hospital Discord Worker.
 *
 * Usage: npm run discord:commands
 *
 * Required .env:
 *   DISCORD_BOT_TOKEN
 *   DISCORD_APPLICATION_ID (or DISCORD_CLIENT_ID / DISCORD_APP_ID)
 */

import 'dotenv/config'
import { SLASH_COMMANDS } from '../workers/discord-interactions/src/commands.js'

const token = (process.env.DISCORD_BOT_TOKEN || '').trim()
const appId = (
  process.env.DISCORD_APPLICATION_ID ||
  process.env.DISCORD_CLIENT_ID ||
  process.env.DISCORD_APP_ID ||
  ''
).trim()

if (!token || !appId) {
  console.error(
    '[discord:commands] Need DISCORD_BOT_TOKEN and DISCORD_APPLICATION_ID (or DISCORD_CLIENT_ID) in .env',
  )
  process.exit(1)
}

const url = `https://discord.com/api/v10/applications/${appId}/commands`

const res = await fetch(url, {
  method: 'PUT',
  headers: {
    Authorization: `Bot ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(SLASH_COMMANDS),
})

const text = await res.text()
if (!res.ok) {
  console.error('[discord:commands] failed', res.status, text.slice(0, 800))
  process.exit(1)
}

let parsed
try {
  parsed = JSON.parse(text)
} catch {
  parsed = text
}

const names = Array.isArray(parsed)
  ? parsed.map((c) => c.name).join(', ')
  : '(ok)'
console.log(`[discord:commands] registered: ${names}`)
console.log(
  '[discord:commands] Global commands can take up to ~1 hour to appear; try reopening Discord.',
)
