import { useEffect } from 'react'
import {
  applySeo,
  hospitalSoftwareJsonLd,
  SEO_PAGES,
} from '../utils/seo.js'

/**
 * Route-level SEO for the SPA. Renders nothing — updates document head.
 * @param {'home' | 'hospital'} pageKey
 */
export default function Seo({ pageKey = 'home' }) {
  useEffect(() => {
    const page = SEO_PAGES[pageKey] || SEO_PAGES.home
    const jsonLd = hospitalSoftwareJsonLd()
    applySeo(page, jsonLd)
  }, [pageKey])

  return null
}
