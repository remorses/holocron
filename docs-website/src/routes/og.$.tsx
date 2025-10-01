import { prisma } from 'db'
import { type Route } from './+types/og.$'
import { generateOgImagePng } from '../lib/og'
import { getHost } from '../lib/get-host'
import { getDocsJson, withoutBasePath } from '../lib/utils'

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const path = withoutBasePath(url.pathname.replace('/og', ''))
  const domain = getHost(request)

  // Find the site and branch
  const siteBranch = await prisma.siteBranch.findFirst({
    where: {
      domains: {
        some: {
          host: domain,
        },
      },
    },
    include: {
      site: true,
    },
  })

  if (!siteBranch || !siteBranch.site) {
    throw new Response('Site not found', { status: 404 })
  }

  // Get docsJson for site metadata
  const docsJson = getDocsJson({
    filesInDraft: {},
    docsJson: siteBranch.docsJson,
  })

  // Find the page to get title and description
  const slugs = path.split('/').filter((v) => v.length > 0)
  const slug = '/' + slugs.join('/')

  const page = await prisma.markdownPage.findFirst({
    where: {
      slug,
      branchId: siteBranch.branchId,
    },
  })

  // Get page metadata from frontmatter or use defaults
  const title = (page?.frontmatter as any)?.title || siteBranch.site.name || 'Documentation'
  const description = (page?.frontmatter as any)?.description || docsJson?.description || ''

  // Get favicon/logo URL
  const faviconUrl = (() => {
    if (!docsJson?.favicon && !docsJson?.logo) {
      return null
    }

    // Try favicon first
    if (docsJson?.favicon) {
      if (typeof docsJson.favicon === 'string') {
        return new URL(docsJson.favicon, url.origin).toString()
      }
      if (docsJson.favicon?.light) {
        return new URL(docsJson.favicon.light, url.origin).toString()
      }
    }

    // Fallback to logo
    if (docsJson?.logo) {
      if (typeof docsJson.logo === 'string') {
        return new URL(docsJson.logo, url.origin).toString()
      }
      if ((docsJson.logo as any)?.light) {
        return new URL((docsJson.logo as any).light, url.origin).toString()
      }
    }

    return null
  })()

  // Generate PNG image
  const pngBuffer = await generateOgImagePng({
    title,
    description,
    faviconUrl,
    siteName: siteBranch.site.name || undefined,
    siteTagline: 'Open Source Documentation',
  })

  return new Response(pngBuffer as any, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
