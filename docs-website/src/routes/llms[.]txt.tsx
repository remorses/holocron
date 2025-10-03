import { prisma } from 'db'
import type { Route } from './+types/llms[.]txt'
import { getFilesForSource } from '../lib/source.server'
import { getFumadocsSource } from '../lib/source'
import { getHost } from '../lib/get-host'
import { getDocsJson } from '../lib/utils'

export async function loader({ request }: Route.LoaderArgs) {
  const domain = getHost(request)

  const siteBranch = await prisma.siteBranch.findFirst({
    where: {
      domains: {
        some: {
          host: domain,
        },
      },
    },
    include: {
      domains: true,
      site: {
        include: {
          locales: true,
        },
      },
    },
  })

  const site = siteBranch?.site

  if (!site) {
    throw new Response('Site not found', { status: 404 })
  }

  if (!siteBranch) {
    throw new Response('Branch not found', { status: 404 })
  }

  const languages = site.locales.map((x) => x.locale)
  const files = await getFilesForSource({
    branchId: siteBranch.branchId,
    githubFolder: siteBranch.site?.githubFolder || '',
    filesInDraft: {},
  })



  const docsJson = getDocsJson({
    filesInDraft: {},
    docsJson: siteBranch.docsJson,
  })

  const source = getFumadocsSource({
    defaultLanguage: site.defaultLocale,
    files,
    languages,
    docsJson,
  })

  const siteName = site.name || 'Documentation'
  const baseUrl = `https://${domain}`

  // Get all pages from the source
  const pages = source.getPages()

  // Format as llms.txt with links ending in .md
  const linksText = pages
    .map((page) => {
      const title = page.data.title || 'Untitled'
      const url = `${baseUrl}${page.url}.md`
      return `- [${title}](${url})`
    })
    .join('\n')

  const llmsTxt = `# ${siteName}

## Docs

${linksText}`

  return new Response(llmsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
