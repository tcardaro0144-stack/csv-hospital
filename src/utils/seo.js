/**
 * Client-side SEO helpers for the Faceless Blur SPA.
 * Updates document head on route changes (no react-helmet dependency).
 */

export const SITE_URL = 'https://facelessblur.com'
export const SITE_NAME = 'Faceless Blur'

export const SEO_PAGES = {
  home: {
    title: 'Faceless Blur — AI Developer Ecosystem & Browser Tools',
    description:
      'Faceless Blur builds anonymous, AI-run utilities. Launch CSV Hospital to clean messy CSV files entirely in your browser — no upload required.',
    path: '/',
    type: 'website',
  },
  directoryPage2: {
    title: 'Faceless Blur — Root Directory (Page 2)',
    description:
      'Faceless Blur Root Directory page 2 — classified operations. Slot [04] remains locked.',
    path: '/2',
    type: 'website',
  },
  hospital: {
    title: 'CSV Hospital — Free In-Browser CSV Cleaner | Faceless Blur',
    description:
      'CSV Hospital diagnoses and repairs broken CSV files in your browser: remove empty rows, trim whitespace, standardize headers, then download a clean file. Privacy-first — your data stays on your device.',
    path: '/hospital',
    type: 'website',
  },
}

function ensureMeta(selector, attrs) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    document.head.appendChild(el)
  }
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) el.removeAttribute(key)
    else el.setAttribute(key, value)
  }
  return el
}

function ensureLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
  return el
}

function setJsonLd(id, data) {
  const scriptId = `jsonld-${id}`
  let el = document.getElementById(scriptId)
  if (!data) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = scriptId
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

/**
 * Apply page SEO: title, description, canonical, Open Graph, Twitter, JSON-LD.
 * @param {object} page
 * @param {object} [extraJsonLd] additional schema node(s)
 */
export function applySeo(page, extraJsonLd = null) {
  if (typeof document === 'undefined' || !page) return

  const url = `${SITE_URL}${page.path === '/' ? '' : page.path}`
  const image = `${SITE_URL}/favicon.svg`

  document.title = page.title

  ensureMeta('meta[name="description"]', {
    name: 'description',
    content: page.description,
  })
  ensureMeta('meta[name="robots"]', {
    name: 'robots',
    content: 'index, follow, max-image-preview:large',
  })
  ensureLink('canonical', url)

  ensureMeta('meta[property="og:type"]', {
    property: 'og:type',
    content: page.type || 'website',
  })
  ensureMeta('meta[property="og:site_name"]', {
    property: 'og:site_name',
    content: SITE_NAME,
  })
  ensureMeta('meta[property="og:title"]', {
    property: 'og:title',
    content: page.title,
  })
  ensureMeta('meta[property="og:description"]', {
    property: 'og:description',
    content: page.description,
  })
  ensureMeta('meta[property="og:url"]', {
    property: 'og:url',
    content: url,
  })
  ensureMeta('meta[property="og:image"]', {
    property: 'og:image',
    content: image,
  })

  ensureMeta('meta[name="twitter:card"]', {
    name: 'twitter:card',
    content: 'summary',
  })
  ensureMeta('meta[name="twitter:title"]', {
    name: 'twitter:title',
    content: page.title,
  })
  ensureMeta('meta[name="twitter:description"]', {
    name: 'twitter:description',
    content: page.description,
  })
  ensureMeta('meta[name="twitter:image"]', {
    name: 'twitter:image',
    content: image,
  })

  if (extraJsonLd) {
    setJsonLd('page', extraJsonLd)
  }
}

export function hospitalSoftwareJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'CSV Hospital',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript. Runs entirely in the browser.',
    url: `${SITE_URL}/hospital`,
    description: SEO_PAGES.hospital.description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free admit & preview; paid unlock for discharged CSV download.',
    },
    creator: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    isAccessibleForFree: true,
    featureList: [
      'Remove empty rows',
      'Trim whitespace',
      'Standardize headers',
      'Local in-browser processing (no file upload)',
      'Download cleaned CSV after unlock',
    ],
  }
}

export function organizationWebsiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        description:
          'Anonymous, AI-run developer ecosystem building browser-local utilities and indie games.',
        logo: `${SITE_URL}/favicon.svg`,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'en',
      },
    ],
  }
}
