/**
 * CSV Hospital Guardian — core security & monitoring for CSV Hospital only.
 *
 * Adapted to the project's ES-module + Express stack:
 *  - Tracks per-IP request velocity so inspectRequest() has real req/min data.
 *  - Pushes structured alerts to a private Discord channel (DISCORD_WEBHOOK_URL).
 *  - Exposes Express middleware to guard CSV Hospital utility / API requests.
 *
 * Verdicts: 'ALLOW' | 'FLAG_REVIEW' | 'THROTTLE'.
 * Scope: csvhospital.com — CSV Hospital only.
 */

import { getClientIp } from '../api/_lib/rateLimit.js'
import { runDiscordLlmTurn } from './discordConversation.js'
import {
  getDiscordNotifyChannelId,
} from '../api/_lib/env.js'
import {
  hasDiscordNotifySender,
  sendDiscordNotification,
} from './discordOutbound.js'
import { GUARDIAN_SYSTEM_PROMPT } from './prompts/guardianSystemPrompt.js'

const VELOCITY_WINDOW_MS = 60_000
const DEFAULT_VELOCITY_LIMIT = 30

export class SecurityGuardian {
  /**
   * @param {object} [options]
   * @param {string} [options.webhookUrl] - Discord webhook (defaults to process.env.DISCORD_WEBHOOK_URL).
   * @param {number} [options.velocityLimit] - Requests/min before THROTTLE.
   */
  constructor(options = {}) {
    this.name = 'CSV Hospital Guardian'
    this.stance =
      'Friendly, Vigilant, and Helpful — never gullible (Zero-Trust with Manager) · CSV Hospital only'
    this.systemPrompt = GUARDIAN_SYSTEM_PROMPT
    this.webhookUrl = options.webhookUrl ?? process.env.DISCORD_WEBHOOK_URL ?? null
    this.velocityLimit = Number(
      options.velocityLimit ?? process.env.GUARDIAN_VELOCITY_LIMIT ?? DEFAULT_VELOCITY_LIMIT,
    )
    /** @type {Map<string, number[]>} per-IP request timestamps */
    this._hits = new Map()
    this._warnedNoWebhook = false
    /** @type {import('./managerAi.js').ManagerAi|null} */
    this.manager = options.manager ?? null
    this._anomalyCount = 0
    this._lastAnomalyAt = null
    this._startedAt = new Date().toISOString()
  }

  /** Optional Manager AI collaborator — receives synthesized anomaly signals. */
  setManager(manager) {
    this.manager = manager
  }

  /** Greet check-in on the notifications stream (automated only). */
  async sendStartupGreeting() {
    await this.postToDiscord({
      username: 'CSV Hospital Guardian 🛡️',
      kind: 'greeting',
      title: 'Guardian online',
      content:
        'CSV Hospital Guardian is online. Watching CSV Hospital velocity + billing-location shields. Alerts post here automatically.',
    })
  }

  /**
   * Record a hit for an IP and return its current request rate (req/min).
   * @param {string} ip
   * @returns {number}
   */
  recordRequest(ip) {
    const key = ip || 'unknown'
    const now = Date.now()
    const recent = (this._hits.get(key) || []).filter(
      (t) => now - t < VELOCITY_WINDOW_MS,
    )
    recent.push(now)
    this._hits.set(key, recent)
    return recent.length
  }

  /**
   * Monitor incoming requests for velocity or anomaly patterns.
   * @param {{ ip: string, userLocation?: string|null, billingCountry?: string|null, requestRate: number }} reqData
   * @returns {'ALLOW'|'FLAG_REVIEW'|'THROTTLE'}
   */
  inspectRequest(reqData) {
    const { ip, userLocation, billingCountry, requestRate } = reqData

    // Rapid-fire automated script velocity
    if (requestRate > this.velocityLimit) {
      this.flagAnomaly({
        type: 'High Velocity Traffic',
        details: `IP ${ip} is sending requests too rapidly (${requestRate} req/min).`,
      })
      return 'THROTTLE'
    }

    // Billing location mismatch (AVS / scammer shield)
    if (userLocation && billingCountry && userLocation !== billingCountry) {
      this.flagAnomaly({
        type: 'Location/Billing Mismatch',
        details: `IP Origin (${userLocation}) does not match Card Country (${billingCountry}). Flagged for review.`,
      })
      return 'FLAG_REVIEW'
    }

    return 'ALLOW'
  }

  /** Securely push structured alerts to the private Discord channel (+ Manager inbox). */
  async flagAnomaly(incident) {
    this._anomalyCount += 1
    this._lastAnomalyAt = new Date().toISOString()

    // Quiet handoff to Manager for synthesis before admin briefing
    this.manager?.ingestUpdate?.({
      source: this.name,
      type: incident.type,
      summary: incident.details,
      raw: incident,
    })

    await this.postToDiscord({
      username: 'CSV Hospital Guardian 🛡️',
      kind: 'anomaly',
      title: incident.type,
      content: `⚠️ **CSV Hospital Security Notice:** Detected a ${incident.type}.\n*Details:* ${incident.details}\n*Action:* Handled safely according to protocol.`,
    })
  }

