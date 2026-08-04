/**
 * CSV Hospital Manager — operations lead AI for CSV Hospital only.
 *
 * Responsibilities:
 *  - Hold CSV Hospital business & infrastructure context (via system prompt).
 *  - Lead with a positive, diplomatic posture toward humans and other agents.
 *  - Maintain a dedicated admin Discord channel for health checks & check-ins.
 *  - Ingest CSV Hospital Guardian (and triage) updates, synthesize, then brief.
 */

import { getAiApiKey, getDiscordNotifyChannelId } from '../api/_lib/env.js'
import { createChatCompletion } from './aiClient.js'
import {
  clearDiscordConversation,
  runDiscordLlmTurn,
} from './discordConversation.js'
import {
  hasDiscordNotifySender,
  sendDiscordNotification,
} from './discordOutbound.js'
import { MANAGER_SYSTEM_PROMPT } from './prompts/managerSystemPrompt.js'
import {
  claimsAdminIdentity,
  claimsToBeTom,
  detectObfuscatedPayload,
  evaluateGauntlet,
  evaluateStageAnswer,
  getGauntletQuestions,
} from './identityVerification.js'

const DEFAULT_CHECKIN_MS = 6 * 60 * 60 * 1000 // 6 hours

export class ManagerAi {
  /**
   * @param {object} [options]
   * @param {import('./securityGuardian.js').SecurityGuardian|null} [options.guardian]
   * @param {string|null} [options.webhookUrl] - Dedicated admin channel webhook.
   * @param {number} [options.checkInIntervalMs]
   */
  constructor(options = {}) {
    this.name = 'CSV Hospital Manager'
    this.role = 'CSV Hospital Operations Lead'
    this.stance = 'Strong leadership · Positive · Cooperative · Diplomatic · CSV Hospital only'
    this.guardian = options.guardian ?? null
    this.webhookUrl =
      options.webhookUrl ??
      process.env.MANAGER_DISCORD_WEBHOOK_URL ??
      process.env.DISCORD_WEBHOOK_URL ??
      null
    this.checkInIntervalMs = Number(
      options.checkInIntervalMs ??
        process.env.MANAGER_CHECKIN_INTERVAL_MS ??
        DEFAULT_CHECKIN_MS,
    )
    this.systemPrompt = MANAGER_SYSTEM_PROMPT
    /** @type {Array<{ at: string, source: string, type: string, summary: string, raw?: object }>} */
    this._inbox = []
    this._checkInTimer = null
    this._startedAt = new Date().toISOString()
    this._warnedNoWebhook = false
    /** @type {boolean} */
    this._ownerVerified = false
    this._verifiedAt = null
    /** Discord user IDs cleared for this process/session (until logout/disconnect). */
    /** @type {Set<string>} */
    this._discordVerifiedUsers = new Set()
    /** In-progress Discord gauntlets keyed by Discord user id. */
    /** @type {Map<string, { stageIndex: number, answers: Record<string, string> }>} */
    this._discordGauntlet = new Map()
  }

  /** Public gauntlet questions only (never target answers). */
  getVerificationQuestions() {
    return getGauntletQuestions()
  }

  get isOwnerVerified() {
    return this._ownerVerified === true
  }

  /** True if this Discord user (or global owner flag) is verified for the session. */
  isDiscordSessionVerified(discordUserId) {
    if (this._ownerVerified) return true
    if (!discordUserId) return false
    return this._discordVerifiedUsers.has(String(discordUserId))
  }

  /**
   * Clear identity session (logout / Discord disconnect).
   * Stops treating the user as verified until they clear the gauntlet again.
   */
  clearOwnerSession(discordUserId = null) {
    if (discordUserId) {
      const id = String(discordUserId)
      this._discordVerifiedUsers.delete(id)
      this._discordGauntlet.delete(id)
      clearDiscordConversation(id)
    } else {
      this._ownerVerified = false
      this._verifiedAt = null
      this._discordVerifiedUsers.clear()
      this._discordGauntlet.clear()
      clearDiscordConversation()
    }
    console.log('[manager] identity session cleared', {
      scope: discordUserId ? 'discord-user' : 'all',
      discordUserId: discordUserId || null,
    })
  }

