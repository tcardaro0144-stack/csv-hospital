/**
 * Two-way Discord bridge for the Faceless Blur command channel.
 *
 * Default mode: true conversational AI — every normal message in the command
 * channel is passed to the Workers AI pipeline (Manager by default).
 *
 * Optional explicit addresses (still conversational, not FAQ routers):
 *   !manager / !guardian / !frontline
 *   !help · !logout
 *
 * Zero-Trust gauntlet still starts only on Tom mention/claim when unverified.
 */

import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
} from 'discord.js'
import {
  getDiscordBotToken,
  getDiscordCommandChannelId,
  getDiscordFrontlineLogsChannelId,
  getDiscordNotifyChannelId,
  getDiscordOwnerUserId,
} from '../api/_lib/env.js'
import {
  setDiscordChannelSender,
  setDiscordNotifySender,
} from './discordOutbound.js'
import {
  setDiscordFrontlineLogSender,
  logFrontlineCsEvent,
} from './frontlineCsLogs.js'
import { claimsToBeTom } from './identityVerification.js'
import { generatePersonaReply } from './discordAiLayer.js'
import {
  installDiscordProcessGuards,
  loginDiscordWithRetry,
  wireDiscordGatewayResilience,
} from './discordAlwaysOn.js'
import { startDiscordPresenceLoop } from './discordPresence.js'

/** Distinct display identities — never reply as the Faceless Blur bot account. */
export const AGENT_PROFILES = {
  manager: {
    key: 'manager',
    webhookName: 'FB Agent — Manager',
    username: 'Faceless Manager',
    label: '🧭',
  },
  guardian: {
    key: 'guardian',
    webhookName: 'FB Agent — Guardian',
    username: 'Faceless Guardian',
    label: '🛡️',
  },
  frontline: {
    key: 'frontline',
    webhookName: 'FB Agent — Frontline',
    username: 'Frontline AI',
    label: '💬',
  },
  bridge: {
    key: 'bridge',
    webhookName: 'FB Agent — Bridge',
    username: 'Faceless Bridge',
    label: '📡',
  },
}

const HELP_TEXT = [
  '**Faceless command channel** — conversational AI by default (24/7 Bridge).',
  '',
  'Just talk. Messages go to your **active persona** (Manager by default).',
  'Switch voice anytime: `!manager` · `!guardian` · `!frontline` — follow-ups stick to that persona.',
  '`!help` · `!logout` (clear Zero-Trust session + chat memory)',
  '`!testnotify` / `!pingguardian` — fire a Guardian test alert into #agent-notifications',
  '',
  'Channels: chat here · alerts → #agent-notifications · Frontline CS transcripts → #frontline-cs-logs',
  'Gauntlet only starts if you claim to be Tom while unverified — and never again after you clear, until logout.',
  'The Faceless Blur app bot listens; agents reply as themselves. Presence rotates on the neon grid.',
].join('\n')

/** View + Send + Read History + Embed Links + Manage Webhooks */
const BOT_INVITE_PERMISSIONS =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.ReadMessageHistory |
  PermissionFlagsBits.EmbedLinks |
  PermissionFlagsBits.ManageWebhooks

function isDiscordDebug() {
  const flag = String(process.env.DISCORD_DEBUG || '').trim().toLowerCase()
  if (flag === '0' || flag === 'false' || flag === 'off') return false
  if (flag === '1' || flag === 'true' || flag === 'on') return true
  return process.env.NODE_ENV !== 'production'
}

function buildBotInviteUrl(clientId) {
  const id = clientId || process.env.DISCORD_CLIENT_ID || ''
  return `https://discord.com/api/oauth2/authorize?client_id=${id}&permissions=${BOT_INVITE_PERMISSIONS}&scope=bot`
}

function dlog(...args) {
  if (!isDiscordDebug()) return
  console.log('[discord:debug]', ...args)
}

/**
 * @param {object} deps
 * @param {import('./managerAi.js').ManagerAi} deps.manager
 * @param {import('./securityGuardian.js').SecurityGuardian} deps.guardian
 */
