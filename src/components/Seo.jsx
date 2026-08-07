import { useEffect } from 'react'
import {
  applySeo,
  guideArticleJsonLd,
  hospitalSoftwareJsonLd,
  SEO_PAGES,
} from '../utils/seo.js'

/**
 * Route-level SEO for the SPA. Renders nothing — updates document head.
 * @param {'home' | 'hospital' | 'terms' | 'guides' | 'guide'} pageKey
 * @param {{ title: string, description: string, path: string, publishedAt?: string, updatedAt?: string }} [guide]
 */
export default function Seo({ pageKey = 'home', guide = null }) {
  useEffect(() => {
    if (pageKey === 'guide' && guide) {
      applySeo(
        {
          title: `${guide.title} — CSV Hospital`,
          description: guide.description,
          path: guide.path,
          type: 'article',
        },
        guideArticleJsonLd(guide),
      )
      return
    }

    const page = SEO_PAGES[pageKey] || SEO_PAGES.home
    let jsonLd = hospitalSoftwareJsonLd()

    if (pageKey === 'terms' || pageKey === 'guides') {
      jsonLd = {
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
    }

    applySeo(page, jsonLd)
  }, [
    pageKey,
    guide?.path,
    guide?.title,
    guide?.description,
    guide?.publishedAt,
    guide?.updatedAt,
  ])

  return null
}