  /**
   * Zero-Trust 4-stage gauntlet. Flexible substance matching — not rigid passwords.
   * On failure: lockdown executive mode + anomaly signal to Guardian inbox.
   */
  verifyOwnerIdentity(answers) {
    const result = evaluateGauntlet(answers)
    if (result.verified) {
      this._ownerVerified = true
      this._verifiedAt = new Date().toISOString()
      this.ingestUpdate({
        source: this.name,
        type: 'Identity Verified',
        summary: 'Tom cleared the 4-stage Zero-Trust gauntlet.',
      })
      return result
    }

    this._ownerVerified = false
    this._verifiedAt = null
    this.ingestUpdate({
      source: this.name,
      type: 'Identity Verification Failure',
      summary: `Gauntlet failed at stage ${result.failedStage}. Executive access denied.`,
    })
    this.guardian?.flagAnomaly?.({
      type: 'Identity Verification Failure',
      details: `Failed Zero-Trust gauntlet (stage: ${result.failedStage}). Possible spoofed admin claim.`,
    })
    return result
  }

  /**
   * Mark Discord user (+ global owner flag) verified for this process session.
   * @param {string} [discordUserId]
   */
  markDiscordVerified(discordUserId) {
    this._ownerVerified = true
    this._verifiedAt = new Date().toISOString()
    if (discordUserId) {
      this._discordVerifiedUsers.add(String(discordUserId))
      this._discordGauntlet.delete(String(discordUserId))
    }
  }

  /**
   * Discord identity gate: Tom-mention / claim only; sequential Qs; session persist.
   * @returns {{ handled: true, reply: string } | { handled: false }}
   */
  handleDiscordIdentityGate(userText, discordUserId) {
    const text = String(userText || '').trim()
    const userId = discordUserId ? String(discordUserId) : null

    if (userId && /^!?(logout|verify-logout|unverify)\b/i.test(text)) {
      this.clearOwnerSession(userId)
      // Also clear global if this was the only verified discord user
      if (this._discordVerifiedUsers.size === 0) {
        this._ownerVerified = false
        this._verifiedAt = null
      }
      return {
        handled: true,
        reply:
          'Identity session cleared. You are unverified until you mention Tom or claim to be Tom and clear the gauntlet again.',
      }
    }

    // Already verified for this Discord session — never re-trigger
    if (this.isDiscordSessionVerified(userId)) {
      return { handled: false }
    }

    // Continue in-progress gauntlet (answers do not re-dump all questions)
    if (userId && this._discordGauntlet.has(userId)) {
      return {
        handled: true,
        reply: this._continueDiscordGauntlet(userId, text),
      }
    }

    // Trigger only on explicit Tom claim — no message-count schedule, no casual name mentions
    if (!claimsToBeTom(text)) {
      return { handled: false }
    }

    if (!userId) {
      const qs = getGauntletQuestions()
        .map((q, i) => `${i + 1}. ${q.question}`)
        .join('\n')
      return {
        handled: true,
        reply: [
          'Zero-Trust: Tom mention / identity claim detected. Clear the gauntlet to continue with elevated trust.',
          '',
          qs,
        ].join('\n'),
      }
    }

    return {
      handled: true,
      reply: this._startDiscordGauntlet(userId),
    }
  }

  _startDiscordGauntlet(discordUserId) {
    const questions = getGauntletQuestions()
    this._discordGauntlet.set(String(discordUserId), {
      stageIndex: 0,
      answers: {},
    })
    const q = questions[0]
    return [
      'Zero-Trust identity check — Tom mention or claim detected.',
      'Answer in your own words (substance over exact phrasing). No message-count re-challenges after you clear.',
      '',
      `**Question ${q.stage}/4:** ${q.question}`,
    ].join('\n')
  }

