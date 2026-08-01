import { FAQ_MARKDOWN } from './faqContent.js'
import { getFaqKnowledgeEntries, loadFaqKnowledge } from './frontlineFaqKnowledge.js'

let cachedFaq = null

/**
 * Load FAQ markdown (cached in-process).
 * Uses bundled FAQ_MARKDOWN so Cloudflare Pages Functions work without disk.
 * When Node `fs` is available, prefer `content/support-faq.md` if present.
 */
export function loadFaqText() {
  if (cachedFaq != null) return cachedFaq

  try {
    const fs = globalThis.process?.getBuiltinModule?.('fs')
    const path = globalThis.process?.getBuiltinModule?.('path')
    const url = globalThis.process?.getBuiltinModule?.('url')
    if (fs?.readFileSync && path?.join && url?.fileURLToPath) {
      const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
      const candidates = [
        path.join(process.cwd(), 'content', 'support-faq.md'),
        path.join(__dirname, '..', 'content', 'support-faq.md'),
      ]
      for (const filePath of candidates) {
        try {
          cachedFaq = fs.readFileSync(filePath, 'utf8')
          return cachedFaq
        } catch {
          // try next
        }
      }
    }
  } catch {
    // fall through to bundled FAQ
  }

  cachedFaq = FAQ_MARKDOWN
  return cachedFaq
}

/**
 * Parse FAQ into { question, answer } pairs.
 * Prefers structured content/faq_knowledge.json, then markdown headings.
 */
export function parseFaqEntries(faqText = loadFaqText()) {
  try {
    loadFaqKnowledge()
    const structured = getFaqKnowledgeEntries()
    if (structured.length > 0) {
      return structured.map((e) => ({
        question: e.question,
        answer: e.answer,
      }))
    }
  } catch (error) {
    console.error('[faq] structured knowledge parse failed:', error?.message || error)
  }

  const entries = []
  const sections = String(faqText || '')
    .split(/^## /m)
    .slice(1)

  for (const section of sections) {
    const lines = section.trim().split('\n')
    const question = lines[0]?.trim()
    const answer = lines.slice(1).join('\n').trim()
    if (question && answer) {
      entries.push({ question, answer })
    }
  }

  return entries
}

export function clearFaqCache() {
  cachedFaq = null
}
