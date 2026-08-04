/**
 * Centralized env access — secrets only from process.env, never hardcoded.
 * Error messages stay generic (no key material leaked).
 *
 * Stripe is optional / legacy — Freemius is the primary checkout.
 * Test keys (sk_test_ / pk_test_) are accepted on Vercel production.
 */

import { validateClientUrl } from './validate.js'

/** Default test-mode Price ID (Dashboard → Products). Override with STRIPE_PRICE_ID. */
const DEFAULT_STRIPE_PRICE_ID = 'price_1TuUafIv6QgjmVhx1EWTE8FP'

function stripEnvQuotes(value) {
  const trimmed = String(value).trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

/**
 * Stripe secret key — accepts sk_test_ and sk_live_ on any host (incl. production).
 * Strips wrapping quotes from Vercel / .env paste mistakes.
 */
export function getStripeSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || typeof key !== 'string') return null
  const trimmed = stripEnvQuotes(key)
  // Explicitly allow test credentials in production (Freemius-first deployments).
  if (!/^sk_(test|live)_[A-Za-z0-9]+/.test(trimmed)) return null
  if (trimmed.length < 20) return null
  return trimmed
}

export function getStripePublishableKey() {
  const key =
    process.env.STRIPE_PUBLISHABLE_KEY ||
    process.env.VITE_STRIPE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!key || typeof key !== 'string') return null
  const trimmed = stripEnvQuotes(key)
  if (!/^pk_(test|live)_[A-Za-z0-9]+/.test(trimmed)) return null
  if (trimmed.length < 20) return null
  return trimmed
}

/** @returns {'test'|'live'|null} */
export function getStripeMode() {
  const secret = getStripeSecretKey()
  if (!secret) return null
  return secret.startsWith('sk_test_') ? 'test' : 'live'
}

export function isStripeConfigured() {
  return Boolean(getStripeSecretKey())
}

/**
 * One-time unlock Price ID. Prefers STRIPE_PRICE_ID; falls back to bundled test price.
 */
export function getStripePriceId() {
  const raw = process.env.STRIPE_PRICE_ID
  if (typeof raw === 'string' && raw.trim()) {
    const trimmed = stripEnvQuotes(raw)
    if (/^price_[A-Za-z0-9]+$/.test(trimmed)) return trimmed
  }
  return DEFAULT_STRIPE_PRICE_ID
}

export function getWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || typeof secret !== 'string') return null
  const trimmed = stripEnvQuotes(secret)
  if (!trimmed.startsWith('whsec_')) return null
  return trimmed
}

export function getUnlockSecret() {
  const secret = process.env.UNLOCK_SECRET
  if (!secret || typeof secret !== 'string') return null
  const trimmed = stripEnvQuotes(secret)
  if (trimmed.length < 16) return null
  if (trimmed === 'change-me-to-a-long-random-string') return null
  return trimmed
}

export function getConfiguredClientUrl() {
  const raw =
    process.env.CLIENT_URL || process.env.VITE_APP_URL || 'http://localhost:5173'
  return validateClientUrl(raw)
}

/**
 * Freemius product public key (safe to expose — also in VITE_* for the client).
 */
export function getFreemiusPublicKey() {
  const key =
    process.env.FREEMIUS_PUBLIC_KEY ||
    process.env.VITE_FREEMIUS_PUBLIC_KEY ||
    'pk_1411029c3e32680a04780cd82936a'
  if (!key || typeof key !== 'string') return null
  const trimmed = stripEnvQuotes(key)
  if (!trimmed.startsWith('pk_')) return null
  return trimmed
}

export function getFreemiusStoreId() {
  const id =
    process.env.FREEMIUS_STORE_ID || process.env.VITE_FREEMIUS_STORE_ID || ''
  const trimmed = id != null ? stripEnvQuotes(String(id)) : ''
  return trimmed || null
}

export function getFreemiusProductId() {
  const id =
    process.env.FREEMIUS_PRODUCT_ID ||
    process.env.VITE_FREEMIUS_PRODUCT_ID ||
    '36475'
  const trimmed = id != null ? stripEnvQuotes(String(id)) : ''
  return trimmed || null
}

export function getFreemiusPlanId() {
  const id =
    process.env.FREEMIUS_PLAN_ID || process.env.VITE_FREEMIUS_PLAN_ID || '60396'
  const trimmed = id != null ? stripEnvQuotes(String(id)) : ''
  return trimmed || null
}

/**
 * Freemius product secret key — server only. Used to mint sandbox { token, ctx }
 * (JS equivalent of Dashboard → Get Checkout → Overlay → Sandbox tab).
 * Same product secret is used for live checkout; sandbox mode is a separate flag.
 */
export function getFreemiusSecretKey() {
  const key = process.env.FREEMIUS_SECRET_KEY
  if (!key || typeof key !== 'string') return null
  const trimmed = stripEnvQuotes(key)
  if (!trimmed.startsWith('sk_') || trimmed.length < 20) return null
  return trimmed
}

