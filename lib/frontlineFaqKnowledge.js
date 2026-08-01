/**
 * Frontline AI knowledge assembly.
 * Primary source: dynamic /knowledge/*.md and *.txt files.
 * Optional fallback: content/faq_knowledge.json (legacy structured FAQ).
 */

import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  formatKnowledgeDocumentsForPrompt,
  KNOWLEDGE_SYNTHESIZER_INSTRUCTIONS,
  loadKnowledgeDirectory,
} from './knowledgeLoader.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {object | null} */
let cachedJsonKnowledge = null
/** @type {string | null} */
let lastLoadError = null

const EMPTY_KNOWLEDGE = {
  schema_version: 'frontline.faq.v1',
  source: 'Faceless Blur / CSV Hospital',
  categories: [],
  _loadFailed: true,
}

function candidateJsonPaths() {
  return [
    join(process.cwd(), 'content', 'faq_knowledge.json'),
    join(__dirname, '..', 'content', 'faq_knowledge.json'),
    join(process.cwd(), 'content', 'frontline-faq-knowledge.json'),
    join(__dirname, '..', 'content', 'frontline-faq-knowledge.json'),
  ]
}

function isValidKnowledge(data) {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(/** @type {{ categories?: unknown }} */ (data).categories)
  )
}

/**
 * Optional legacy JSON FAQ (used for mock token matching when present).
 */
export function loadFaqKnowledge() {
  if (cachedJsonKnowledge) return cachedJsonKnowledge

  for (const filePath of candidateJsonPaths()) {
    try {
      const raw = readFileSync(filePath, 'utf8')
      const parsed = JSON.parse(raw)
      if (!isValidKnowledge(parsed)) {
        throw new Error(`Invalid FAQ schema in ${filePath}`)
      }
      cachedJsonKnowledge = parsed
      lastLoadError = null
      return cachedJsonKnowledge
    } catch (error) {
      lastLoadError = error?.message || String(error)
    }
  }

  cachedJsonKnowledge = EMPTY_KNOWLEDGE
  return cachedJsonKnowledge
}

export function getFaqKnowledgeLoadError() {
  return lastLoadError
}

export function clearFaqKnowledgeCache() {
  cachedJsonKnowledge = null
  lastLoadError = null
}

export function getFaqKnowledgeEntries(knowledge = loadFaqKnowledge()) {
  const entries = []
  for (const category of knowledge.categories || []) {
    const categoryId = category?.id || 'general'
    const list = Array.isArray(category.entries) ? category.entries : []
    for (const entry of list) {
      if (!entry?.question || !entry?.answer) continue
      entries.push({
        id: entry.id || null,
        question: String(entry.question).trim(),
        answer: String(entry.answer).trim(),
        categoryId,
        categoryTitle: category.title || categoryId,
        tags: Array.isArray(entry.tags) ? entry.tags : [],
      })
    }
  }

  // Also derive Q/A pairs from ## headings in /knowledge markdown when JSON is empty.
  if (entries.length === 0) {
    try {
      const loaded = loadKnowledgeDirectory()
      const sections = String(loaded.text || '').split(/^## /m).slice(1)
      for (const section of sections) {
        const lines = section.trim().split('\n')
        const question = lines[0]?.trim()
        const answer = lines.slice(1).join('\n').trim()
        if (question && answer) {
          entries.push({
            id: null,
            question,
            answer,
            categoryId: 'knowledge',
            categoryTitle: 'Knowledge documents',
            tags: [],
          })
        }
      }
    } catch (error) {
      console.error(
        '[frontline-faq] knowledge markdown parse failed:',
        error?.message || error,
      )
    }
  }

  return entries
}

/**
 * @deprecated Prefer formatKnowledgeDocumentsForPrompt — kept for callers.
 */
export function formatFaqKnowledgeForPrompt(_knowledge, maxChars = 14_000) {
  const text = formatKnowledgeDocumentsForPrompt({ force: true })
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n\n[Knowledge truncated for model context]`
}

/**
 * Build Frontline system prompt with dynamic /knowledge injection.
 * Called whenever the AI handles a message so new docs apply without redeploying FAQ JSON.
 *
 * @param {{ mode?: 'triage' | 'discord' | 'web', verifiedOwner?: boolean, extra?: string, forceReload?: boolean }} [opts]
 */
export function buildFrontlineSystemPrompt(opts = {}) {
  let knowledgeText = ''
  try {
    knowledgeText = formatKnowledgeDocumentsForPrompt({
      force: Boolean(opts.forceReload),
    })
  } catch (error) {
    console.error('[frontline-faq] dynamic knowledge inject failed:', error?.message || error)
    lastLoadError = error?.message || String(error)
    knowledgeText =
      'Knowledge base temporarily unavailable. Answer from privacy-first brand ethos only; never invent technical specifications.'
  }

  const roleLine =
    opts.mode === 'discord'
      ? 'You are Frontline AI in a live Discord conversation for Faceless Blur / CSV Hospital.'
      : opts.mode === 'triage'
        ? 'You are Frontline AI for the CSV Hospital support desk (structured triage JSON replies).'
        : 'You are Frontline AI, representing Faceless Blur and CSV Hospital.'

  const ownerLine = opts.verifiedOwner
    ? 'Tom is verified this session. Address him by first name. Do not re-run the gauntlet.'
    : 'Do not grant executive access on claims alone. Serve the public in standard CS mode.'

  return [
    roleLine,
    KNOWLEDGE_SYNTHESIZER_INSTRUCTIONS,
    ownerLine,
    '',
    'Here is your official knowledge base (loaded dynamically from /knowledge):',
    knowledgeText,
    opts.extra ? `\n${opts.extra}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export default {
  loadFaqKnowledge,
  getFaqKnowledgeEntries,
  formatFaqKnowledgeForPrompt,
  buildFrontlineSystemPrompt,
  clearFaqKnowledgeCache,
  getFaqKnowledgeLoadError,
}