export function startDiscordBot({ manager, guardian }) {
  installDiscordProcessGuards({ label: 'faceless-discord' })

  const token = getDiscordBotToken()
  const channelId = getDiscordCommandChannelId()
  const configuredNotifyChannelId = getDiscordNotifyChannelId()
  const configuredFrontlineLogsChannelId = getDiscordFrontlineLogsChannelId()
  /** Resolved at runtime (config ID or name discovery). */
  let notifyChannelId = configuredNotifyChannelId
  let frontlineLogsChannelId = configuredFrontlineLogsChannelId
  const ownerUserId = getDiscordOwnerUserId()
  const debug = isDiscordDebug()

  /** @type {Map<string, import('discord.js').Webhook>} */
  const webhookCache = new Map()

  /** @type {ReturnType<typeof startDiscordPresenceLoop> | null} */
  let presenceLoop = null
  let bootstrapped = false

  /** @type {Map<string, 'manager'|'guardian'|'frontline'>} last persona per Discord user */
  const activePersonaByUser = new Map()

  console.log('[discord] boot config', {
    debug,
    tokenConfigured: Boolean(token),
    tokenLength: token ? token.length : 0,
    commandChannelId: channelId || null,
    notifyChannelId: configuredNotifyChannelId || null,
    frontlineLogsChannelId: configuredFrontlineLogsChannelId || null,
    ownerUserIdLocked: Boolean(ownerUserId),
    identityMode: 'per-agent-webhooks',
    alwaysOn: true,
  })

  if (!token) {
    console.warn(
      '[discord] DISCORD_BOT_TOKEN not set — two-way bot disabled (webhooks still work).',
    )
    return null
  }
  if (!channelId) {
    console.warn(
      '[discord] DISCORD_COMMAND_CHANNEL_ID not set — bot will not listen until configured.',
    )
    return null
  }
  if (!configuredNotifyChannelId) {
    console.warn(
      '[discord] DISCORD_NOTIFY_CHANNEL_ID not set — will try to discover #agent-notifications by name.',
    )
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message],
    failIfNotExists: false,
    rest: { timeout: 30_000 },
  })

  wireDiscordGatewayResilience(client, {
    onResume: async () => {
      if (presenceLoop) {
        await presenceLoop.tick()
      }
    },
    onInvalidated: () => {
      try {
        presenceLoop?.stop?.()
      } catch {
        // ignore
      }
      try {
        manager.clearOwnerSession?.()
        activePersonaByUser.clear()
      } catch {
        // ignore
      }
      console.error(
        '[discord] Invalidated session — exiting process so `npm run discord:bot` / supervisor can cold-start a new Client (login() cannot reuse this instance)',
      )
      // Give logs a moment to flush, then exit non-zero for always-on wrappers.
      setTimeout(() => process.exit(1), 250)
    },
  })

  let commandChannel = null
  let notifyChannel = null
  let frontlineLogsChannel = null
  let resolveReady
  const whenReady = new Promise((resolve) => {
    resolveReady = resolve
  })

  function getActivePersona(discordUserId) {
    return activePersonaByUser.get(String(discordUserId)) || 'manager'
  }

  function setActivePersona(discordUserId, agent) {
    if (agent === 'manager' || agent === 'guardian' || agent === 'frontline') {
      activePersonaByUser.set(String(discordUserId), agent)
      console.log('[discord] active persona set', {
        userId: discordUserId,
        agent,
      })
    }
  }

  async function getCommandChannel() {
    if (commandChannel?.isTextBased?.()) return commandChannel
    // Only wait for ready if we still need to fetch
    await whenReady
    if (commandChannel?.isTextBased?.()) return commandChannel
    const ch = await client.channels.fetch(channelId).catch((err) => {
      console.error('[discord] command channel fetch failed:', err.message)
      return null
    })
    if (ch?.isTextBased?.()) commandChannel = ch
    return commandChannel
  }

  async function getNotifyChannel() {
    if (notifyChannel?.isTextBased?.()) return notifyChannel
    await whenReady
    if (notifyChannel?.isTextBased?.()) return notifyChannel
    if (!notifyChannelId) return null
    const ch = await client.channels.fetch(notifyChannelId).catch((err) => {
      console.error('[discord] notify channel fetch failed:', {
        id: notifyChannelId,
        error: err.message,
        code: err.code,
      })
      return null
    })
    if (ch?.isTextBased?.()) notifyChannel = ch
    return notifyChannel
  }

  async function getFrontlineLogsChannel() {
    if (frontlineLogsChannel?.isTextBased?.()) return frontlineLogsChannel
    await whenReady
    if (frontlineLogsChannel?.isTextBased?.()) return frontlineLogsChannel
    if (!frontlineLogsChannelId) return null
    const ch = await client.channels.fetch(frontlineLogsChannelId).catch((err) => {
      console.error('[discord] frontline-cs-logs fetch failed:', {
        id: frontlineLogsChannelId,
        error: err.message,
        code: err.code,
      })
      return null
    })
    if (ch?.isTextBased?.()) frontlineLogsChannel = ch
    return frontlineLogsChannel
  }

  /**
   * Resolve notifications channel: configured snowflake, else name match.
   * Never falls back to the command channel.
   */
  async function resolveNotifyChannel(readyClient) {
    const tryFetch = async (id, label) => {
      if (!id) return null
      try {
        const ch = await readyClient.channels.fetch(id)
        if (ch?.isTextBased?.()) {
          console.log('[discord] notify channel bound', {
            via: label,
            id: ch.id,
            name: 'name' in ch ? ch.name : null,
            type: ch.type,
          })
          return ch
        }
      } catch (err) {
        console.warn(`[discord] notify resolve failed (${label}):`, {
          id,
          error: err.message,
          code: err.code,
        })
      }
      return null
    }

    let ch = await tryFetch(configuredNotifyChannelId, 'DISCORD_NOTIFY_CHANNEL_ID')
    if (ch) return ch

    // Discover by channel name across guilds the bot is in
    const namePatterns = [
      /^agent[-_]?notifications?$/i,
      /^agent[-_]?alerts?$/i,
      /^notifications?$/i,
      /^alerts?$/i,
    ]

    for (const guild of readyClient.guilds.cache.values()) {
      try {
        await guild.channels.fetch()
      } catch (err) {
        console.warn('[discord] guild channel fetch failed:', guild.id, err.message)
      }

      const matches = [...guild.channels.cache.values()].filter((c) => {
        if (!c?.isTextBased?.()) return false
        if (String(c.id) === String(channelId)) return false
        const name = String(c.name || '')
        return namePatterns.some((re) => re.test(name))
      })

      // Prefer agent-notifications style names
      matches.sort((a, b) => {
        const score = (n) =>
          /agent/i.test(n) ? 0 : /notification/i.test(n) ? 1 : 2
        return score(a.name) - score(b.name)
      })

      if (matches[0]) {
        console.log('[discord] notify channel discovered by name', {
          id: matches[0].id,
          name: matches[0].name,
          guild: guild.name,
        })
        console.log(
          `[discord] Tip: set DISCORD_NOTIFY_CHANNEL_ID=${matches[0].id} in .env to pin this channel.`,
        )
        return matches[0]
      }
    }

    console.error(
      '[discord] No notifications channel found. Create #agent-notifications, grant the bot View/Send/Manage Webhooks, and set DISCORD_NOTIFY_CHANNEL_ID.',
    )
    return null
  }

  /**
   * Resolve Frontline CS logs channel: configured snowflake, else name match.
   * Never falls back to command or notify channels.
   */
  async function resolveFrontlineLogsChannel(readyClient) {
    const reserved = new Set(
      [channelId, notifyChannelId, configuredNotifyChannelId]
        .filter(Boolean)
        .map(String),
    )

    const tryFetch = async (id, label) => {
      if (!id) return null
      try {
        const ch = await readyClient.channels.fetch(id)
        if (ch?.isTextBased?.() && !reserved.has(String(ch.id))) {
          console.log('[discord] frontline-cs-logs bound', {
            via: label,
            id: ch.id,
            name: 'name' in ch ? ch.name : null,
          })
          return ch
        }
      } catch (err) {
        console.warn(`[discord] frontline-cs-logs resolve failed (${label}):`, {
          id,
          error: err.message,
          code: err.code,
        })
      }
      return null
    }

    let ch = await tryFetch(
      configuredFrontlineLogsChannelId,
      'DISCORD_FRONTLINE_LOGS_CHANNEL_ID',
    )
    if (ch) return ch

    const namePatterns = [
      /^frontline[-_]?cs[-_]?logs?$/i,
      /^frontline[-_]?logs?$/i,
      /^cs[-_]?logs?$/i,
      /^support[-_]?logs?$/i,
    ]

    for (const guild of readyClient.guilds.cache.values()) {
      try {
        await guild.channels.fetch()
      } catch {
        // ignore
      }
      const matches = [...guild.channels.cache.values()].filter((c) => {
        if (!c?.isTextBased?.()) return false
        if (reserved.has(String(c.id))) return false
        return namePatterns.some((re) => re.test(String(c.name || '')))
      })
      matches.sort((a, b) => {
        const score = (n) => (/frontline/i.test(n) ? 0 : /cs/i.test(n) ? 1 : 2)
        return score(a.name) - score(b.name)
      })
      if (matches[0]) {
        console.log('[discord] frontline-cs-logs discovered by name', {
          id: matches[0].id,
          name: matches[0].name,
        })
        console.log(
          `[discord] Tip: set DISCORD_FRONTLINE_LOGS_CHANNEL_ID=${matches[0].id} in .env`,
        )
        return matches[0]
      }
    }

    console.warn(
      '[discord] No #frontline-cs-logs channel found. Create it and set DISCORD_FRONTLINE_LOGS_CHANNEL_ID.',
    )
    return null
  }

  /**
   * Ensure a stable channel webhook for an agent identity.
   * @param {import('discord.js').TextBasedChannel} channel
   * @param {keyof typeof AGENT_PROFILES} agentKey
   * @param {string} [cacheScope]
   */
  async function ensureAgentWebhook(channel, agentKey, cacheScope = 'cmd') {
    const profile = AGENT_PROFILES[agentKey] || AGENT_PROFILES.bridge
    const cacheKey = `${cacheScope}:${profile.key}`
    const cached = webhookCache.get(cacheKey)
    if (cached) return cached

    if (!('fetchWebhooks' in channel) || typeof channel.fetchWebhooks !== 'function') {
      return null
    }

    const hooks = await channel.fetchWebhooks()
    let hook =
      hooks.find(
        (w) =>
          w.name === profile.webhookName &&
          w.owner?.id === client.user?.id,
      ) || null

    if (!hook) {
      if (!('createWebhook' in channel)) return null
      hook = await channel.createWebhook({
        name: profile.webhookName,
        reason: `Faceless agent identity: ${profile.username} (${cacheScope})`,
      })
      console.log('[discord] created agent webhook', {
        agent: profile.key,
        scope: cacheScope,
        webhookId: hook.id,
      })
    }

    webhookCache.set(cacheKey, hook)
    return hook
  }

  /**
   * Post as a specific agent identity in the command (chat) channel.
   */
  async function sendAsAgent(content, opts = {}) {
    const agentKey = opts.agent && AGENT_PROFILES[opts.agent] ? opts.agent : 'bridge'
    const profile = AGENT_PROFILES[agentKey]
    const text = String(content || '').slice(0, 1900)
    if (!text) return { delivered: false, channel: 'empty' }

    const ch = await getCommandChannel()
    if (!ch) {
      return { delivered: false, channel: 'missing' }
    }

    const mention =
      opts.replyToUserId && /^\d{16,22}$/.test(String(opts.replyToUserId))
        ? `<@${opts.replyToUserId}> `
        : ''
    const body = `${mention}${text}`.slice(0, 2000)

    try {
      const hook = await ensureAgentWebhook(ch, agentKey, 'cmd')
      if (hook) {
        await hook.send({
          content: body,
          username: `${profile.label} ${profile.username}`.trim(),
          allowedMentions: {
            parse: [],
            users: opts.replyToUserId ? [opts.replyToUserId] : [],
          },
        })
        dlog('sent as agent webhook (command)', {
          agent: agentKey,
          chars: body.length,
        })
        return { delivered: true, channel: 'discord-command', agent: agentKey }
      }
    } catch (error) {
      console.warn('[discord] command webhook send failed:', error.message)
    }

    try {
      await ch.send({
        content: `**${profile.label} ${profile.username}:**\n${text}`.slice(0, 2000),
        allowedMentions: { parse: [] },
      })
      return { delivered: true, channel: 'discord-command-fallback', agent: agentKey }
    } catch (sendErr) {
      console.error('[discord] command send failed:', sendErr.message)
      return { delivered: false, channel: 'error', error: String(sendErr.message || sendErr) }
    }
  }

  /**
   * Automated notifications only — never chat / gauntlet.
   * Prefer direct channel.send (reliable permissions), then webhook identity.
   */
  async function sendAsNotification(content, opts = {}) {
    const agentKey = opts.agent && AGENT_PROFILES[opts.agent] ? opts.agent : 'bridge'
    const profile = AGENT_PROFILES[agentKey]
    const text = String(content || '').slice(0, 1900)
    if (!text) return { delivered: false, channel: 'empty' }

    const ch = await getNotifyChannel()
    if (!ch) {
      console.error('[discord] notification dropped — notify channel unavailable', {
        agent: agentKey,
        configuredId: configuredNotifyChannelId,
        resolvedId: notifyChannelId,
      })
      return { delivered: false, channel: 'notify-missing' }
    }

    if (String(ch.id) === String(channelId)) {
      console.error(
        '[discord] Refusing to post notification into command channel — check DISCORD_NOTIFY_CHANNEL_ID',
      )
      return { delivered: false, channel: 'notify-refused-command' }
    }

    // Permission check before send
    let perms = null
    try {
      if ('permissionsFor' in ch && ch.guild) {
        const me =
          ch.guild.members.me ||
          (await ch.guild.members.fetchMe().catch(() => null))
        if (me) {
          const p = ch.permissionsFor(me)
          perms = {
            ViewChannel: p?.has(PermissionFlagsBits.ViewChannel) ?? false,
            SendMessages: p?.has(PermissionFlagsBits.SendMessages) ?? false,
            ManageWebhooks: p?.has(PermissionFlagsBits.ManageWebhooks) ?? false,
          }
        }
      }
    } catch (permErr) {
      console.warn('[discord] notify permission check failed:', permErr.message)
    }

    console.log('[discord] posting notification', {
      agent: agentKey,
      kind: opts.kind || null,
      channelId: ch.id,
      channelName: 'name' in ch ? ch.name : null,
      perms,
    })

    if (perms && (!perms.ViewChannel || !perms.SendMessages)) {
      console.error(
        '[discord] Bot lacks View Channel / Send Messages on notify channel',
        perms,
      )
      return {
        delivered: false,
        channel: 'notify-forbidden',
        perms,
        error: 'Missing ViewChannel or SendMessages on agent-notifications',
      }
    }

    const labeled = `**${profile.label} ${profile.username}:**\n${text}`.slice(0, 2000)

    // 1) Direct send first (does not depend on webhook API)
    try {
      await withTimeout(
        ch.send({ content: labeled, allowedMentions: { parse: [] } }),
        8000,
        'notify channel.send',
      )
      console.log('[discord] notification delivered via channel.send', {
        channelId: ch.id,
        agent: agentKey,
      })
      return {
        delivered: true,
        channel: 'discord-notify-send',
        agent: agentKey,
        channelId: ch.id,
      }
    } catch (sendErr) {
      console.error('[discord] notify channel.send failed:', {
        message: sendErr.message,
        code: sendErr.code,
      })
    }

    // 2) Webhook identity fallback
    try {
      const hook = await withTimeout(
        ensureAgentWebhook(ch, agentKey, 'notify'),
        8000,
        'notify ensureAgentWebhook',
      )
      if (hook) {
        await withTimeout(
          hook.send({
            content: text,
            username: `${profile.label} ${profile.username}`.trim(),
            allowedMentions: { parse: [] },
          }),
          8000,
          'notify webhook.send',
        )
        console.log('[discord] notification delivered via webhook', {
          channelId: ch.id,
          agent: agentKey,
        })
        return {
          delivered: true,
          channel: 'discord-notify-webhook',
          agent: agentKey,
          channelId: ch.id,
        }
      }
    } catch (error) {
      console.warn('[discord] notify webhook path failed:', error.message)
    }

    return {
      delivered: false,
      channel: 'error',
      error: 'Both channel.send and webhook.send failed for notify channel',
      perms,
    }
  }

  function withTimeout(promise, ms, label) {
    let timer
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms,
      )
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
  }

  async function runNotifyTest(message, eventId) {
    console.log('[discord] manual notify test requested', {
      eventId,
      from: message.author?.tag,
      sourceChannelId: message.channelId,
    })

    const stamp = new Date().toISOString()
    const content = [
      '🧪 **Guardian notify test**',
      `Triggered by: ${message.author.tag}`,
      `Time: ${stamp}`,
      'Command: `!testnotify`',
      'If you see this in #agent-notifications, Guardian → notify routing is working.',
    ].join('\n')

    let delivery
    try {
      delivery = await sendAsNotification(content, {
        agent: 'guardian',
        kind: 'anomaly',
      })
    } catch (err) {
      console.error('[discord] testnotify threw:', err)
      delivery = {
        delivered: false,
        channel: 'error',
        error: String(err.message || err),
      }
    }

    console.log('[discord] testnotify delivery result', delivery)

    const ch = notifyChannel
    const ack = [
      delivery?.delivered
        ? '✅ Test alert sent to the notifications channel.'
        : '❌ Test alert did **not** deliver to notifications.',
      `Delivery: \`${delivery?.channel || 'unknown'}\``,
      delivery?.error ? `Error: ${delivery.error}` : null,
      delivery?.perms
        ? `Perms: View=${delivery.perms.ViewChannel} Send=${delivery.perms.SendMessages} Webhooks=${delivery.perms.ManageWebhooks}`
        : null,
      ch
        ? `Target: #${'name' in ch ? ch.name : 'notifications'} (\`${ch.id}\`)`
        : `Target unresolved (configured \`${configuredNotifyChannelId || 'none'}\` / resolved \`${notifyChannelId || 'none'}\`)`,
      delivery?.delivered
        ? 'Check **#agent-notifications** now.'
        : 'Fix View/Send on that channel, confirm `DISCORD_NOTIFY_CHANNEL_ID`, restart, retry `!testnotify` from **#command-channel**.',
    ]
      .filter(Boolean)
      .join('\n')

    try {
      await sendAsAgent(ack, {
        agent: 'guardian',
        replyToUserId: message.author.id,
      })
    } catch (ackErr) {
      console.error('[discord] testnotify ack via webhook failed, trying reply:', ackErr.message)
      try {
        await message.reply({ content: ack.slice(0, 2000), failIfNotExists: false })
      } catch (replyErr) {
        console.error('[discord] testnotify ack reply failed:', replyErr.message)
      }
    }
  }

  async function sendToCommandChannel(content, opts = {}) {
    return sendAsAgent(content, { agent: opts.agent || 'bridge' })
  }

  /**
   * Frontline CS logs only — transcripts / triage / escalations.
   * Isolated from command-channel and agent-notifications.
   */
  async function sendAsFrontlineLog(content, opts = {}) {
    const text = String(content || '').slice(0, 1900)
    if (!text) return { delivered: false, channel: 'empty' }

    const ch = await getFrontlineLogsChannel()
    if (!ch) {
      return { delivered: false, channel: 'frontline-logs-missing' }
    }

    if (
      String(ch.id) === String(channelId) ||
      String(ch.id) === String(notifyChannelId)
    ) {
      console.error(
        '[discord] Refusing to post Frontline CS log into command/notify channel',
      )
      return { delivered: false, channel: 'frontline-logs-refused' }
    }

    const labeled = `💬 **Frontline AI**\n${text}`.slice(0, 2000)
    console.log('[discord] posting frontline CS log', {
      channelId: ch.id,
      channelName: 'name' in ch ? ch.name : null,
      kind: opts.kind || null,
      chars: labeled.length,
    })

    try {
      await withTimeout(
        ch.send({ content: labeled, allowedMentions: { parse: [] } }),
        8000,
        'frontline-logs channel.send',
      )
      return {
        delivered: true,
        channel: 'discord-frontline-logs',
        channelId: ch.id,
      }
    } catch (sendErr) {
      console.error('[discord] frontline-cs-logs send failed:', sendErr.message)
    }

    try {
      const hook = await withTimeout(
        ensureAgentWebhook(ch, 'frontline', 'cs-logs'),
        8000,
        'frontline-logs webhook',
      )
      if (hook) {
        await withTimeout(
          hook.send({
            content: text,
            username: '💬 Frontline AI',
            allowedMentions: { parse: [] },
          }),
          8000,
          'frontline-logs webhook.send',
        )
        return {
          delivered: true,
          channel: 'discord-frontline-logs-webhook',
          channelId: ch.id,
        }
      }
    } catch (err) {
      console.warn('[discord] frontline-cs-logs webhook failed:', err.message)
    }

    return { delivered: false, channel: 'error' }
  }

  // Chat stream stays available; automated Manager/Guardian posts use notify sender.
  setDiscordChannelSender(sendToCommandChannel)
  setDiscordNotifySender(sendAsNotification)
  setDiscordFrontlineLogSender(sendAsFrontlineLog)

  client.on(Events.Error, (error) => {
    console.error('[discord] client error:', error)
  })

  client.on(Events.Warn, (info) => {
    console.warn('[discord] client warn:', info)
  })

  if (debug) {
    client.on(Events.Debug, (info) => {
      if (/Heartbeat|heartbeat|latency/i.test(info)) return
      dlog('gateway', info)
    })

    client.on(Events.Raw, (packet) => {
      if (!packet || packet.t !== 'MESSAGE_CREATE') return
      const d = packet.d || {}
      dlog('raw MESSAGE_CREATE', {
        id: d.id,
        channel_id: d.channel_id,
        author: d.author?.username,
        authorBot: Boolean(d.author?.bot),
        webhook_id: d.webhook_id || null,
        contentPreview:
          typeof d.content === 'string' ? d.content.slice(0, 80) : null,
        matchesCommandChannel: String(d.channel_id) === String(channelId),
      })
    })
  }

  client.on(Events.ClientReady, (readyClient) => {
    void (async () => {
      try {
        const user = readyClient.user
        const guildCount = readyClient.guilds.cache.size
        const inviteUrl = buildBotInviteUrl(user?.id)
        const isReconnect = bootstrapped

        console.log(
          `[discord] bot ${isReconnect ? 'reconnected' : 'online'} as ${user?.tag} (${user?.id}) — 24/7 Bridge`,
        )
        console.log('[discord] channels', {
          commandChannelId: channelId,
          notifyChannelId: notifyChannelId || null,
          guilds: guildCount,
          reconnect: isReconnect,
        })

        if (!presenceLoop) {
          presenceLoop = startDiscordPresenceLoop(readyClient, {
            intervalMs:
              Number(process.env.DISCORD_PRESENCE_INTERVAL_MS) || 5 * 60_000,
          })
        } else {
          await presenceLoop.tick()
        }

        if (isReconnect) {
          // Avoid re-spamming startup messages on Gateway resume/reconnect.
          return
        }
        bootstrapped = true

        if (guildCount === 0) {
          console.error('[discord] Bot is in 0 servers — invite it first:')
          console.error(`  ${inviteUrl}`)
        }

        try {
          commandChannel = await readyClient.channels.fetch(channelId)
          console.log('[discord] command channel bound', {
            id: commandChannel?.id,
            name:
              commandChannel && 'name' in commandChannel
                ? commandChannel.name
                : null,
            type: commandChannel?.type,
          })

          notifyChannel = await resolveNotifyChannel(readyClient)
          if (notifyChannel) {
            notifyChannelId = notifyChannel.id
          }

          resolveReady(readyClient)

          if (notifyChannel) {
            for (const key of ['manager', 'guardian', 'bridge']) {
              try {
                await ensureAgentWebhook(notifyChannel, key, 'notify')
              } catch (err) {
                console.warn(
                  `[discord] notify webhook warm-up failed for ${key}:`,
                  err.message,
                )
              }
            }
            const bootNotify = await sendAsNotification(
              'Notifications stream online. Automated alerts, health checks, and status signals only — no chat, no gauntlet.',
              { agent: 'bridge', kind: 'startup' },
            )
            console.log('[discord] notify channel ready', {
              id: notifyChannel.id,
              name: 'name' in notifyChannel ? notifyChannel.name : null,
              bootNotify,
            })
          }

          frontlineLogsChannel = await resolveFrontlineLogsChannel(readyClient)
          if (frontlineLogsChannel) {
            frontlineLogsChannelId = frontlineLogsChannel.id
            try {
              await ensureAgentWebhook(frontlineLogsChannel, 'frontline', 'cs-logs')
            } catch (err) {
              console.warn(
                '[discord] frontline-cs-logs webhook warm-up failed:',
                err.message,
              )
            }
            const bootCs = await sendAsFrontlineLog(
              '`[STARTUP]` Frontline CS logs online. Transcripts, triage notes, and escalations only — isolated from command-channel and agent-notifications.',
              { kind: 'startup' },
            )
            console.log('[discord] frontline-cs-logs ready', {
              id: frontlineLogsChannel.id,
              name:
                'name' in frontlineLogsChannel
                  ? frontlineLogsChannel.name
                  : null,
              bootCs,
            })
          }

          if (
            commandChannel &&
            'permissionsFor' in commandChannel &&
            commandChannel.guild
          ) {
            const me =
              commandChannel.guild.members.me ||
              (await commandChannel.guild.members.fetchMe().catch(() => null))
            if (me) {
              const perms = commandChannel.permissionsFor(me)
              const access = {
                ViewChannel: perms?.has(PermissionFlagsBits.ViewChannel) ?? false,
                SendMessages:
                  perms?.has(PermissionFlagsBits.SendMessages) ?? false,
                ManageWebhooks:
                  perms?.has(PermissionFlagsBits.ManageWebhooks) ?? false,
              }
              console.log('[discord] command channel permissions', access)
              if (!access.ManageWebhooks) {
                console.warn(
                  '[discord] Manage Webhooks missing — agent identities need it. Re-invite:\n  ' +
                    inviteUrl,
                )
              }
            }
          }

          for (const key of ['manager', 'guardian', 'frontline', 'bridge']) {
            try {
              await ensureAgentWebhook(commandChannel, key, 'cmd')
            } catch (err) {
              console.warn(
                `[discord] command webhook warm-up failed for ${key}:`,
                err.message,
              )
            }
          }

          await sendAsAgent(
            'Bridge online — always-on autonomous mesh. Conversational channel: talk freely; follow-ups stick to your active persona.\n' +
              'Switch with `!manager` / `!guardian` / `!frontline` · `!help` for the short list.\n' +
              (notifyChannel
                ? `_Automated alerts → #${'name' in notifyChannel ? notifyChannel.name : 'notifications'}. `
                : '_Tip: set DISCORD_NOTIFY_CHANNEL_ID. ') +
              (frontlineLogsChannel
                ? `_Frontline CS transcripts → #${'name' in frontlineLogsChannel ? frontlineLogsChannel.name : 'frontline-cs-logs'}._`
                : '_Tip: set DISCORD_FRONTLINE_LOGS_CHANNEL_ID._'),
            { agent: 'bridge' },
          )
          console.log('[discord] startup bridge message delivered')
        } catch (error) {
          console.error('[discord] failed to bind command channel:', error.message)
          console.error(`[discord] Fix invite / channel perms with:\n  ${inviteUrl}`)
          resolveReady(readyClient)
        }
      } catch (error) {
        console.error(
          '[discord] ClientReady handler failed (non-fatal):',
          error?.message || error,
        )
        try {
          resolveReady(readyClient)
        } catch {
          // ignore
        }
      }
    })()
  })

  client.on(Events.MessageCreate, async (message) => {
    const eventId = `msg-${message.id || Date.now()}`
    try {
      // Ignore bots, webhooks (agent replies), and other channels
      if (message.author?.bot || message.webhookId) {
        dlog(`${eventId} skip: bot/webhook`)
        return
      }

      // Frontline CS logs: write-only — no chat / gauntlet / LLM
      if (
        frontlineLogsChannelId &&
        String(message.channelId) === String(frontlineLogsChannelId)
      ) {
        console.log('[discord] ignore chat in frontline-cs-logs (logs-only)', {
          eventId,
          from: message.author?.tag,
        })
        return
      }

      // Notifications channel: alerts-only, except explicit test commands
      if (notifyChannelId && String(message.channelId) === String(notifyChannelId)) {
        const maybeTest = String(message.content || '').trim()
        if (/^!(?:testnotify|pingguardian|notifytest)\b/i.test(maybeTest)) {
          await runNotifyTest(message, eventId)
          return
        }
        console.log('[discord] ignore chat in notify channel (alerts-only)', {
          eventId,
          from: message.author?.tag,
        })
        return
      }

      if (String(message.channelId) !== String(channelId)) {
        dlog(`${eventId} skip: wrong channel`)
        return
      }

      console.log('[discord] command-channel message received', {
        eventId,
        from: message.author?.tag,
        preview: String(message.content || '').slice(0, 100),
      })

      if (ownerUserId && String(message.author.id) !== String(ownerUserId)) {
        await sendAsAgent(
          'This command channel is locked to Tom. Unauthorized commands are ignored.',
          { agent: 'bridge', replyToUserId: message.author.id },
        )
        return
      }

      const raw = String(message.content || '').trim()
      if (!raw) {
        console.warn('[discord] empty content — check Message Content Intent', { eventId })
        await sendAsAgent(
          "I saw a message event with empty text. Enable **Message Content Intent** in the Developer Portal, then restart.",
          { agent: 'bridge', replyToUserId: message.author.id },
        )
        return
      }

      // Accept full Discord-length messages (up to ~2k); do not drop long normal chat
      const userText = raw.slice(0, 4000)

      // Mid-gauntlet answers (no agent prefix required) go straight to Manager
      const inGauntlet =
        typeof manager.isDiscordSessionVerified === 'function' &&
        !manager.isDiscordSessionVerified(message.author.id) &&
        manager._discordGauntlet?.has?.(String(message.author.id))

      if (inGauntlet) {
        console.log('[discord] routing gauntlet answer to Manager', { eventId })
        const answerText = userText
          .replace(
            /^(?:!manager\b|!guardian\b|!frontline\b|!support\b|manager\s*:|guardian\s*:|frontline\s*:)\s*/i,
            '',
          )
          .trim()
        const replyText = await manager.handleDiscordChat(answerText || userText, {
          discordUserId: message.author.id,
          discordTag: message.author.tag,
        })
        await sendAsAgent(replyText, {
          agent: 'manager',
          replyToUserId: message.author.id,
        })
        return
      }

      const parsed = parseAgentCommand(userText, client.user?.id)
      dlog(`${eventId} parsed command`, parsed)

      const sessionVerified =
        typeof manager.isDiscordSessionVerified === 'function' &&
        manager.isDiscordSessionVerified(message.author.id)

      // Sticky persona: explicit address switches voice; follow-ups stay there.
      // Never force Manager when the user is talking to Frontline/Guardian.
      let route
      if (parsed?.agent === 'help' || parsed?.agent === 'testnotify') {
        route = parsed
      } else if (parsed?.agent === 'multi') {
        route = parsed
      } else if (
        parsed?.agent === 'manager' ||
        parsed?.agent === 'guardian' ||
        parsed?.agent === 'frontline'
      ) {
        setActivePersona(message.author.id, parsed.agent)
        route = parsed
      } else {
        // unaddressed → active persona (not always Manager)
        const active = getActivePersona(message.author.id)
        console.log('[discord] sticky persona route', {
          eventId,
          active,
          sessionVerified,
        })
        route = { agent: active, text: userText }
      }

      // Explicit "I am Tom" while unverified → Manager owns gauntlet only.
      // Do not steal Frontline/Guardian threads for casual Tom mentions.
      if (
        !sessionVerified &&
        claimsToBeTom(userText) &&
        route.agent !== 'help' &&
        route.agent !== 'multi'
      ) {
        console.log('[discord] Tom identity claim — Manager gauntlet', { eventId })
        setActivePersona(message.author.id, 'manager')
        route = { agent: 'manager', text: userText }
      }

      if (route.agent === 'help') {
        await sendAsAgent(HELP_TEXT, {
          agent: 'bridge',
          replyToUserId: message.author.id,
        })
        return
      }

      if (route.agent === 'testnotify') {
        await runNotifyTest(message, eventId)
        return
      }

      if (route.agent === 'multi' && Array.isArray(route.agents)) {
        await sendAsAgent(
          `You pinged ${route.agents.map((a) => AGENT_PROFILES[a]?.username || a).join(', ')}. ` +
            'Chat normally after — or keep using `!guardian` / `!frontline` when you want a specific voice.',
          { agent: 'bridge', replyToUserId: message.author.id },
        )
        for (const agentKey of route.agents) {
          const intro =
            agentKey === 'guardian'
              ? "Hey Tom — Guardian on the line. What's on your mind?"
              : agentKey === 'frontline'
                ? "Hey Tom — Frontline here. Product, hospital, ecosystem — let's talk."
                : "Hey Tom — Manager here. I'm listening."
          await sendAsAgent(intro, {
            agent: agentKey,
            replyToUserId: message.author.id,
          })
        }
        return
      }

      try {
        await message.channel.sendTyping()
      } catch {
        // ignore
      }

      console.log('[discord] conversational route', {
        eventId,
        agent: route.agent,
        chars: String(route.text || '').length,
        preview: String(route.text || '').slice(0, 100),
      })

      let replyText = ''
      const t0 = Date.now()
      const chatMeta = {
        discordUserId: message.author.id,
        discordTag: message.author.tag,
        verifiedOwner: sessionVerified,
      }

      if (route.agent === 'manager') {
        replyText = await generatePersonaReply({
          agent: 'manager',
          text: route.text,
          meta: chatMeta,
          manager,
          guardian,
        })
        if (/^!?(logout|verify-logout|unverify)\b/i.test(String(route.text || ''))) {
          activePersonaByUser.delete(String(message.author.id))
        }
      } else if (route.agent === 'guardian') {
        replyText = await generatePersonaReply({
          agent: 'guardian',
          text: route.text,
          meta: chatMeta,
          manager,
          guardian,
        })
      } else if (route.agent === 'frontline') {
        replyText = await generatePersonaReply({
          agent: 'frontline',
          text: route.text,
          meta: chatMeta,
          manager,
          guardian,
        })
      } else {
        // Never fall back to Manager for unknown — stick to active persona
        const active = getActivePersona(message.author.id)
        setActivePersona(message.author.id, active)
        replyText = await generatePersonaReply({
          agent: active,
          text: route.text,
          meta: chatMeta,
          manager,
          guardian,
        })
        route = { ...route, agent: active }
      }

      console.log('[discord] AI reply ready', {
        eventId,
        agent: route.agent,
        ms: Date.now() - t0,
        replyChars: String(replyText || '').length,
      })

      const chunks = splitDiscordMessage(replyText || '…')
      for (const chunk of chunks) {
        await sendAsAgent(chunk, {
          agent: route.agent === 'help' ? 'bridge' : route.agent,
          replyToUserId: message.author.id,
        })
      }

      try {
        await message.react('✅')
      } catch {
        // ignore
      }

      console.log('[discord] reply delivered', {
        eventId,
        agent: route.agent,
        chunks: chunks.length,
      })
    } catch (error) {
      console.error('[discord] message handler error:', {
        eventId,
        message: error?.message,
        stack: error?.stack,
      })
      try {
        await sendAsAgent(
          'Something glitched on my side. Try again in a moment.',
          { agent: 'bridge', replyToUserId: message.author?.id },
        )
      } catch {
        // ignore
      }
    }
  })

  console.log('[discord] logging in to Gateway (always-on retry armed)…')
  const loginPromise = loginDiscordWithRetry(client, token).catch((error) => {
    console.error('[discord] login loop aborted:', error?.message || error)
    setDiscordChannelSender(null)
    resolveReady(null)
    throw error
  })

  // Do not clear verification on ShardDisconnect — Discord resumes often and would
  // incorrectly re-trigger the gauntlet / let Manager hijack other personas.
  // Invalidated sessions are handled in wireDiscordGatewayResilience (exit for cold restart).

  return {
    client,
    whenReady,
    loginPromise,
    sendAsAgent,
    sendAsNotification,
    sendAsFrontlineLog,
    stopPresence: () => presenceLoop?.stop?.(),
  }
}

