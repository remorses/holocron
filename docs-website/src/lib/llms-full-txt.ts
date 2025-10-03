import { prisma } from 'db'
import { getFilesForSource } from './source.server'
import { searchDocsWithSearchApi, formatSearchApiSearchResults } from './search-api-search'
import { getFumadocsSource } from './source'
import { getDocsJson } from './utils'

export async function generateLlmsFullTxt({
  domain,
  searchQuery,
}: {
  domain: string
  searchQuery?: string[]
}): Promise<string> {
  const baseUrl = `https://${domain}`

  let output = ''

  const siteBranch = await prisma.siteBranch.findFirst({
    where: {
      domains: {
        some: {
          host: domain,
        },
      },
    },
    select: {
      branchId: true,
      domains: true,
      docsJson: true,
      site: {
        select: {
          defaultLocale: true,
          githubFolder: true,
          locales: true,
        },
      },
    },
  })

  const site = siteBranch?.site

  if (!site || !siteBranch) {
    return ''
  }

  if (searchQuery?.length) {
    // Use search API for search queries
    const searchResults = await searchDocsWithSearchApi({
      query: searchQuery,
      branchId: siteBranch.branchId,
      // exact: true,
    })

    output += formatSearchApiSearchResults({
      results: searchResults,
      baseUrl,
    })
  } else {
    // No search query - return all pages
    const languages = site.locales.map((x) => x.locale)
    const files = await getFilesForSource({
      branchId: siteBranch.branchId,
      githubFolder: site.githubFolder || '',
      filesInDraft: {},
    })

    const docsJson = siteBranch.docsJson as DocsJsonType

    const source = getFumadocsSource({
      defaultLanguage: site.defaultLocale,
      files,
      languages,
      docsJson,
    })
    const pages = source.getPages()
    const batchSize = 5

    // Process pages in batches
    for (let i = 0; i < pages.length; i += batchSize) {
      const batch = pages.slice(i, i + batchSize)
      const slugs = batch.map((page) => page.url)

      // Fetch markdown content for batch of pages
      const markdownPages = await prisma.markdownPage.findMany({
        where: {
          slug: {
            in: slugs,
          },
          branchId: siteBranch.branchId,
        },
        select: {
          slug: true,
          content: {
            select: {
              markdown: true,
            },
          },
        },
      })

      // Create a map for quick lookup
      const pageContentMap = new Map(markdownPages.map((page) => [page.slug, page.content?.markdown || '']))

      // Add each page in the batch
      for (const page of batch) {
        const sourceUrl = `${baseUrl}${page.url}.md`
        const markdown = pageContentMap.get(page.url)

        if (markdown) {
          const pageTitle = page.data?.title || 'Untitled'
          const section = `# ${pageTitle}\n\n**Source:** ${sourceUrl}\n\n${markdown}\n\n═══════════════════════════════════════════════════════════════════════════════\n\n`
          output += section
        }
      }
    }
  }

  return output
}
