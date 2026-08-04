import { useEffect } from 'react'
import {
  applySeo,
  hospitalSoftwareJsonLd,
  SEO_PAGES,
} from '../utils/seo.js'

/**
 * Route-level SEO for the SPA. Renders nothing — updates document head.
 * @param {'home' | 'hospital' | 'terms'} pageKey
 */
export default function Seo({ pageKey = 'home' }) {
  useEffect(() => {
    const page = SEO_PAGES[pageKey] || SEO_PAGES.home
    const jsonLd =
      pageKey === 'terms'
        ? {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: page.title,
            description: page.description,
            url: `https://csvhospital.com${page.path}`,
            isPartOf: {
              '@type': 'WebSite',
              name: 'CSV Hospital',
              url: 'https://csvhospital.com/',
            },
          }
        : hospitalSoftwareJsonLd()
    applySeo(page, jsonLd)
  }, [pageKey])

  return null
}