/**
 * Freemius sandbox overlay mode.
 * Freemius does not use separate sk_test/sk_live keys — the same product keys are live.
 * Sandbox is enabled only when FREEMIUS_SANDBOX / VITE_FREEMIUS_SANDBOX is true.
 * When false/off/live, checkout charges real payments (no sandbox token/ctx).
 */
export function isFreemiusSandboxEnabled() {
  const raw =
    process.env.FREEMIUS_SANDBOX ?? process.env.VITE_FREEMIUS_SANDBOX ?? ''
  const v = stripEnvQuotes(String(raw)).toLowerCase()
  if (!v) {
    // Safe default: sandbox off only when explicitly configured for live.
    // Unset → treat as sandbox for local safety unless NODE_ENV/VERCEL is production.
    const prod =
      process.env.VERCEL_ENV === 'production' ||
      process.env.NODE_ENV === 'production'
    return !prod
  }
  if (/^(0|false|no|off|live|production)$/i.test(v)) return false
  return /^(1|true|yes|on|sandbox)$/i.test(v)
}


/**
 * Cloudflare API token for Workers AI + Wrangler.
 * Prefer CLOUDFLARE_API_TOKEN (current Wrangler name); CF_API_TOKEN is legacy alias.
 * Falls back to AI_API_KEY / OPENAI_API_KEY for legacy setups.
 */
export function getAiApiKey() {
  const key =
    process.env.CLOUDFLARE_API_TOKEN ||
    process.env.CF_API_TOKEN ||
    process.env.AI_API_KEY ||
    process.env.OPENAI_API_KEY
  if (!key || typeof key !== 'string') return null
  const trimmed = key.trim()
  if (trimmed.length < 20) return null
  return trimmed
}

/**
 * Workers AI model id for /ai/run/{model}
 * Example: @cf/meta/llama-3.1-8b-instruct
 */
export function getAiModel() {
  const model =
    process.env.AI_MODEL ||
    process.env.OPENAI_MODEL ||
    process.env.CLOUDFLARE_AI_GATEWAY_MODEL ||
    '@cf/meta/llama-3.1-8b-instruct'
  return String(model)
    .trim()
    .replace(/^workers-ai\//, '')
}

/**
 * Cloudflare account id.
 * Prefer CLOUDFLARE_ACCOUNT_ID (current Wrangler name); CF_ACCOUNT_ID is legacy alias.
 */
export function getCloudflareAccountId() {
  const id =
    process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID
  if (!id || typeof id !== 'string') return null
  const trimmed = id.trim()
  if (!trimmed || /your_cloudflare_account_id/i.test(trimmed)) return null
  return trimmed
}

/**
 * Native Workers AI run URL:
 *   https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}
 */
export function getWorkersAiRunUrl() {
  if (process.env.CF_AI_RUN_URL && String(process.env.CF_AI_RUN_URL).trim()) {
    return String(process.env.CF_AI_RUN_URL).trim().replace(/\/$/, '')
  }

  const accountId = getCloudflareAccountId()
  const model = getAiModel()
  if (!accountId || !model) return null

  const encodedModel = model
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')

  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${encodedModel}`
}

/**
 * Legacy OpenAI-compatible base URL helper (unused by native /ai/run client).
 * Kept for scripts that still expect a chat/completions base.
 */
export function getAiBaseUrl() {
  if (process.env.AI_BASE_URL && String(process.env.AI_BASE_URL).trim()) {
    return String(process.env.AI_BASE_URL).trim().replace(/\/$/, '')
  }
  const accountId = getCloudflareAccountId()
  if (accountId) {
    return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`
  }
  return null
}

/**
 * Discord bot token for two-way command channel (Gateway).
 * Accepts DISCORD_BOT_TOKEN (strips wrapping quotes).
 */
export function getDiscordBotToken() {
  const token =
    process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || null
  if (!token || typeof token !== 'string') return null
  const trimmed = stripEnvQuotes(token)
  if (trimmed.length < 20 || /\.\.\.|your_?token|changeme/i.test(trimmed)) {
    return null
  }
  // Reject accidental webhook URLs pasted into the token field
  if (/^https?:\/\//i.test(trimmed) || /discord\.com\/api\/webhooks/i.test(trimmed)) {
    console.warn(
      '[env] DISCORD_BOT_TOKEN looks like a webhook URL — use the Bot token from the Developer Portal instead.',
    )
    return null
  }
  return trimmed
}

/**
 * Discord snowflake for the private command channel (Manager / Guardian / Frontline).
 */
export function getDiscordCommandChannelId() {
  const id =
    process.env.DISCORD_COMMAND_CHANNEL_ID ||
    process.env.DISCORD_CHANNEL_ID
  if (!id || typeof id !== 'string') return null
  const trimmed = stripEnvQuotes(id)
  if (!/^\d{16,22}$/.test(trimmed)) {
    if (trimmed) {
      console.warn(
        '[env] DISCORD_COMMAND_CHANNEL_ID must be a numeric snowflake (16–22 digits). Got length=' +
          trimmed.length,
      )
    }
    return null
  }
  return trimmed
}

