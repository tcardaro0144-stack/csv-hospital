/**
 * Client-side SEO helpers for the CSV Hospital SPA.
 * Updates document head on route changes (no react-helmet dependency).
 */

export const SITE_URL = 'https://csvhospital.com'
export const SITE_NAME = 'CSV Hospital'

export const SEO_PAGES = {
  home: {
    title: 'CSV Hospital — Is Your Data Terminally Messy?',
    description:
      'CSV Hospital is the digital ER for messy spreadsheets. Admit a CSV in your browser: remove empty rows, trim whitespace, standardize headers, then download a clean file. Privacy-first — your data stays on your device.',
    path: '/',
    type: 'website',
  },
  hospital: {
    title: 'CSV Hospital — Is Your Data Terminally Messy?',
    description:
      'CSV Hospital is the digital ER for messy spreadsheets. Admit a CSV in your browser: remove empty rows, trim whitespace, standardize headers, then download a clean file. Privacy-first — your data stays on your device.',
    path: '/',
    type: 'website',
  },
  terms: {
    title: 'Terms of Service — CSV Hospital',
    description:
      'Terms of Service for CSV Hospital. Owned by T.J.C.; generated and operated by AI. Covers as-is data repair, user backup responsibility, and non-refundable one-time credit purchases.',
    path: '/terms',
    type: 'website',
  },
  guides: {
    title: 'Guides — CSV Hospital',
    description:
      'Technical guides from CSV Hospital: how to clean and fix broken CSV files, repair delimiters, fix encoding issues, and stabilize messy spreadsheets in the browser.',
    path: '/guides',
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
    '@type': 'SoftwareApplication',
    name: 'CSV Hospital',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'DataCleaningApplication',
    operatingSystem: 'Web browser (Windows, macOS, Linux, ChromeOS)',
    browserRequirements: 'Requires JavaScript. Runs entirely in the browser.',
    url: `${SITE_URL}/`,
    description: SEO_PAGES.hospital.description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free admit and preview; paid unlock for discharged CSV download.',
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

/** Shared FAQ entities for visible FAQs + FAQPage JSON-LD (keep in sync). */
export const HOSPITAL_FAQS = [
  {
    q: 'Is this a real hospital?',
    a: 'Only emotionally. We treat CSVs, not humans — though both can look terminal after a long night of “quick edits.”',
  },
  {
    q: 'Does my data leave my device?',
    a: 'No. Triage runs locally in your browser. We are serious about clean data and quiet privacy.',
  },
  {
    q: 'What files can I admit?',
    a: '.csv only · max 5 MB · up to 50,000 rows and 200 columns. One patient file at a time, please.',
  },
  {
    q: 'How do I discharge a healed file?',
    a: 'Admit → review triage stats → complete checkout if download is locked → Download Discharged CSV. It saves as {name}-fixed.csv on your device.',
  },
  {
    q: 'What problems does CSV Hospital solve?',
    a: 'It repairs messy CSV spreadsheets in the browser: empty rows, invisible whitespace, crooked headers, and related import failures—without uploading your file to a server.',
  },
  {
    q: 'What exactly does CSV Hospital do and how does it protect my data?',
    a: 'CSV Hospital is a browser-based utility that repairs messy CSV spreadsheets. It automatically removes empty rows, trims invisible whitespace, standardizes crooked headers, and fixes common structure errors so imports, VLOOKUPs, and warehouse loads stop failing. Most importantly, triage stays on your device—your file is processed entirely within your local browser memory and never uploads to an external server. Once repaired, you can download your clean, healed CSV instantly.',
  },
]

export function hospitalFaqPageJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: HOSPITAL_FAQS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  }
}

/**
 * Home / hospital graph for answer engines: SoftwareApplication + FAQPage.
 */
export function hospitalHomeJsonLd() {
  const { '@context': _swCtx, ...software } = hospitalSoftwareJsonLd()
  const { '@context': _faqCtx, ...faq } = hospitalFaqPageJsonLd()
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        description:
          'CSV Hospital — the digital ER for messy spreadsheets. Browser-local CSV triage and repair.',
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
      {
        ...software,
        '@id': `${SITE_URL}/#software`,
        creator: { '@id': `${SITE_URL}/#organization` },
      },
      {
        ...faq,
        '@id': `${SITE_URL}/#faq`,
        isPartOf: { '@id': `${SITE_URL}/#website` },
      },
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
          'CSV Hospital — the digital ER for messy spreadsheets. Browser-local CSV triage and repair.',
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

/**
 * Article schema for a guide page.
 * @param {{ title: string, description: string, path: string, publishedAt: string, updatedAt?: string }} guide
 */
export function guideArticleJsonLd(guide) {
  if (!guide) return null
  const url = `${SITE_URL}${guide.path}`
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    datePublished: guide.publishedAt,
    dateModified: guide.updatedAt || guide.publishedAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/favicon.svg`,
      },
    },
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
  }
}
