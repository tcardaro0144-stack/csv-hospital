#!/usr/bin/env node
/**
 * Cloudflare Pages SPA fallback: copy dist/index.html → dist/200.html
 * so unmatched paths return the app shell with HTTP 200 (no _redirects catch-all).
 */

import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const indexHtml = join(root, 'dist', 'index.html')
const fallbackHtml = join(root, 'dist', '200.html')

if (!existsSync(indexHtml)) {
  console.error('[spa-fallback] dist/index.html missing — run vite build first')
  process.exit(1)
}

copyFileSync(indexHtml, fallbackHtml)
console.log('[spa-fallback] wrote dist/200.html (SPA 200 fallback)')
