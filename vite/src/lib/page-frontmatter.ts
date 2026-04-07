import { z } from 'zod'

export const pageSeoMetaKeys = [
  'robots',
  'og:title',
  'og:description',
  'og:image',
  'og:url',
  'og:type',
  'og:image:width',
  'og:image:height',
  'twitter:title',
  'twitter:description',
  'twitter:image',
  'twitter:card',
  'twitter:site',
  'twitter:image:width',
  'twitter:image:height',
] as const

export type PageSeoMetaKey = (typeof pageSeoMetaKeys)[number]

export const pageFrontmatterSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  sidebarTitle: z.string().optional(),
  tag: z.string().optional(),
  deprecated: z.boolean().optional(),
  hidden: z.boolean().optional(),
  noindex: z.boolean().optional(),
  keywords: z.array(z.string()).optional(),
  robots: z.string().optional(),
  'og:title': z.string().optional(),
  'og:description': z.string().optional(),
  'og:image': z.string().optional(),
  'og:url': z.string().optional(),
  'og:type': z.string().optional(),
  'og:image:width': z.string().optional(),
  'og:image:height': z.string().optional(),
  'twitter:title': z.string().optional(),
  'twitter:description': z.string().optional(),
  'twitter:image': z.string().optional(),
  'twitter:card': z.string().optional(),
  'twitter:site': z.string().optional(),
  'twitter:image:width': z.string().optional(),
  'twitter:image:height': z.string().optional(),
})

export type PageFrontmatter = z.output<typeof pageFrontmatterSchema>
export type PageSeoMeta = Partial<Record<PageSeoMetaKey, string>>

export function getPageSeoMeta(frontmatter: PageFrontmatter | undefined): PageSeoMeta {
  if (!frontmatter) return {}
  const meta: PageSeoMeta = {}
  for (const key of pageSeoMetaKeys) {
    const value = frontmatter[key]
    if (value) meta[key] = value
  }
  return meta
}

export function getPageRobots(frontmatter: PageFrontmatter | undefined): string | undefined {
  if (!frontmatter) return undefined
  if (frontmatter.hidden || frontmatter.noindex) return 'noindex'
  return frontmatter.robots
}

export function serializeKeywords(keywords: string[] | undefined): string | undefined {
  if (!keywords || keywords.length === 0) return undefined
  return keywords.join(', ')
}

export function isHiddenPage(frontmatter: PageFrontmatter | undefined): boolean {
  return frontmatter?.hidden === true
}

export function isIndexablePage(frontmatter: PageFrontmatter | undefined): boolean {
  if (!frontmatter) return true
  if (frontmatter.hidden || frontmatter.noindex) return false
  const robots = frontmatter.robots?.toLowerCase()
  return robots ? !robots.split(',').map((part) => part.trim()).includes('noindex') : true
}