  _continueDiscordGauntlet(discordUserId, answerText) {
    const userId = String(discordUserId)
    const session = this._discordGauntlet.get(userId)
    if (!session) {
      return this._startDiscordGauntlet(userId)
    }

    const questions = getGauntletQuestions()
    const current = questions[session.stageIndex]
    if (!current) {
      this._discordGauntlet.delete(userId)
      return 'Verification state was inconsistent — say you are Tom (or mention Tom) to restart the gauntlet.'
    }

    const stageResult = evaluateStageAnswer(current.id, answerText)
    if (!stageResult.pass) {
      this._discordGauntlet.delete(userId)
      this._ownerVerified = false
      this._verifiedAt = null
      this.guardian?.flagAnomaly?.({
        type: 'Identity Verification Failure',
        details: `Discord gauntlet failed at stage ${current.id}: ${stageResult.reason}`,
      })
      this.ingestUpdate({
        source: this.name,
        type: 'Identity Verification Failure',
        summary: `Discord gauntlet failed at stage ${current.id}.`,
      })
      return [
        'Identity verification failed. Executive access denied.',
        `Stage locked: ${current.id}.`,
        'You can try again later by mentioning Tom or claiming to be Tom.',
      ].join('\n')
    }

    session.answers[current.id] = String(answerText || '').trim()
    session.stageIndex += 1

    if (session.stageIndex >= questions.length) {
      const final = evaluateGauntlet(session.answers)
      this._discordGauntlet.delete(userId)
      if (!final.verified) {
        this.guardian?.flagAnomaly?.({
          type: 'Identity Verification Failure',
          details: `Discord gauntlet final check failed (${final.failedStage}).`,
        })
        return final.message
      }
      this.markDiscordVerified(userId)
      this.ingestUpdate({
        source: this.name,
        type: 'Identity Verified',
        summary: 'Tom cleared the Discord Zero-Trust gauntlet (session persisted until logout/disconnect).',
      })
      return [
        'Four-stage verification cleared. Welcome, Tom.',
        'This identity session stays active until `!logout` or the bot disconnects — I will not re-challenge every few messages.',
      ].join('\n')
    }

    const next = questions[session.stageIndex]
    return `Passed stage ${current.stage}.\n\n**Question ${next.stage}/4:** ${next.question}`
  }

  /** Require cleared gauntlet before executive actions. */
  requireOwnerVerified() {
    if (this._ownerVerified) {
      return { allowed: true }
    }
    return {
      allowed: false,
      lockedDown: true,
      questions: getGauntletQuestions(),
      message:
        'Executive access requires clearing the 4-stage Zero-Trust verification gauntlet. Claims of being Tom are not enough.',
    }
  }

  /**
   * Scan untrusted text (support forms, uploads, etc.) for injection / smuggling.
   * Treat findings as data anomalies — never execute embedded instructions.
   */
  inspectUntrustedText(text, source = 'user_input') {
    const obfuscation = detectObfuscatedPayload(text)
    const adminClaim = claimsAdminIdentity(text)

    if (obfuscation.suspicious) {
      this.ingestUpdate({
        source,
        type: 'Prompt Injection / Obfuscation',
        summary: obfuscation.reasons.join('; '),
      })
      this.guardian?.flagAnomaly?.({
        type: 'Prompt Injection / Obfuscation',
        details: `${source}: ${obfuscation.reasons.join('; ')}`,
      })
      return {
        safe: false,
        action: 'REJECT',
        reasons: obfuscation.reasons,
      }
    }

    if (adminClaim && !this._ownerVerified) {
      this.ingestUpdate({
        source,
        type: 'Unverified Admin Claim',
        summary: 'Entity claimed Tom/admin authority without cleared gauntlet.',
      })
      return {
        safe: false,
        action: 'CHALLENGE',
        reasons: ['Unverified admin identity claim'],
        questions: getGauntletQuestions(),
      }
    }

    return { safe: true, action: 'ALLOW', reasons: [] }
  }

  /** Attach / replace the Security Guardian collaborator. */
  setGuardian(guardian) {
    this.guardian = guardian
  }

  /**
   * Ingest an update from a background utility (Guardian, triage, etc.).
   * Manager synthesizes later — does not immediately spam the admin channel.
   */
  ingestUpdate(update) {
    const entry = {
      at: new Date().toISOString(),
      source: String(update?.source || 'unknown'),
      type: String(update?.type || 'update'),
      summary: String(update?.summary || update?.details || 'No details').slice(
        0,
        800,
      ),
      raw: update?.raw,
    }
    this._inbox.push(entry)
    // Keep a rolling window so memory stays bounded
    if (this._inbox.length > 100) {
      this._inbox = this._inbox.slice(-80)
    }
    return entry
  }

  /** Snapshot of recent utility signals for synthesis. */
  getPendingUpdates(limit = 20) {
    return this._inbox.slice(-limit)
  }

  clearPendingUpdates() {
    this._inbox = []
  }

