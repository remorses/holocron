import { ulid } from 'ulid'
import path from 'node:path'
import { prisma } from 'db'
import { DocsJsonType } from 'docs-website/src/lib/docs-json'
import { defaultDocsJsonComments, defaultStartingHolocronJson } from 'docs-website/src/lib/docs-json-examples'
import { DOCS_JSON_BASENAME } from 'docs-website/src/lib/constants'
import { applyJsonCComments, extractJsonCComments } from './json-c-comments'
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
  metadata?: Record<string, any>
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
  metadata,
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

  let prefix = ''
  if (isPreview) {
    prefix = '-preview-site'
  }
  const internalHost = `${userName}-${randomHash}${prefix}.${env.APPS_DOMAIN}`

  // Set up default domains
  const defaultDomains = process.env.NODE_ENV === 'development'
    ? [`${userName}-${randomHash}.localhost`, internalHost]
    : [internalHost]



  // Combine default and additional domains
  const domains = additionalDomains
    ? [...defaultDomains, ...additionalDomains]
    : defaultDomains

  const domainForBasePath = `${branchId}-docs-basepath.holocronsites.com`
  const docsJsonPath = path.posix.join(sanitizedGithubFolder || '.', DOCS_JSON_BASENAME)

  const holocronJsoncFile = files.find(f =>
    f.relativePath === DOCS_JSON_BASENAME ||
    f.relativePath === docsJsonPath
  )

  let parsedHolocronJson: Partial<DocsJsonType> = {}
  let userComments = {}
  if (holocronJsoncFile) {
    const { data, comments } = extractJsonCComments(holocronJsoncFile.contents)
    parsedHolocronJson = data
    userComments = comments
  }

  const docsJson: DocsJsonType = {
    ...defaultStartingHolocronJson,
    ...parsedHolocronJson,
    siteId,
    name,
    domains,
  }

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
      ...(metadata && { metadata }),
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



  const filesWithDocsJson = [
    ...files.filter(
      f => f.relativePath !== holocronJsoncFile?.relativePath
    ),
    {
      relativePath: docsJsonPath,
      contents: applyJsonCComments(docsJson, { ...defaultDocsJsonComments, ...userComments }, 2),
    }
  ]

  const assets = assetsFromFilesList({
    files: filesWithDocsJson,
    githubFolder: sanitizedGithubFolder || '',
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
      ignorePatterns: docsJson?.ignore || [],
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
