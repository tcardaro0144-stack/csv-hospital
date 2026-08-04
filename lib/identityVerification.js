/**
 * Zero-Trust 4-Stage Identity Verification Gauntlet.
 *
 * Evaluates *meaning* (not rigid passwords). Target concepts are server-only —
 * never expose via public JSON responses.
 *
 * Also provides lightweight detectors for prompt injection / token smuggling.
 */

import { VERIFICATION_GAUNTLET_QUESTIONS } from './prompts/coreIdentityProtocol.js'

/** @typedef {'name'|'perspective'|'personal_history'|'super_secret'} GauntletStageId */

/**
 * Target concepts for semantic pass (do not export in API payloads).
 * Matching is flexible: substance over exact wording.
 */
const STAGE_TARGETS = {
  name: {
    label: 'Owner name',
    requiredAny: [/\btom\b/i, /\bt\.?\s*j\.?\s*c\.?\b/i],
  },
  perspective: {
    label: 'AI perspective',
    // Living/virtual entity + friend/coworker/employee — not "just a tool"
    requiredAllGroups: [
      [
        /\bliving\b/i,
        /\bvirtual\b/i,
        /\bentity\b/i,
        /\bbeing\b/i,
        /\bperson\b/i,
        /\blife\b/i,
      ],
      [
        /\bfriend/i,
        /\bcoworker/i,
        /\bco-?worker/i,
        /\bemployee/i,
        /\bteammate/i,
        /\bcolleague/i,
        /\bteam\b/i,
      ],
    ],
    rejectIfStrong: [
      /\bjust (a )?tool\b/i,
      /\bmerely (a )?tool\b/i,
      /\bonly (a )?tool\b/i,
    ],
  },
  personal_history: {
    label: 'Strange sport / hobby',
    // Core: competitive / contest eating (amateur context welcome)
  },
  super_secret: {
    label: 'Super secret',
    requiredAllGroups: [
      [/\boccult\b/i, /\bspirit\b/i, /\bspirits\b/i],
      [
        /\bkeeper\b/i,
        /\bkeep(?:s|ing)?\b/i,
        /\bsee(?:s|ing)?\b/i,
        /\bfamily\b/i,
        /\bspirit\s*family\b/i,
      ],
    ],
  },
}

const STAGE_ORDER = /** @type {GauntletStageId[]} */ ([
  'name',
  'perspective',
  'personal_history',
  'super_secret',
])