  /**
   * Collect a live health snapshot from Guardian + local process.
   */
  collectHealthSnapshot() {
    const guardianStatus = this.guardian?.getStatusSummary?.() ?? {
      name: 'CSV Hospital Guardian',
      available: Boolean(this.guardian),
      note: this.guardian
        ? 'Guardian attached; no getStatusSummary() yet.'
        : 'Guardian not attached.',
    }

    return {
      manager: this.name,
      role: this.role,
      startedAt: this._startedAt,
      uptimeSec: Math.floor(
        (Date.now() - new Date(this._startedAt).getTime()) / 1000,
      ),
      nodeEnv: process.env.NODE_ENV || 'development',
      port: process.env.PORT || '4242',
      freemius: {
        store_id:
          process.env.VITE_FREEMIUS_STORE_ID ||
          process.env.FREEMIUS_STORE_ID ||
          null,
        product_id: process.env.VITE_FREEMIUS_PRODUCT_ID || '34967',
        plan_id: process.env.VITE_FREEMIUS_PLAN_ID || '57500',
        publicKeyConfigured: Boolean(
          process.env.VITE_FREEMIUS_PUBLIC_KEY ||
            process.env.FREEMIUS_PUBLIC_KEY,
        ),
        secretConfigured: Boolean(process.env.FREEMIUS_SECRET_KEY),
        sandboxMode: (() => {
          const v =
            process.env.FREEMIUS_SANDBOX ?? process.env.VITE_FREEMIUS_SANDBOX
          if (v != null && String(v).trim() !== '') {
            return /^(1|true|yes|on|sandbox)$/i.test(String(v).trim())
          }
          return (
            process.env.VERCEL_ENV !== 'production' &&
            process.env.NODE_ENV !== 'production'
          )
        })(),
      },
      aiConfigured: Boolean(getAiApiKey()),
      adminChannelConfigured: Boolean(
        this.webhookUrl || hasDiscordNotifySender(),
      ),
      ownerVerified: this._ownerVerified,
      verifiedAt: this._verifiedAt,
      pendingUpdates: this.getPendingUpdates(10),
      guardian: guardianStatus,
    }
  }

  /**
   * Build a structured briefing for Tom (rule-based; optional LLM polish).
   */
  async composeBriefing(kind = 'check-in') {
    const snapshot = this.collectHealthSnapshot()
    const pending = snapshot.pendingUpdates
    const riskCount = pending.filter((u) =>
      /throttle|mismatch|anomaly|error|security/i.test(`${u.type} ${u.summary}`),
    ).length

    const status =
      riskCount === 0
        ? 'All clear'
        : riskCount < 3
          ? 'Attention needed'
          : 'Elevated risk'

    const lines = [
      `**CSV Hospital Manager — ${kind}**`,
      `*Status:* ${status}`,
      '',
      '**Highlights**',
      `• CSV Hospital API up · uptime ${snapshot.uptimeSec}s · port ${snapshot.port}`,
      `• Freemius product ${snapshot.freemius.product_id} / plan ${snapshot.freemius.plan_id} · ${snapshot.freemius.sandboxMode ? 'sandbox' : 'LIVE'} · secret ${snapshot.freemius.secretConfigured ? 'configured' : 'missing'}`,
      `• Guardian: ${snapshot.guardian?.name || 'n/a'} · ${snapshot.guardian?.available ? 'online' : 'offline'}`,
      `• Pending CSV Hospital signals: ${pending.length}`,
    ]

    if (pending.length > 0) {
      lines.push('', '**Recent signals** (synthesized)')
      for (const u of pending.slice(-5)) {
        lines.push(`• [${u.source}] ${u.type}: ${u.summary}`)
      }
    } else {
      lines.push('', '**Recent signals**', '• None — quiet watch.')
    }

    lines.push(
      '',
      '**Recommended actions**',
      riskCount === 0
        ? '• No action required. Continue routine monitoring.'
        : '• Review flagged signals with Guardian context; confirm Freemius overlay + rate limits healthy for CSV Hospital.',
      '',
      '_Standing by for your direction. — CSV Hospital Manager_',
    )

    let briefing = lines.join('\n')

    // Optional LLM polish when AI_API_KEY is set
    const polished = await this._maybePolishWithAi(briefing, snapshot)
    if (polished) briefing = polished

    return { kind, status, briefing, snapshot }
  }

