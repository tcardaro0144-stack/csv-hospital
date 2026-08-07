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
  {
    slug: 'how-to-fix-mismatched-columns-and-shifted-data-in-csv-files',
    title: 'How to Fix Mismatched Columns and Shifted Data in CSV Files',
    description:
      'Fix CSV rows that shift because of an extra comma or missing delimiter — and how CSV Hospital automatically aligns column structures in your browser.',
    publishedAt: '2026-08-07',
    updatedAt: '2026-08-07',
    readingMinutes: 7,
    tags: ['csv', 'columns', 'delimiters', 'data-quality'],
  },
  {
    slug: 'how-to-fix-corrupted-character-encoding-utf-8-vs-latin-1-in-spreadsheets',
    title: 'How to Fix Corrupted Character Encoding (UTF-8 vs. Latin-1) in Spreadsheets',
    description:
      'Why special characters turn into mojibake across systems — and how CSV Hospital cleans and normalizes CSV encoding instantly in the browser.',
    publishedAt: '2026-08-07',
    updatedAt: '2026-08-07',
    readingMinutes: 7,
    tags: ['csv', 'utf-8', 'latin-1', 'encoding', 'mojibake'],
  },
  {
    slug: 'how-to-handle-invisible-trailing-spaces-in-csv-cells',
    title: 'How to Handle Invisible Trailing Spaces in CSV Cells',
    description:
      'Why leading and trailing spaces break CSV joins and filters — and how CSV Hospital trims invisible padding from every cell in your browser.',
    publishedAt: '2026-08-07',
    updatedAt: '2026-08-07',
    readingMinutes: 6,
    tags: ['csv', 'whitespace', 'trim', 'data-cleaning'],
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
