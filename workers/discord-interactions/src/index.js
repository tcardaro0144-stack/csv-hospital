/**
 * CSV Hospital Discord Interactions Worker
 *
 * HTTP webhook endpoint — Discord POSTs signed interactions here.
 * No persistent Gateway → no local 24/7 process / timeout issues for slash commands.
 *
 * Secrets (via wrangler / npm run discord:deploy):
 *   DISCORD_PUBLIC_KEY  — General Information → Public Key (signature verify)
 *   DISCORD_BOT_TOKEN   — follow-up edits after deferred responses
 *   DISCORD_APPLICATION_ID — optional; used in logs
 */

import {
  InteractionResponseType,
  InteractionType,
} from 'discord-interactions'
import { verifyDiscordInteraction } from './verify.js'
import { runFrontlineAi } from './ai.js'
import { extractAskText } from './commands.js'

/**
 * @typedef {object} Env
 * @property {string} DISCORD_PUBLIC_KEY
 * @property {string} [DISCORD_BOT_TOKEN]
 * @property {string} [DISCORD_APPLICATION_ID]
 * @property {string} [AI_MODEL]
 * @property {string} [DISCORD_APP_NAME]
 * @property {*} [AI]
 */

export default {
  /**
   * @param {Request} request
   * @param {Env} env
   * @param {ExecutionContext} ctx
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (request.method === 'GET') {
      return json({
        service: 'csv-hospital-discord',
        ok: true,
        hint: 'POST Discord interactions here. Set this URL as Interactions Endpoint URL.',
        path: url.pathname,
      })
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    const verified = await verifyDiscordInteraction(
      request,
      env.DISCORD_PUBLIC_KEY,
    )
    if (!verified.ok) return verified.response

    let interaction
    try {
      interaction = JSON.parse(verified.body)
    } catch {
      return new Response('Invalid JSON body.', { status: 400 })
    }

    // Discord endpoint validation
    if (interaction.type === InteractionType.PING) {
      return json({ type: InteractionResponseType.PONG })
    }

    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      return handleApplicationCommand(interaction, env, ctx)
    }

    return json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'Unhandled interaction type on CSV Hospital Bridge Worker.',
        flags: 64, // ephemeral
      },
    })
  },
}

/**
 * @param {object} interaction
 * @param {Env} env
 * @param {ExecutionContext} ctx
 */
async function handleApplicationCommand(interaction, env, ctx) {
  const name = String(interaction?.data?.name || '').toLowerCase()

  if (name === 'ping' || name === 'bridge') {
    const app = env.DISCORD_APP_NAME || 'CSV Hospital Bridge'
    return json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content:
          name === 'ping'
            ? `pong — \`${app}\` Worker is live (HTTP interactions, no Gateway).`
            : [
                `**${app}** — Cloudflare Worker interactions`,
                '• Mode: HTTP webhook (bypasses persistent Gateway timeouts)',
                '• AI: Workers AI binding',
                '• Local Gateway bot (`npm run discord:bot`) remains optional for channel chat',
                `• App ID: \`${env.DISCORD_APPLICATION_ID || 'unset'}\``,
              ].join('\n'),
      },
    })
  }

  const askText = extractAskText(interaction)
  if (askText == null && (name === 'ask' || name === 'frontline')) {
    return json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'Provide a question or message.',
        flags: 64,
      },
    })
  }

  if (askText != null) {
    // Defer within 3s, then edit with AI result (waitUntil)
    const token = interaction.token
    const appId =
      env.DISCORD_APPLICATION_ID ||
      interaction.application_id ||
      ''

    ctx.waitUntil(
      (async () => {
        const userName =
          interaction.member?.user?.global_name ||
          interaction.member?.user?.username ||
          interaction.user?.global_name ||
          interaction.user?.username ||
          ''
        const reply = await runFrontlineAi(env, askText, { userName })
        await editOriginal(env, appId, token, reply)
      })().catch((err) => {
        console.error('[discord-worker] follow-up failed:', err?.message || err)
      }),
    )

    return json({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    })
  }

  return json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `Unknown command \`/${name}\`. Try \`/ask\`, \`/frontline\`, \`/bridge\`, or \`/ping\`.`,
      flags: 64,
    },
  })
}

/**
 * @param {Env} env
 * @param {string} applicationId
 * @param {string} interactionToken
 * @param {string} content
 */
async function editOriginal(env, applicationId, interactionToken, content) {
  if (!applicationId || !interactionToken) {
    console.error('[discord-worker] missing application_id or token for follow-up')
    return
  }

  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`
  const headers = {
    'Content-Type': 'application/json',
  }
  // Bot token optional for interaction follow-ups (webhook token in path is enough)
  if (env.DISCORD_BOT_TOKEN) {
    headers.Authorization = `Bot ${env.DISCORD_BOT_TOKEN}`
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      content: String(content || '').slice(0, 2000) || '…',
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[discord-worker] editOriginal', res.status, text.slice(0, 300))
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