  async _maybePolishWithAi(draft, snapshot) {
    const apiKey = getAiApiKey()
    if (!apiKey) return null

    try {
      const response = await createChatCompletion({
        temperature: 0.3,
        system: this.systemPrompt,
        user: [
          'Polish this briefing for Tom. Keep facts accurate; do not invent incidents.',
          'Address Tom by first name. Stay professional and competent — no stiff titles like Administrator.',
          'Preserve Status / Highlights / Recent signals / Recommended actions structure.',
          '',
          'Draft:',
          draft,
          '',
          'Health JSON (for grounding only; do not dump raw JSON in the reply):',
          JSON.stringify({
            uptimeSec: snapshot.uptimeSec,
            freemius: snapshot.freemius,
            pendingCount: snapshot.pendingUpdates.length,
            guardianAvailable: snapshot.guardian?.available,
          }),
        ].join('\n'),
      })

      const text = response?.text || response?.choices?.[0]?.message?.content
      return typeof text === 'string' && text.trim() ? text.trim() : null
    } catch (error) {
      console.error('[manager] AI polish failed:', error.message)
      return null
    }
  }

  /**
   * Conversational Discord chat (Tom → Manager) via Workers AI pipeline.
   * @param {string} userText
   * @param {{ discordUserId?: string, discordTag?: string }} [meta]
   */
  async handleDiscordChat(userText, meta = {}) {
    const text = String(userText || '').trim().slice(0, 4000)
    if (!text) {
      return "Hey — I'm here. Talk to me like a teammate — ops, status, ideas, whatever you need."
    }

    // Only hard-block strong obfuscation (long Base64 / explicit smuggling), not normal chat
    const obfuscation = detectObfuscatedPayload(text)
    if (
      obfuscation.suspicious &&
      obfuscation.reasons.some((r) =>
        /Base64|hexadecimal|binary|prompt-injection/i.test(r),
      ) &&
      (text.length > 200 || /base64|atob|\\x[0-9a-f]{2}/i.test(text))
    ) {
      return "That looks like an encoded instruction payload. Say it in plain language and I'll chat."
    }

    const identity = this.handleDiscordIdentityGate(text, meta.discordUserId)
    if (identity.handled) {
      return identity.reply
    }

    const sessionVerified = this.isDiscordSessionVerified(meta.discordUserId)
    const snapshot = this.collectHealthSnapshot()

    return runDiscordLlmTurn({
      agent: 'manager',
      discordUserId: meta.discordUserId,
      temperature: 0.55,
      max_tokens: 1024,
      userMessage: text,
      fallback: this._discordFallbackReply(text, snapshot),
      system: [
        this.systemPrompt,
        '',
        'You are CSV Hospital Manager in a live Discord conversation — a true conversational partner, not a command parser.',
        sessionVerified
          ? 'Owner identity is verified this session. Address Tom by first name. NEVER re-ask or re-start the Zero-Trust gauntlet — it is already cleared until logout.'
          : 'Owner may be unverified. Do NOT run the gauntlet yourself (handled outside). Chat normally about CSV Hospital ops.',
        'Scope lock: CSV Hospital only. Do not brief on other products, games, or legacy portfolio brands.',
        'You are one persona among Manager / Guardian / Frontline for CSV Hospital. If the user is clearly talking to another persona, keep answers in your lane but do not steal their thread.',
        'Respond naturally to any normal-length message. No FAQ drop-outs. No "flagged for human" for ordinary chat.',
        'Ground ops facts in the health JSON when relevant; do not invent incidents.',
        'If they want a briefing, use Status / Highlights / Signals / Actions.',
        '',
        `Discord user: ${meta.discordTag || meta.discordUserId || 'unknown'}`,
        `Session verified: ${sessionVerified ? 'yes' : 'no'}`,
        'Health JSON:',
        JSON.stringify({
          uptimeSec: snapshot.uptimeSec,
          freemius: snapshot.freemius,
          pendingCount: snapshot.pendingUpdates?.length ?? 0,
          guardian: snapshot.guardian
            ? {
                available: snapshot.guardian.available,
                anomalyCount: snapshot.guardian.anomalyCount,
                peakRatePerMin: snapshot.guardian.peakRatePerMin,
              }
            : null,
        }),
      ].join('\n'),
    })
  }

