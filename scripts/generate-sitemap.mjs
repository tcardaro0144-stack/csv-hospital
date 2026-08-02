#!/usr/bin/env node
/**
 * Generate public/sitemap.xml for Faceless Blur / CSV Hospital.
 *
 * Usage:
 *   node scripts/generate-sitemap.mjs
 *   npm run sitemap
 *
 * Runs automatically before vite build (see package.json).
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SITE_URL = (process.env.SITE_URL || 'https://facelessblur.com').replace(
  /\/$/,
  '',
)

/** @type {{ path: string, changefreq: string, priority: string }[]} */
const PAGES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/2', changefreq: 'monthly', priority: '0.6' },
  { path: '/hospital', changefreq: 'weekly', priority: '0.9' },
]

function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

function buildSitemapXml(pages, lastmod = isoDate()) {
  const urls = pages
    .map((page) => {
      const loc = page.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${page.path}`
      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

function main() {
  const xml = buildSitemapXml(PAGES)
  const outPublic = join(ROOT, 'public', 'sitemap.xml')
  mkdirSync(dirname(outPublic), { recursive: true })
  writeFileSync(outPublic, xml, 'utf8')
  console.log(`[sitemap] wrote ${outPublic}`)
  console.log(`[sitemap] ${PAGES.length} URLs · base ${SITE_URL}`)
  for (const page of PAGES) {
    console.log(
      `  - ${page.path === '/' ? SITE_URL + '/' : SITE_URL + page.path}`,
    )
  }
}

main()
