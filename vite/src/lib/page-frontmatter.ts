import { z } from 'zod'
import { parseFrontmatterObject } from './frontmatter.ts'
import { formatHolocronWarning, logger } from './logger.ts'

const stringOrNumberToStringSchema = z.union([z.string(), z.number()]).transform(String)
const pageModeSchema = z.enum(['default', 'wide', 'custom', 'frame', 'center'])

const pageSeoMetaKeys = [
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
  $schema: z.string().optional().describe('URL of the JSON Schema for this frontmatter'),
  title: z.string().optional().describe('The page title displayed in the sidebar, browser tab, and heading'),
  description: z.string().optional().describe('Page description used for SEO meta tags and search indexing'),
  icon: z.string().optional().describe('Icon name from the configured icon library (e.g. "rocket", "home")'),
  sidebarTitle: z.string().optional().describe('Override the title shown in the sidebar navigation. Use this to keep the sidebar label short while using a longer, SEO-friendly title in the title field for search engines and browser tabs.'),
  tag: z.string().optional().describe('Badge label displayed next to the page title in the sidebar'),
  mode: pageModeSchema
    .optional()
    .describe(
      'Mintlify-compatible page layout mode. "default" keeps the full layout (left navigation sidebar, right table of contents, footer). "center" and "custom" hide the left navigation sidebar and center the content. "wide" and "frame" alias to the default layout.',
    ),
  deprecated: z.boolean().optional().describe('Mark the page as deprecated'),
  rendering: z
    .enum(['ssr', 'static'])
    .optional()
    .describe(
      'Rendering strategy for this page. "ssr" (default) renders the page on every request, so it can react to per-request data like cookies. "static" prerenders the page to static HTML at build time for faster delivery and cheaper hosting — use it for pages whose content never depends on the incoming request.',
    ),
  gridGap: z.number().optional().describe('Override the grid gap (in pixels) between content and sidebar columns'),
  hidden: z.boolean().optional().describe('Hide the page from sidebar navigation and search results'),
  noindex: z.boolean().optional().describe('Prevent search engines from indexing this page'),
  keywords: z.array(z.string()).optional().describe('Additional keywords for search indexing'),
  robots: z.string().optional().describe('Custom robots meta tag value (e.g. "noindex, nofollow")'),
  'og:title': z.string().optional().describe('Open Graph title override'),
  'og:description': z.string().optional().describe('Open Graph description override'),
  'og:image': z.string().optional().describe('Open Graph image URL'),
  'og:url': z.string().optional().describe('Open Graph canonical URL'),
  'og:type': z.string().optional().describe('Open Graph type (e.g. "article", "website")'),
  'og:image:width': stringOrNumberToStringSchema.optional().describe('Open Graph image width in pixels'),
  'og:image:height': stringOrNumberToStringSchema.optional().describe('Open Graph image height in pixels'),
  'twitter:title': z.string().optional().describe('Twitter card title override'),
  'twitter:description': z.string().optional().describe('Twitter card description override'),
  'twitter:image': z.string().optional().describe('Twitter card image URL'),
  'twitter:card': z.string().optional().describe('Twitter card type (e.g. "summary", "summary_large_image")'),
  'twitter:site': z.string().optional().describe('Twitter @username for the site'),
  'twitter:image:width': stringOrNumberToStringSchema.optional().describe('Twitter card image width in pixels'),
  'twitter:image:height': stringOrNumberToStringSchema.optional().describe('Twitter card image height in pixels'),
  'cache-control': z.string().optional().describe('Raw Cache-Control header value for this page (e.g. "s-maxage=0, no-store")'),
}).passthrough()

export type PageFrontmatter = z.output<typeof pageFrontmatterSchema>
export type PageMode = z.output<typeof pageModeSchema>
export type PageSeoMeta = Partial<Record<PageSeoMetaKey, string>>

export function parsePageFrontmatter(content: string): PageFrontmatter {
  const parsed = parseFrontmatterObject(content)
  const result = pageFrontmatterSchema.safeParse(parsed)
  if (!result.success) {
    logger.warn(formatHolocronWarning(`invalid frontmatter ignored: ${result.error.message}`))
    return {}
  }
  return result.data
}

export function getPageSeoMeta(frontmatter: PageFrontmatter | undefined): PageSeoMeta {
  if (!frontmatter) return {}
  const meta: PageSeoMeta = {}
  for (const key of pageSeoMetaKeys) {
    const value = frontmatter[key]
    if (value) meta[key] = value
  }
  return meta
}

export type PageRendering = 'ssr' | 'static'

/** Rendering strategy for a page. Defaults to "ssr" when not set in frontmatter. */
export function getPageRendering(frontmatter: PageFrontmatter | undefined): PageRendering {
  return frontmatter?.rendering === 'static' ? 'static' : 'ssr'
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

function isHiddenPage(frontmatter: PageFrontmatter | undefined): boolean {
  return frontmatter?.hidden === true
}

export function isIndexablePage(frontmatter: PageFrontmatter | undefined): boolean {
  if (!frontmatter) return true
  if (frontmatter.hidden || frontmatter.noindex) return false
  const robots = frontmatter.robots?.toLowerCase()
  return robots ? !robots.split(',').map((part) => part.trim()).includes('noindex') : true
}