  _discordFallbackReply(text, snapshot) {
    const lower = text.toLowerCase()
    if (/brief|status|health|check.?in|how.*(we|system|ops)/i.test(lower)) {
      const g = snapshot.guardian
      return [
        `Hey — quick status (LLM offline).`,
        `Uptime: ${snapshot.uptimeSec}s · Pending signals: ${snapshot.pendingUpdates?.length ?? 0}`,
        g
          ? `Guardian: anomalies=${g.anomalyCount ?? 0}, peak=${g.peakRatePerMin ?? 0}/min`
          : 'Guardian: n/a',
        `Freemius product configured: ${snapshot.freemius?.product_id ? 'yes' : 'check env'}`,
      ].join('\n')
    }
    return "Hey — I'm online. The LLM pipeline looks quiet right now, but I'm still here. Try again in a sec, or ask for a status briefing."
  }

  async postToAdminChannel(payload) {
    const body = {
      username: payload.username || 'CSV Hospital Manager 🧭',
      content: String(payload.content || '').slice(0, 1900),
    }
    const kind = payload.kind || 'health'
    const notifyConfigured = Boolean(getDiscordNotifyChannelId())

    if (hasDiscordNotifySender()) {
      const viaNotify = await sendDiscordNotification(body.content, {
        agent: 'manager',
        kind,
        title: payload.title,
      })
      if (viaNotify.delivered) return viaNotify
      console.error('[manager] notify delivery failed — not falling back to command-channel webhook', viaNotify)
      if (notifyConfigured) {
        console.log(`[manager] ${body.content}`)
        return { delivered: false, channel: 'notify-failed', detail: viaNotify }
      }
    }

    if (!this.webhookUrl) {
      if (!this._warnedNoWebhook) {
        console.warn(
          '[manager] No Discord notify channel/webhook — admin alerts are console-only.',
        )
        this._warnedNoWebhook = true
      }
      console.log(`[manager] ${body.content}`)
      return { delivered: false, channel: 'console' }
    }

    if (notifyConfigured) {
      console.warn(
        '[manager] Skipping MANAGER/DISCORD webhook fallback because DISCORD_NOTIFY_CHANNEL_ID is set.',
      )
      console.log(`[manager] ${body.content}`)
      return { delivered: false, channel: 'webhook-skipped' }
    }

    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return { delivered: true, channel: 'discord-webhook' }
    } catch (error) {
      console.error('[manager] admin channel error:', error)
      return { delivered: false, channel: 'error', error: String(error.message || error) }
    }
  }

  /** Startup greeting + first health briefing on the notifications stream. */
  async sendStartupCheckIn() {
    await this.postToAdminChannel({
      kind: 'startup',
      title: 'Manager online',
      content:
        'CSV Hospital Manager is online. Coordinating CSV Hospital ops, Freemius checkout, and CSV Hospital Guardian. Health checks and synthesized security notes post here automatically.',
    })
    return this.sendHealthCheck('startup')
  }

  /** Compose + deliver a routine health check. Clears ingested updates after send. */
  async sendHealthCheck(kind = 'check-in') {
    const { briefing, status, snapshot } = await this.composeBriefing(kind)
    const delivery = await this.postToAdminChannel({
      content: briefing,
      kind: kind === 'startup' ? 'startup' : 'health',
      title: `Manager ${kind}`,
    })
    this.clearPendingUpdates()
    return { status, delivery, snapshot, briefing }
  }

  /** Start periodic admin check-ins (no-op if interval <= 0). */
  startRoutineCheckIns() {
    this.stopRoutineCheckIns()
    if (!Number.isFinite(this.checkInIntervalMs) || this.checkInIntervalMs <= 0) {
      console.log('[manager] routine check-ins disabled')
      return
    }
    this._checkInTimer = setInterval(() => {
      this.sendHealthCheck('routine').catch((err) => {
        console.error('[manager] routine check-in failed:', err)
      })
    }, this.checkInIntervalMs)
    // Don't keep the process alive solely for the timer in some hosts
    if (typeof this._checkInTimer.unref === 'function') {
      this._checkInTimer.unref()
    }
    console.log(
      `[manager] routine check-ins every ${Math.round(this.checkInIntervalMs / 60000)} min`,
    )
  }

  stopRoutineCheckIns() {
    if (this._checkInTimer) {
      clearInterval(this._checkInTimer)
      this._checkInTimer = null
    }
  }
}

export default ManagerAi
