/**
 * Guide article bodies keyed by slug.
 * Metadata lives in shared/guidesCatalog.js (sitemap + listing).
 */

import { getGuideBySlug, GUIDES } from '../../../shared/guidesCatalog.js'
import { guide as cleanFixCsv } from './how-to-clean-and-fix-broken-csv-files-programmatically.js'
import { guide as mismatchedColumns } from './how-to-fix-mismatched-columns-and-shifted-data-in-csv-files.js'
import { guide as encodingFix } from './how-to-fix-corrupted-character-encoding-utf-8-vs-latin-1-in-spreadsheets.js'
import { guide as handleInvisibleTrailingSpacesInCsv } from './how-to-handle-invisible-trailing-spaces-in-csv-cells.js'

const BODIES = {
  [cleanFixCsv.slug]: cleanFixCsv,
  [mismatchedColumns.slug]: mismatchedColumns,
  [encodingFix.slug]: encodingFix,
  [handleInvisibleTrailingSpacesInCsv.slug]: handleInvisibleTrailingSpacesInCsv,
}

/**
 * @param {string} slug
 * @returns {{ meta: import('../../../shared/guidesCatalog.js').GuideMeta, body: object }|null}
 */
export function loadGuide(slug) {
  const meta = getGuideBySlug(slug)
  if (!meta) return null
  const body = BODIES[meta.slug]
  if (!body) return null
  return { meta, body }
}

export { GUIDES, getGuideBySlug }
