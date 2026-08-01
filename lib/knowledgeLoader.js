/**
 * Dynamic knowledge-base loader for Frontline AI.
 * Reads every .md / .txt file under /knowledge and injects them into prompts.
 */

import { readdirSync, readFileSync, statSync } from 'fs'
import { dirname, extname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const ALLOWED_EXT = new Set(['.md', '.txt'])
const MAX_TOTAL_CHARS = 18_000
const MAX_FILE_CHARS = 8_000

/** @type {{ text: string, files: string[], loadedAt: number, signature: string } | null} */
let cache = null
const CACHE_TTL_MS = 2_000

function resolveKnowledgeDirs() {
  return [
    join(process.cwd(), 'knowledge'),
    join(__dirname, '..', 'knowledge'),
  ]
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listKnowledgeFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((name) => {
        const lower = name.toLowerCase()
        if (lower === 'readme.md' || lower.startsWith('.')) return false
        return ALLOWED_EXT.has(extname(name).toLowerCase())
      })
      .map((name) => join(dir, name))
      .filter((full) => {
        try {
          return statSync(full).isFile()
        } catch {
          return false
        }
      })
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

function fileSignature(paths) {
  return paths
    .map((p) => {
      try {
        const st = statSync(p)
        return `${p}:${st.mtimeMs}:${st.size}`
      } catch {
        return `${p}:missing`
      }
    })
    .join('|')
}

/**
 * Load all knowledge documents from /knowledge.
 * Refreshes when files change (or after a short TTL) so drops/edits apply
 * without restarting the bot.
 *
 * @param {{ force?: boolean }} [opts]
 * @returns {{ text: string, files: Array<{ name: string, path: string, chars: number }>, error: string | null }}
 */
export function loadKnowledgeDirectory(opts = {}) {
  const now = Date.now()
  let dir = null
  let paths = []

  for (const candidate of resolveKnowledgeDirs()) {
    const found = listKnowledgeFiles(candidate)
    if (found.length > 0 || tryDirExists(candidate)) {
      dir = candidate
      paths = found
      break
    }
  }

  if (!dir) {
    const msg = '[knowledge] /knowledge directory not found'
    console.warn(msg)
    return { text: '', files: [], error: msg }
  }

  const signature = fileSignature(paths)
  if (
    !opts.force &&
    cache &&
    cache.signature === signature &&
    now - cache.loadedAt < CACHE_TTL_MS
  ) {
    return {
      text: cache.text,
      files: cache.files.map((name) => ({ name, path: join(dir, name), chars: 0 })),
      error: null,
    }
  }

  const parts = []
  const files = []
  let total = 0

  for (const fullPath of paths) {
    const name = fullPath.split(/[/\\]/).pop() || fullPath
    try {
      let body = readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '').trim()
      if (!body) continue
      if (body.length > MAX_FILE_CHARS) {
        body = `${body.slice(0, MAX_FILE_CHARS)}\n\n[Truncated: ${name}]`
      }
      if (total + body.length > MAX_TOTAL_CHARS) {
        const remaining = Math.max(0, MAX_TOTAL_CHARS - total)
        if (remaining < 200) break
        body = `${body.slice(0, remaining)}\n\n[Knowledge truncated for model context]`
        parts.push(`\n===== DOCUMENT: ${name} =====\n${body}`)
        files.push({ name, path: fullPath, chars: body.length })
        total += body.length
        break
      }
      parts.push(`\n===== DOCUMENT: ${name} =====\n${body}`)
      files.push({ name, path: fullPath, chars: body.length })
      total += body.length
    } catch (error) {
      console.error(
        `[knowledge] failed to read ${name}:`,
        error?.message || error,
      )
    }
  }

  const text = parts.join('\n').trim()
  cache = {
    text,
    files: files.map((f) => f.name),
    loadedAt: now,
    signature,
  }

  if (files.length === 0) {
    console.warn(`[knowledge] no .md/.txt files in ${dir}`)
  } else {
    console.log(
      `[knowledge] loaded ${files.length} document(s) from ${dir} (${total} chars)`,
    )
  }

  return { text, files, error: null }
}

function tryDirExists(dir) {
  try {
    return statSync(dir).isDirectory()
  } catch {
    return false
  }
}

/**
 * Clear in-memory knowledge cache (e.g. after bulk file updates).
 */
export function clearKnowledgeCache() {
  cache = null
}

/**
 * Synthesizer instructions for Frontline when using dynamic docs.
 */
export const KNOWLEDGE_SYNTHESIZER_INSTRUCTIONS = [
  'Use the provided documents in the knowledge base to accurately answer user questions about Faceless Blur and CSV Hospital.',
  "If a specific detail isn't explicitly in the documents, use your best judgment based on our privacy-first brand ethos, but never invent false technical specifications.",
  'Do not invent file limits, billing prices, API endpoints, owners, or release dates that are not supported by the documents or core brand rules.',
  'When documents conflict, prefer the newest/clearest product wording and stay privacy-first.',
].join(' ')

/**
 * Format loaded docs for system-prompt injection.
 * @param {{ force?: boolean }} [opts]
 */
export function formatKnowledgeDocumentsForPrompt(opts = {}) {
  const loaded = loadKnowledgeDirectory(opts)
  if (!loaded.text) {
    return [
      'Dynamic knowledge directory is empty or unavailable.',
      'Rely on core brand ethos (privacy-first, anonymous AI ecosystem) and escalate uncertain technical specs.',
      loaded.error ? `Loader note: ${loaded.error}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  const index = loaded.files.map((f) => `- ${f.name}`).join('\n')
  return [
    'Dynamic knowledge base documents (authoritative source material):',
    index ? `Files loaded:\n${index}` : '',
    '',
    loaded.text,
  ]
    .filter(Boolean)
    .join('\n')
}

export default {
  loadKnowledgeDirectory,
  formatKnowledgeDocumentsForPrompt,
  clearKnowledgeCache,
  KNOWLEDGE_SYNTHESIZER_INSTRUCTIONS,
}
