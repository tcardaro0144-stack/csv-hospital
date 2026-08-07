#!/usr/bin/env node
/**
 * Generate public/sitemap.xml for CSV Hospital.
 *
 * Usage:
 *   node scripts/generate-sitemap.mjs
 *   npm run sitemap
 *
 * Runs automatically before vite build (see package.json).
 * Guide URLs are pulled from shared/guidesCatalog.js so new guides
 * appear in the sitemap without editing this file.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getGuideSitemapEntries } from '../shared/guidesCatalog.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SITE_URL = (process.env.SITE_URL || 'https://csvhospital.com').replace(
  /\/$/,
  '',
)

/** @type {{ path: string, changefreq: string, priority: string, lastmod?: string }[]} */
const STATIC_PAGES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
]

function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

function buildSitemapXml(pages, fallbackLastmod = isoDate()) {
  const urls = pages
    .map((page) => {
      const loc = page.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${page.path}`
      const lastmod = page.lastmod || fallbackLastmod
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
  const pages = [...STATIC_PAGES, ...getGuideSitemapEntries()]
  const xml = buildSitemapXml(pages)
  const outPublic = join(ROOT, 'public', 'sitemap.xml')
  mkdirSync(dirname(outPublic), { recursive: true })
  writeFileSync(outPublic, xml, 'utf8')
  console.log(`[sitemap] wrote ${outPublic}`)
  console.log(`[sitemap] ${pages.length} URLs · base ${SITE_URL}`)
  for (const page of pages) {
    console.log(
      `  - ${page.path === '/' ? SITE_URL + '/' : SITE_URL + page.path}`,
    )
  }
}

main()
