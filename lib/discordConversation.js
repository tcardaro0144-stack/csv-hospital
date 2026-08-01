/**
 * Conversational Discord LLM pipeline.
 * Short per-user memory + Workers AI chat — not FAQ triage / command matching.
 */

import { createChatCompletion, isWorkersAiConfigured } from './aiClient.js'

/** @type {Map<string, Array<{ role: 'user'|'assistant', content: string }>>} */
const histories = new Map()

const MAX_TURNS = 12 // user+assistant pairs kept roughly as 24 messages
const MAX_USER_CHARS = 4000 // Discord is 2k; allow join/edit edge cases
const MAX_REPLY_CHARS = 1900

function historyKey(agent, discordUserId) {
  return `${agent}:${discordUserId || 'anon'}`
}

export function clearDiscordConversation(discordUserId = null, agent = null) {
  if (!discordUserId && !agent) {
    histories.clear()
    return
  }
  if (discordUserId && agent) {
    histories.delete(historyKey(agent, discordUserId))
    return
  }
  if (discordUserId) {
    const prefix = `:${discordUserId}`
    for (const key of [...histories.keys()]) {
      if (key.endsWith(prefix) || key.includes(`:${discordUserId}`)) {
        histories.delete(key)
      }
    }
  }
}

function getHistory(agent, discordUserId) {
  const key = historyKey(agent, discordUserId)
  if (!histories.has(key)) histories.set(key, [])
  return histories.get(key)
}

function pushHistory(agent, discordUserId, role, content) {
  const list = getHistory(agent, discordUserId)
  list.push({ role, content: String(content).slice(0, MAX_USER_CHARS) })
  // Keep last N messages
  const maxMessages = MAX_TURNS * 2
  if (list.length > maxMessages) {
    list.splice(0, list.length - maxMessages)
  }
}

/**
 * Run a natural conversational turn via Workers AI.
 * @param {object} opts
 * @param {string} opts.agent - manager | guardian | frontline
 * @param {string} opts.system
 * @param {string} opts.userMessage
 * @param {string} [opts.discordUserId]
 * @param {number} [opts.temperature]
 * @param {string} [opts.fallback]
 * @returns {Promise<string>}
 */
export async function runDiscordLlmTurn(opts) {
  const agent = opts.agent || 'manager'
  const userMessage = String(opts.userMessage || '').trim().slice(0, MAX_USER_CHARS)
  const discordUserId = opts.discordUserId ? String(opts.discordUserId) : null
  const fallback =
    opts.fallback ||
    "I'm here — say that again in a moment if I went quiet. (AI pipeline may be offline.)"

  if (!userMessage) {
    return "I'm listening. Send me whatever's on your mind."
  }

  if (!isWorkersAiConfigured()) {
    return fallback
  }

  const prior = getHistory(agent, discordUserId)
  const transcript = prior
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n')

  try {
    const response = await createChatCompletion({
      temperature: opts.temperature ?? 0.55,
      max_tokens: opts.max_tokens ?? 1024,
      system: [
        opts.system,
        '',
        'You are in a live Discord conversation. Reply naturally in plain text (light markdown OK).',
        'Do not output JSON. Do not invent secrets. Do not dump internal triage flags.',
        'Do not refuse ordinary conversation. Match the user\'s length roughly — short for short, fuller for fuller.',
        'Keep each reply under ~1800 characters so it fits Discord.',
      ].join('\n'),
      user: [
        transcript
          ? `Recent conversation:\n${transcript}\n\n---\nLatest message:\n${userMessage}`
          : userMessage,
      ].join('\n'),
    })

    const reply = response?.text || response?.choices?.[0]?.message?.content
    if (typeof reply !== 'string' || !reply.trim()) {
      return fallback
    }

    const cleaned = reply.trim().slice(0, MAX_REPLY_CHARS)
    pushHistory(agent, discordUserId, 'user', userMessage)
    pushHistory(agent, discordUserId, 'assistant', cleaned)
    return cleaned
  } catch (error) {
    console.error(`[discord-llm] ${agent} turn failed:`, error?.message || error)
    if (error?.cause) {
      console.error(`[discord-llm] ${agent} cause:`, error.cause)
    }
    return fallback
  }
}

export default {
  runDiscordLlmTurn,
  clearDiscordConversation,
}
