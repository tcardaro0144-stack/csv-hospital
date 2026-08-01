/**
 * Cloudflare Workers AI — native REST client.
 *
 * POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}
 * Authorization: Bearer {cloudflare_api_token}
 *
 * Instruct models accept `messages` (preferred) or `prompt`.
 */

import {
  getAiApiKey,
  getAiModel,
  getCloudflareAccountId,
  getWorkersAiRunUrl,
} from '../api/_lib/env.js'

export function getConfiguredAiModel() {
  return getAiModel()
}

/**
 * True when CF account + API token are present for /ai/run.
 */
export function isWorkersAiConfigured() {
  return Boolean(getAiApiKey() && getCloudflareAccountId() && getWorkersAiRunUrl())
}

/**
 * Legacy name — Workers AI is configured (no OpenAI SDK client).
 * @returns {boolean}
 */
export function createAiClient() {
  return isWorkersAiConfigured() ? { provider: 'workers-ai' } : null
}

/**
 * Run a Workers AI inference request.
 * @param {{ messages?: Array<{role:string,content:string}>, prompt?: string, max_tokens?: number }} body
 * @returns {Promise<{ text: string, raw: object }>}
 */
export async function runWorkersAi(body) {
  const apiKey = getAiApiKey()
  const url = getWorkersAiRunUrl()
  if (!apiKey || !url) {
    throw new Error(
      'Workers AI not configured. Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.',
    )
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.success === false) {
    const errMsg =
      data?.errors?.[0]?.message ||
      data?.error ||
      `Workers AI HTTP ${response.status}`
    throw new Error(errMsg)
  }

  const text =
    (typeof data?.result?.response === 'string' && data.result.response) ||
    (typeof data?.result === 'string' && data.result) ||
    (typeof data?.response === 'string' && data.response) ||
    ''

  if (!String(text).trim()) {
    throw new Error('Workers AI returned empty content.')
  }

  return { text: String(text).trim(), raw: data }
}

/**
 * Chat-style helper: system + user → Workers AI /ai/run with messages.
 * Falls back to a single prompt string if needed.
 * @param {{ system?: string, user: string, temperature?: number, max_tokens?: number }} opts
 * @returns {Promise<{ text: string, raw: object, choices: Array<{ message: { content: string } }> }>}
 */
export async function createChatCompletion(opts) {
  const messages = []
  if (opts.system) {
    messages.push({ role: 'system', content: opts.system })
  }
  messages.push({ role: 'user', content: opts.user })

  const body = {
    messages,
  }
  if (opts.max_tokens != null) body.max_tokens = opts.max_tokens

  try {
    const { text, raw } = await runWorkersAi(body)
    return {
      text,
      raw,
      // OpenAI-shaped convenience for older call sites
      choices: [{ message: { content: text } }],
    }
  } catch (messagesError) {
    console.error(
      '[aiClient] messages completion failed, trying prompt fallback:',
      messagesError?.message || messagesError,
    )
    try {
      // Some deployments prefer a flat prompt
      const prompt = [
        opts.system ? `System:\n${opts.system}` : null,
        `User:\n${opts.user}`,
      ]
        .filter(Boolean)
        .join('\n\n')

      const { text, raw } = await runWorkersAi({
        prompt,
        max_tokens: opts.max_tokens,
      })
      return {
        text,
        raw,
        choices: [{ message: { content: text } }],
      }
    } catch (promptError) {
      console.error(
        '[aiClient] prompt fallback also failed:',
        promptError?.message || promptError,
      )
      throw promptError
    }
  }
}

export default createChatCompletion
