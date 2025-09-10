import { ulid } from 'ulid'
import { prisma } from 'db'
import { DocsJsonType } from 'docs-website/src/lib/docs-json'
import { defaultDocsJsonComments, defaultStartingHolocronJson } from 'docs-website/src/lib/docs-json-examples'
import { env } from './env'
import { assetsFromFilesList, syncSite } from './sync'
import { slugKebabCaseKeepExtension } from './utils'
import { CloudflareClient, getZoneIdForDomain } from './cloudflare'

interface CreateSiteParams {
  name: string
  orgId: string
  userId: string
  githubOwner?: string
  githubRepo?: string
  githubRepoId?: number
  githubFolder?: string
  githubBranch?: string
  githubInstallationId?: number
  files?: Array<{
    relativePath: string
    contents: string
  }>
  additionalDomains?: string[]
  visibility?: 'public' | 'private'
}

interface CreateSiteResult {
  siteId: string
  branchId: string
  chatId: string
  docsJson: DocsJsonType
  internalHost: string
  domains: string[]
  pageCount: number
  cloudflareDomain: string
}

export async function createSite({
  name,
  orgId,
  userId,
  githubOwner,
  githubRepo,
  githubRepoId,
  githubFolder = '',
  githubBranch,
  githubInstallationId,
  files = [],
  additionalDomains,
  visibility = 'private',
}: CreateSiteParams): Promise<CreateSiteResult> {
  // Sanitize githubFolder - remove leading and trailing slashes
  let sanitizedGithubFolder = githubFolder
  if (sanitizedGithubFolder.startsWith('/')) {
    sanitizedGithubFolder = sanitizedGithubFolder.substring(1)
  }
  if (sanitizedGithubFolder.endsWith('/')) {
    sanitizedGithubFolder = sanitizedGithubFolder.slice(0, -1)
  }

  const siteId = ulid()
  const branchId = ulid()

  // Generate internal hostname
  const userName = slugKebabCaseKeepExtension(githubRepo || name || 'holocron-site')
  const randomHash = Math.random().toString(36).substring(2, 10)

  const isPreview = env.PUBLIC_URL?.includes('preview.')

  let postfix = ''
  if (isPreview) {
    postfix = '-preview-site'
  }
  const internalHost = `${userName}-${randomHash}${postfix}.${env.APPS_DOMAIN}`

  // Set up default domains
  const defaultDomains = process.env.NODE_ENV === 'development'
    ? [`${userName}-${randomHash}.localhost`, internalHost]
    : [internalHost]



  // Combine default and additional domains
  const domains = additionalDomains
    ? [...defaultDomains, ...additionalDomains]
    : defaultDomains

  const domainForBasePath = `${branchId}-docs-basepath.holocronsites.com`

  // TODO only add this for paid websites
  domains.push(domainForBasePath)

  // Create docsJson configuration
  const docsJson: DocsJsonType = {
    ...defaultStartingHolocronJson,
    siteId,
    name,
    domains,
  }

  // Create the site
  const site = await prisma.site.create({
    data: {
      name,
      siteId,
      orgId,
      githubOwner: githubOwner || '',
      githubRepo: githubRepo || '',
      githubRepoId: githubRepoId || (githubRepo ? 0 : undefined),
      githubFolder: sanitizedGithubFolder || '',
      visibility,
      branches: {
        create: {
          branchId,
          title: 'Main',
          ...(githubBranch && { githubBranch }),

        },
      },
      ...(githubInstallationId && {
        githubInstallations: {
          create: {
            installationId: githubInstallationId,
            appId: env.GITHUB_APP_ID!,
          },
        },
      }),
    },
  })

  console.log(`created site ${siteId}`)

  // Always sync files (empty array creates initial structure)
  const assets = assetsFromFilesList({
    files,
    githubFolder: sanitizedGithubFolder || '',
    docsJson,
    docsJsonComments: {
      ...defaultDocsJsonComments,
    },
  })
  // Do domain creation, chat creation, and syncSite in parallel
  const [_, chat, syncResult] = await Promise.all([
    prisma.domain.create({
      data: {
        host: domainForBasePath,
        branchId,
        domainType: 'basepathDomain',
      },
    }),
    prisma.chat.create({
      data: {
        userId,
        branchId,
        title: null,
        currentSlug: null,
        filesInDraft: {},
      },
    }),
    syncSite({
      files: assets,
      githubFolder: sanitizedGithubFolder || '',
      branchId,
      siteId,
      name,
      docsJson,
    }),
  ])

  const { pageCount } = syncResult
  const chatId = chat.chatId

  return {
    siteId,
    branchId,
    chatId,
    docsJson,
    internalHost,
    domains,
    pageCount,
    cloudflareDomain: domainForBasePath,
  }
}