/**
 * Optional Discord user snowflake for Tom — when set, only this user can command the bots.
 */
export function getDiscordOwnerUserId() {
  const id = process.env.DISCORD_OWNER_USER_ID
  if (!id || typeof id !== 'string') return null
  const trimmed = stripEnvQuotes(id)
  if (!/^\d{16,22}$/.test(trimmed)) return null
  return trimmed
}

/**
 * Discord snowflake for the agent notifications channel (alerts / health / status only).
 * No chat, no gauntlet — automated outbound stream.
 */
export function getDiscordNotifyChannelId() {
  const id =
    process.env.DISCORD_NOTIFY_CHANNEL_ID ||
    process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID ||
    process.env.DISCORD_ALERTS_CHANNEL_ID
  if (!id || typeof id !== 'string') return null
  const trimmed = stripEnvQuotes(id)
  if (!/^\d{16,22}$/.test(trimmed)) {
    if (trimmed) {
      console.warn(
        '[env] DISCORD_NOTIFY_CHANNEL_ID must be a numeric snowflake (16–22 digits). Got length=' +
          trimmed.length,
      )
    }
    return null
  }
  return trimmed
}

/**
 * Discord snowflake for Frontline CS logs (#frontline-cs-logs).
 * Transcripts, triage notes, escalations — isolated from command + agent-notifications.
 */
export function getDiscordFrontlineLogsChannelId() {
  const id =
    process.env.DISCORD_FRONTLINE_LOGS_CHANNEL_ID ||
    process.env.DISCORD_CS_LOGS_CHANNEL_ID
  if (!id || typeof id !== 'string') return null
  const trimmed = stripEnvQuotes(id)
  if (!/^\d{16,22}$/.test(trimmed)) {
    if (trimmed) {
      console.warn(
        '[env] DISCORD_FRONTLINE_LOGS_CHANNEL_ID must be a numeric snowflake (16–22 digits). Got length=' +
          trimmed.length,
      )
    }
    return null
  }
  return trimmed
}


const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Resend API key from RESEND_API_KEY in .env / host env.
 */
export function getResendApiKey() {
  const key = process.env.RESEND_API_KEY
  if (!key || typeof key !== 'string') return null
  const trimmed = stripEnvQuotes(key)
  if (!trimmed.startsWith('re_')) return null
  if (trimmed.length < 20 || /\.\.\.|your_?key|changeme|xxx/i.test(trimmed)) {
    return null
  }
  return trimmed
}

/**
 * Support inbox that receives needs_human escalations.
 */
export function getSupportEmail() {
  const email = process.env.SUPPORT_EMAIL
  if (!email || typeof email !== 'string') return null
  const trimmed = stripEnvQuotes(email).toLowerCase()
  if (!EMAIL_RE.test(trimmed) || trimmed.endsWith('@example.com')) return null
  return trimmed
}

/**
 * Make.com scenario webhook for CSV Hospital data triggers (outbound).
 * Accepts hook.make.com / hook.usN.make.com URLs from MAKE_WEBHOOK_URL
 * (aliases: CSV_HOSPITAL_WEBHOOK_URL, MAKE_COM_WEBHOOK_URL).
 */
export function getMakeWebhookUrl() {
  const raw =
    process.env.MAKE_WEBHOOK_URL ||
    process.env.CSV_HOSPITAL_WEBHOOK_URL ||
    process.env.MAKE_COM_WEBHOOK_URL
  if (!raw || typeof raw !== 'string') return null
  const trimmed = stripEnvQuotes(raw)
  if (!trimmed || /\.\.\.|your_?webhook|changeme|xxx/i.test(trimmed)) return null

  let parsed
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }

  if (parsed.protocol !== 'https:') return null
  // Make custom webhooks: https://hook.make.com/... or https://hook.us2.make.com/...
  if (!/^hook(\.[a-z0-9-]+)?\.make\.com$/i.test(parsed.hostname)) {
    console.warn(
      '[env] MAKE_WEBHOOK_URL host must be hook.make.com or hook.*.make.com',
    )
    return null
  }
  if (parsed.pathname.length < 8) return null
  return parsed.toString()
}

/**
 * Verified sender for Resend. Accepts plain email or `Name <email@domain>`.
 */
export function getSupportFromEmail() {
  const raw = process.env.SUPPORT_FROM_EMAIL || process.env.RESEND_FROM_EMAIL
  if (!raw || typeof raw !== 'string') return null
  const trimmed = stripEnvQuotes(raw)
  if (!trimmed) return null

  const angled = trimmed.match(/^(.+?)\s*<([^>]+)>$/)
  if (angled) {
    const address = angled[2].trim()
    if (!EMAIL_RE.test(address)) return null
    return `${angled[1].trim()} <${address}>`
  }

  if (!EMAIL_RE.test(trimmed)) return null
  return trimmed
}
