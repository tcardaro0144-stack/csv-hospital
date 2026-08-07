/**
 * Guide article bodies keyed by slug.
 * Metadata lives in shared/guidesCatalog.js (sitemap + listing).
 */

import { getGuideBySlug, GUIDES } from '../../../shared/guidesCatalog.js'
import { guide as cleanFixCsv } from './how-to-clean-and-fix-broken-csv-files-programmatically.js'

const BODIES = {
  [cleanFixCsv.slug]: cleanFixCsv,
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