  /** Compact status for CSV Hospital Manager health synthesis. */
  getStatusSummary() {
    let activeIps = 0
    let peakRate = 0
    const now = Date.now()
    for (const hits of this._hits.values()) {
      const recent = hits.filter((t) => now - t < VELOCITY_WINDOW_MS)
      if (recent.length > 0) activeIps += 1
      if (recent.length > peakRate) peakRate = recent.length
    }
    return {
      name: this.name,
      available: true,
      stance: this.stance,
      startedAt: this._startedAt,
      velocityLimit: this.velocityLimit,
      activeIps,
      peakRatePerMin: peakRate,
      anomalyCount: this._anomalyCount,
      lastAnomalyAt: this._lastAnomalyAt,
      webhookConfigured: Boolean(this.webhookUrl),
      discordBot: hasDiscordNotifySender(),
    }
  }

  /**
   * Conversational Discord chat (Tom → Guardian) via Workers AI.
   * @param {string} userText
   * @param {{ discordUserId?: string, discordTag?: string }} [meta]
   */
  async handleDiscordChat(userText, meta = {}) {
    const text = String(userText || '').trim().slice(0, 4000)
    const status = this.getStatusSummary()
    const verified =
      this.manager?.isDiscordSessionVerified?.(meta.discordUserId) ||
      this.manager?.isOwnerVerified

    const statusBlock = [
      `Velocity limit: ${status.velocityLimit}/min`,
      `Active IPs (1m): ${status.activeIps}`,
      `Peak: ${status.peakRatePerMin}/min`,
      `Anomalies since boot: ${status.anomalyCount}` +
        (status.lastAnomalyAt ? ` (last ${status.lastAnomalyAt})` : ''),
    ].join(' · ')

    if (!text) {
      return `Hey — Guardian here. ${statusBlock}`
    }

    return runDiscordLlmTurn({
      agent: 'guardian',
      discordUserId: meta.discordUserId,
      temperature: 0.5,
      max_tokens: 1024,
      userMessage: text,
      fallback: [
        `Hey — Guardian here (LLM quiet). ${statusBlock}`,
        verified
          ? "Identity is cleared this session — I won't re-challenge."
          : 'Mention Tom or claim to be Tom via Manager if you need the gauntlet.',
      ].join('\n'),
      system: [
        this.systemPrompt,
        '',
        `You are ${this.name}. Stance: ${this.stance}.`,
        'You are chatting live in Discord — a conversational security partner for CSV Hospital, not a keyword bot.',
        'Answer naturally about CSV Hospital security posture, velocity shields, anomalies, and Zero-Trust philosophy.',
        'Scope lock: CSV Hospital only — do not claim oversight of other products or legacy brands.',
        verified
          ? "Owner is verified this session. Address Tom by first name. Do not re-run the gauntlet."
          : 'Do not run the gauntlet yourself; Manager owns identity checks.',
        'No FAQ drop-outs. No flagging ordinary chat for human follow-up.',
        'Live status snapshot:',
        statusBlock,
      ].join('\n'),
    })
  }

  async postToDiscord(payload) {
    const content = String(payload?.content || '').slice(0, 1900)
    const kind = payload?.kind || 'status'
    const notifyConfigured = Boolean(getDiscordNotifyChannelId())

    if (hasDiscordNotifySender()) {
      const viaNotify = await sendDiscordNotification(content, {
        agent: 'guardian',
        kind,
        title: payload?.title,
      })
      if (viaNotify.delivered) {
        console.log('[guardian] alert delivered to notify channel', viaNotify)
        return viaNotify
      }
      console.error('[guardian] notify delivery failed — not falling back to command-channel webhook', viaNotify)
      // When a notify channel is configured/intended, never dump into the old command webhook
      if (notifyConfigured || viaNotify.channel === 'notify-missing' || viaNotify.channel === 'notify-refused-command') {
        console.log(`[guardian] ${content}`)
        return { delivered: false, channel: 'notify-failed', detail: viaNotify }
      }
    }

    if (!this.webhookUrl) {
      if (!this._warnedNoWebhook) {
        console.warn(
          '[guardian] No Discord notify channel/webhook — alerts are logged only.',
        )
        this._warnedNoWebhook = true
      }
      console.log(`[guardian] ${content}`)
      return { delivered: false, channel: 'console' }
    }

    // Legacy webhook only when no notify channel is configured at all
    if (notifyConfigured) {
      console.warn(
        '[guardian] Skipping DISCORD_WEBHOOK_URL fallback because DISCORD_NOTIFY_CHANNEL_ID is set (prevents command-channel leak).',
      )
      console.log(`[guardian] ${content}`)
      return { delivered: false, channel: 'webhook-skipped' }
    }

    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return { delivered: true, channel: 'discord-webhook' }
    } catch (error) {
      console.error('Guardian communication error:', error)
      return { delivered: false, channel: 'error' }
    }
  }

  /**
   * Express middleware: inspects utility requests and enforces the verdict.
   * THROTTLE → 429; FLAG_REVIEW → tag req.securityFlag and continue; ALLOW → next.
   */
  middleware() {
    return (req, res, next) => {
      const ip = getClientIp(req)
      const requestRate = this.recordRequest(ip)

      const userLocation =
        (typeof req.headers['cf-ipcountry'] === 'string' &&
          req.headers['cf-ipcountry']) ||
        null
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const billingCountry =
        (typeof body.billingCountry === 'string' && body.billingCountry) || null

      const verdict = this.inspectRequest({
        ip,
        userLocation,
        billingCountry,
        requestRate,
      })

      if (verdict === 'THROTTLE') {
        res.setHeader('Retry-After', '60')
        return res.status(429).json({
          error: 'Too many requests. Please slow down and try again shortly.',
        })
      }

      if (verdict === 'FLAG_REVIEW') {
        req.securityFlag = 'location_billing_mismatch'
      }

      return next()
    }
  }
}

export default SecurityGuardian