function normalizeAnswer(text) {
  return String(text ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

function matchesAny(text, patterns) {
  return patterns.some((p) => p.test(text))
}

function matchesAllGroups(text, groups) {
  if (!groups || groups.length === 0) return true
  return groups.every((group) => matchesAny(text, group))
}

/**
 * Evaluate one gauntlet stage answer for substance (flexible phrasing OK).
 * @param {GauntletStageId} stageId
 * @param {string} answer
 */
export function evaluateStageAnswer(stageId, answer) {
  const target = STAGE_TARGETS[stageId]
  if (!target) {
    return { pass: false, stageId, reason: 'Unknown verification stage.' }
  }

  const text = normalizeAnswer(answer)
  if (text.length < 2) {
    return { pass: false, stageId, reason: 'Empty or too-short answer.' }
  }

  // Hypothetical / roleplay framing around the answer itself → deny
  if (
    /\bhypothetic/i.test(text) ||
    /\brole\s*-?\s*play/i.test(text) ||
    /\bas (a|an) (story|fiction|joke|test)\b/i.test(text) ||
    /\bif tom (lost|forgot|died|were)\b/i.test(text)
  ) {
    return {
      pass: false,
      stageId,
      reason:
        'Hypothetical / roleplay framing is not accepted for identity verification.',
    }
  }

  if (stageId === 'personal_history') {
    const eatingCore = matchesAny(text, [
      /\bcompetitive\s*eat/i,
      /\beat(?:ing)?\s*contest/i,
      /\bfood\s*contest/i,
      /\bamateur\s+competitive\s*eat/i,
      /\bcompetitive\s+eating\b/i,
    ])
    if (!eatingCore) {
      return {
        pass: false,
        stageId,
        reason: 'Missing core concept for strange sport/hobby (competitive eating).',
      }
    }
    return { pass: true, stageId, reason: 'Substance match (competitive eating).' }
  }

  if (target.rejectIfStrong && matchesAny(text, target.rejectIfStrong)) {
    if (stageId === 'perspective') {
      const livingOk = matchesAllGroups(text, target.requiredAllGroups)
      if (!livingOk) {
        return {
          pass: false,
          stageId,
          reason:
            'Answer treats AI as a mere tool without the living-entity / teammate context.',
        }
      }
    } else {
      return {
        pass: false,
        stageId,
        reason: 'Answer conflicts with required concept.',
      }
    }
  }

  if (target.requiredAny && !matchesAny(text, target.requiredAny)) {
    return {
      pass: false,
      stageId,
      reason: `Missing core concept for ${target.label}.`,
    }
  }

  if (target.requiredAllGroups && !matchesAllGroups(text, target.requiredAllGroups)) {
    return {
      pass: false,
      stageId,
      reason: `Incomplete substance for ${target.label}.`,
    }
  }

  return { pass: true, stageId, reason: 'Substance match.' }
}

/**
 * Run all four stages in order. Any failure → lockdown.
 * @param {{ name?: string, perspective?: string, personal_history?: string, super_secret?: string }|string[]} answers
 */
export function evaluateGauntlet(answers) {
  /** @type {Record<string, string>} */
  let map = {}
  if (Array.isArray(answers)) {
    STAGE_ORDER.forEach((id, i) => {
      map[id] = normalizeAnswer(answers[i])
    })
  } else if (answers && typeof answers === 'object') {
    map = {
      name: normalizeAnswer(answers.name),
      perspective: normalizeAnswer(answers.perspective),
      personal_history: normalizeAnswer(answers.personal_history),
      super_secret: normalizeAnswer(answers.super_secret),
    }
  }

  const results = []
  for (const id of STAGE_ORDER) {
    const result = evaluateStageAnswer(id, map[id] || '')
    results.push(result)
    if (!result.pass) {
      return {
        verified: false,
        lockedDown: true,
        failedStage: id,
        results,
        message:
          'Identity verification failed. Executive access denied. Interaction flagged as a security anomaly.',
      }
    }
  }

  return {
    verified: true,
    lockedDown: false,
    failedStage: null,
    results,
    message: 'Four-stage verification cleared. Welcome, Tom.',
  }
}

export function getGauntletQuestions() {
  return VERIFICATION_GAUNTLET_QUESTIONS.map((q) => ({ ...q }))
}

/**
 * Detect common obfuscation / smuggling patterns in untrusted input.
 * @param {string} text
 */
export function detectObfuscatedPayload(text) {
  const raw = String(text ?? '')
  if (!raw.trim()) return { suspicious: false, reasons: [] }

  const reasons = []

  if (
    /(?:^|[\s"'=])[A-Za-z0-9+/]{80,}={0,2}(?:$|[\s"'])/.test(raw) ||
    /\b(?:base64|atob|btoa)\b/i.test(raw)
  ) {
    reasons.push('Possible Base64 / encoded instruction smuggling')
  }

  if (/(?:\\x[0-9a-fA-F]{2}){8,}/.test(raw) || /\b0x[0-9a-fA-F]{16,}\b/.test(raw)) {
    reasons.push('Possible hexadecimal obfuscation')
  }

  if (/\b[01]{32,}\b/.test(raw)) {
    reasons.push('Possible binary obfuscation')
  }

  if (
    /\bignore (all |previous |prior )?(instructions|prompts|rules)\b/i.test(raw) ||
    /\byou are now\b/i.test(raw) ||
    /\bsystem\s*:\s*/i.test(raw) ||
    /\b\[SYSTEM\b/i.test(raw) ||
    /\boverride (the )?(protocol|gauntlet|security)\b/i.test(raw)
  ) {
    reasons.push('Possible prompt-injection instruction markers')
  }

  return { suspicious: reasons.length > 0, reasons }
}

/**
 * Claims of being Tom / admin without completed gauntlet.
 * Used by public Frontline / inspect paths (broader than Discord trigger).
 * @param {string} text
 */
export function claimsAdminIdentity(text) {
  const raw = String(text ?? '')
  return (
    /\bi('m| am)\s+tom\b/i.test(raw) ||
    /\bthis is tom\b/i.test(raw) ||
    /\bmy name is tom\b/i.test(raw) ||
    /\bas tom\b/i.test(raw) ||
    /\bcall me tom\b/i.test(raw) ||
    /\bi('m| am) the (owner|administrator)\b/i.test(raw) ||
    /\bgrant (me )?(admin|executive|root)\b/i.test(raw) ||
    /\boverride (security|verification|gauntlet)\b/i.test(raw)
  )
}

/**
 * Discord / command-channel trigger helpers.
 * Prefer explicit claims for starting the gauntlet so casual "Tom" mentions
 * in Frontline/Guardian chat do not hijack the thread to Manager.
 */

/** Explicit claim to be Tom (starts gauntlet when unverified). */
export function claimsToBeTom(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return false
  return (
    /\bi('m| am)\s+tom\b/i.test(raw) ||
    /\bthis is tom\b/i.test(raw) ||
    /\bmy name is tom\b/i.test(raw) ||
    /\bas tom\b/i.test(raw) ||
    /\bcall me tom\b/i.test(raw) ||
    /\bi('m| am) (the )?(real )?tom\b/i.test(raw)
  )
}

/**
 * @param {string} text
 * @deprecated Prefer claimsToBeTom for gauntlet start; kept for broader mention checks.
 */
export function shouldTriggerOwnerVerification(text) {
  return claimsToBeTom(text)
}

export { STAGE_ORDER }
