/**
 * CSV Hospital guides registry — shared by the SPA and sitemap generator.
 * Add a guide here first; then add the article body under src/content/guides/.
 */

/** @typedef {{
 *   slug: string,
 *   title: string,
 *   description: string,
 *   publishedAt: string,
 *   updatedAt?: string,
 *   readingMinutes?: number,
 *   tags?: string[],
 * }} GuideMeta */

/** @type {GuideMeta[]} */
export const GUIDES = [
  {
    slug: 'how-to-clean-and-fix-broken-csv-files-programmatically',
    title: 'How to Clean and Fix Broken CSV Files Programmatically',
    description:
      'Fix broken delimiters, mismatched columns, and encoding issues in CSV files — and how CSV Hospital heals messy spreadsheets in your browser without manual script editing.',
    publishedAt: '2026-08-07',
    updatedAt: '2026-08-07',
    readingMinutes: 8,
    tags: ['csv', 'data-cleaning', 'encoding', 'delimiters'],
  },
]

/**
 * @param {string} slug
 * @returns {GuideMeta|null}
 */
export function getGuideBySlug(slug) {
  const needle = String(slug || '')
    .trim()
    .toLowerCase()
  if (!needle) return null
  return GUIDES.find((g) => g.slug === needle) || null
}

/**
 * Sitemap paths for every guide + the index.
 * @returns {{ path: string, changefreq: string, priority: string, lastmod?: string }[]}
 */
export function getGuideSitemapEntries() {
  const index = {
    path: '/guides',
    changefreq: 'weekly',
    priority: '0.8',
  }
  const articles = GUIDES.map((g) => ({
    path: `/guides/${g.slug}`,
    changefreq: 'monthly',
    priority: '0.7',
    lastmod: g.updatedAt || g.publishedAt,
  }))
  return [index, ...articles]
}
