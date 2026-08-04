/**
 * Always-on Gateway resilience for the CSV Hospital Discord bot.
 * Login retries + process/event guards — keeps the terminal process alive 24/7.
 *
 * Production alternative (no persistent Gateway / idle timeouts): deploy the
 * Discord Interactions Cloudflare Worker (`npm run discord:deploy`). That path
 * uses HTTP webhooks + DISCORD_PUBLIC_KEY signature verify instead of a local
 * Gateway session. Keep this module for optional local channel chat.
 */

import { Events } from 'discord.js'

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isFatalAuthError(error) {
  const msg = String(error?.message || error || '')
  const code = error?.code
  return (
    code === 'TokenInvalid' ||
    /invalid.?token|disallowed intent|used disallowed intents/i.test(msg)
  )
}

/**
 * Install process-level guards so uncaught errors log instead of killing the bot.
 * @param {{ label?: string }} [opts]
 */
export function installDiscordProcessGuards(opts = {}) {
  const label = opts.label || 'discord-always-on'

  if (globalThis.__csvHospitalDiscordGuardsInstalled) {
    return
  }
  globalThis.__csvHospitalDiscordGuardsInstalled = true

  process.on('uncaughtException', (error) => {
    console.error(`[${label}] uncaughtException (process stays up):`, error)
  })

  process.on('unhandledRejection', (reason) => {
    console.error(`[${label}] unhandledRejection (process stays up):`, reason)
  })

  console.log(`[${label}] process guards armed`)
}

/**
 * Wire Client error / shard events so disconnects don't crash the script.
 * discord.js already auto-resumes after a successful login; we log + recover loudly.
 *
 * @param {import('discord.js').Client} client
 * @param {{ onResume?: () => void | Promise<void>, onInvalidated?: () => void | Promise<void> }} [hooks]
 */
export function wireDiscordGatewayResilience(client, hooks = {}) {
  client.on(Events.Error, (error) => {
    console.error('[discord] client error (non-fatal):', error?.message || error)
  })

  client.on(Events.Warn, (message) => {
    console.warn('[discord] client warn:', message)
  })

  client.on(Events.ShardError, (error, shardId) => {
    console.error(
      `[discord] shard ${shardId} error (non-fatal):`,
      error?.message || error,
    )
  })

  client.on(Events.ShardDisconnect, (event, shardId) => {
    console.warn(
      `[discord] shard ${shardId} disconnected — discord.js will attempt resume`,
      { code: event?.code, reason: event?.reason },
    )
  })

  client.on(Events.ShardReconnecting, (shardId) => {
    console.log(`[discord] shard ${shardId} reconnecting…`)
  })

  client.on(Events.ShardResume, (shardId, replayed) => {
    console.log(
      `[discord] shard ${shardId} resumed (replayed ${replayed} events)`,
    )
    if (typeof hooks.onResume === 'function') {
      Promise.resolve(hooks.onResume()).catch((err) => {
        console.warn('[discord] onResume hook failed:', err?.message || err)
      })
    }
  })

  client.on(Events.Invalidated, () => {
    console.error(
      '[discord] session invalidated — client is unusable and must be recreated (do not call login() again on this instance)',
    )
    if (typeof hooks.onInvalidated === 'function') {
      Promise.resolve(hooks.onInvalidated()).catch((err) => {
        console.warn('[discord] onInvalidated hook failed:', err?.message || err)
      })
    }
  })
}

/**
 * Login with exponential backoff. Survives local network blips.
 * Fatal auth/intent errors stop retrying so you can fix .env.
 *
 * @param {import('discord.js').Client} client
 * @param {string} token
 * @param {{
 *   baseDelayMs?: number,
 *   maxDelayMs?: number,
 *   maxAttempts?: number,
 * }} [opts]
 */
export async function loginDiscordWithRetry(client, token, opts = {}) {
  const baseDelayMs = Number(opts.baseDelayMs) || 5_000
  const maxDelayMs = Number(opts.maxDelayMs) || 120_000
  const maxAttempts = opts.maxAttempts == null ? Infinity : Number(opts.maxAttempts)

  let attempt = 0
  while (attempt < maxAttempts) {
    attempt += 1
    try {
      console.log(`[discord] Gateway login attempt ${attempt}…`)
      await client.login(token)
      console.log('[discord] Gateway login accepted')
      return
    } catch (error) {
      if (isFatalAuthError(error)) {
        console.error(
          '[discord] fatal auth/intent error — fix DISCORD_BOT_TOKEN / Message Content Intent, then restart:',
          error?.message || error,
        )
        throw error
      }

      const delay = Math.min(
        maxDelayMs,
        Math.round(baseDelayMs * 1.6 ** Math.min(attempt - 1, 8)),
      )
      console.error(
        `[discord] login failed (attempt ${attempt}):`,
        error?.message || error,
        `— retrying in ${Math.round(delay / 1000)}s`,
      )
      await sleep(delay)
    }
  }

  throw new Error(`[discord] exhausted ${maxAttempts} login attempts`)
}

export default {
  installDiscordProcessGuards,
  wireDiscordGatewayResilience,
  loginDiscordWithRetry,
  isFatalAuthError,
}
