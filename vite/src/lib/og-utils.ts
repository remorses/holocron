/**
 * OG image URL helpers. Builds absolute URLs pointing to the holocron.so
 * OG worker, which renders OG images server-side via takumi.
 */

const OG_BASE_URL = 'https://holocron.so'

export type OgImageUrlOptions = {
  title: string
  description?: string | null
  iconUrl?: string
  siteName?: string
  pageLabel?: string
}

export function buildOgImageUrl(options: OgImageUrlOptions): string {
  const params = new URLSearchParams()
  params.set('title', options.title)
  if (options.description) params.set('description', options.description)
  if (options.iconUrl) params.set('icon', options.iconUrl)
  if (options.siteName) params.set('siteName', options.siteName)
  if (options.pageLabel) params.set('pageLabel', options.pageLabel)
  return `${OG_BASE_URL}/api/og?${params}`
}