/**
 * Parse optional agent address. Unprefixed → conversational default (caller routes to Manager LLM).
 * @param {string} content
 * @param {string|undefined} botUserId
 */
export function parseAgentCommand(content, botUserId) {
  let text = content.trim()
  let mentionedBot = false

  if (botUserId) {
    const mentionRe = new RegExp(`<@!?${botUserId}>`, 'g')
    if (mentionRe.test(text)) {
      mentionedBot = true
      text = text.replace(mentionRe, '').trim()
    }
  }

  if (/^!help\b/i.test(text) || /^help\s*$/i.test(text)) {
    return { agent: 'help', text: '' }
  }

  if (/^!(?:testnotify|pingguardian|notifytest)\b/i.test(text)) {
    return { agent: 'testnotify', text: '' }
  }

  if (/^!?(logout|verify-logout|unverify)\b/i.test(text)) {
    return { agent: 'manager', text: text.replace(/^!/, '') }
  }

  if (mentionedBot && !text) {
    return { agent: 'help', text: '' }
  }

  const patterns = [
    { agent: 'manager', re: /^(?:!manager\b|manager\s*:)\s*/i },
    { agent: 'guardian', re: /^(?:!guardian\b|guardian\s*:)\s*/i },
    {
      agent: 'frontline',
      re: /^(?:!frontline\b|!support\b|frontline(?:\s*ai)?\s*:|support\s*:)\s*/i,
    },
  ]

  for (const { agent, re } of patterns) {
    if (re.test(text)) {
      const rest = text.replace(re, '').trim()
      return {
        agent,
        text: rest || 'Hey — just checking in. Talk to me.',
      }
    }
  }

  const natural = text.match(
    /^(?:hey\s+|hi\s+|ok\s+|okay\s+)?(manager|guardian|frontline(?:\s*ai)?|support)\b[\s,:\-]+(.*)$/i,
  )
  if (natural) {
    const name = natural[1].toLowerCase().replace(/\s+/g, '')
    const agent =
      name === 'support' || name.startsWith('frontline')
        ? 'frontline'
        : name === 'guardian'
          ? 'guardian'
          : 'manager'
    return {
      agent,
      text: (natural[2] || '').trim() || 'Hey — just checking in. Talk to me.',
    }
  }

  const wants = []
  if (/\bmanagers?\b/i.test(text)) wants.push('manager')
  if (/\bguardians?\b/i.test(text)) wants.push('guardian')
  if (/\bfrontlines?\b/i.test(text)) wants.push('frontline')
  if (
    wants.length >= 2 &&
    /\b(talk|speak|chat|ping|call|message|want)\b/i.test(text)
  ) {
    return { agent: 'multi', agents: wants, text }
  }

  // Default: conversational (Manager LLM) — never drop
  return { agent: 'unaddressed', text }
}

function splitDiscordMessage(text, max = 1900) {
  const s = String(text || '')
  if (s.length <= max) return [s]
  const parts = []
  for (let i = 0; i < s.length; i += max) {
    parts.push(s.slice(i, i + max))
  }
  return parts
}

export default startDiscordBot
