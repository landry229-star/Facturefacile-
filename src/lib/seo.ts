const siteOrigin = 'https://facturefacile.vercel.app'

type PublicSeoMetadata = {
  path: string
  title: string
  description: string
  indexable?: boolean
}

function setMetaTag(attribute: 'name' | 'property', key: string, value: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.append(element)
  }
  element.content = value
}

export function updatePublicSeoMetadata({ path, title, description, indexable = true }: PublicSeoMetadata) {
  const canonicalUrl = new URL(path, siteOrigin).toString()
  document.title = title
  setMetaTag('name', 'description', description)
  setMetaTag('name', 'robots', indexable ? 'index, follow, max-image-preview:large' : 'noindex, follow')
  setMetaTag('property', 'og:type', 'website')
  setMetaTag('property', 'og:site_name', 'FactureFacile Bénin')
  setMetaTag('property', 'og:locale', 'fr_BJ')
  setMetaTag('property', 'og:title', title)
  setMetaTag('property', 'og:description', description)
  setMetaTag('property', 'og:url', canonicalUrl)
  setMetaTag('property', 'og:image', `${siteOrigin}/image_8af825cc.jpg`)
  setMetaTag('name', 'twitter:card', 'summary_large_image')
  setMetaTag('name', 'twitter:title', title)
  setMetaTag('name', 'twitter:description', description)
  setMetaTag('name', 'twitter:image', `${siteOrigin}/image_8af825cc.jpg`)

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.append(canonical)
  }
  canonical.href = canonicalUrl
}

export function setNoIndexMetadata() {
  setMetaTag('name', 'robots', 'noindex, nofollow')
}
