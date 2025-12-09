import { prisma } from 'db'
import type { Route } from './+types/sitemap[.]xml'

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const domain = url.hostname

  const siteBranch = await prisma.siteBranch.findFirst({
    where: {
      domains: {
        some: {
          host: domain,
        },
      },
    },
  })

  if (!siteBranch) {
    return new Response('Site not found', { status: 404 })
  }

  const pages = await prisma.markdownPage.findMany({
    where: {
      branchId: siteBranch.branchId,
    },
    select: {
      slug: true,
      lastEditedAt: true,
      frontmatter: true,
    },
  })

  const filteredPages = pages.filter((page) => {
    const fm = page.frontmatter as any
    return fm?.visibility !== 'hidden'
  })

  const sitemapEntries = filteredPages
    .map((page) => {
      const fullUrl = new URL(page.slug, url.origin).toString()
      return `
  <url>
    <loc>${fullUrl}</loc>
    <lastmod>${(page.lastEditedAt || new Date()).toISOString()}</lastmod>
  </url>`
    })
    .join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  })
}
