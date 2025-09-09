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
  const internalHost = `${userName}-${randomHash}.${env.APPS_DOMAIN}`

  // Set up default domains
  const defaultDomains = process.env.NODE_ENV === 'development'
    ? [`${userName}-${randomHash}.localhost`, internalHost]
    : [internalHost]

  // Combine default and additional domains
  const domains = additionalDomains
    ? [...defaultDomains, ...additionalDomains]
    : defaultDomains

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

  const { pageCount } = await syncSite({
    files: assets,
    githubFolder: sanitizedGithubFolder || '',
    branchId,
    siteId,
    name,
    docsJson,
  })


  // adds support for hosing a site on a docs base path
  const cloudflareDomain = `${branchId}-docs-basepath.holocronsites.com`

  try {
    const zoneId = getZoneIdForDomain(cloudflareDomain)
    const cloudflareClient = new CloudflareClient({ zoneId })

    // Create the Cloudflare domain with custom origin
    await cloudflareClient.createDomain({
      domain: cloudflareDomain,
      customOriginServer: 'docs-basepath.holocronsites.com'
    })

    // Create domain record in database
    await prisma.domain.create({
      data: {
        host: cloudflareDomain,
        branchId,
        domainType: 'basepathDomain',
      },
    })

    console.log(`Created Cloudflare domain: ${cloudflareDomain}`)
  } catch (e) {
    console.error(`Failed to create Cloudflare domain: ${e}`)
    // Don't fail site creation if domain creation fails
  }

  // Add the Cloudflare domain to the domains array
  domains.push(cloudflareDomain)

  // Update docsJson with all domains including Cloudflare domain
  docsJson.domains = domains

  // Always create a chat for the branch
  const chat = await prisma.chat.create({
    data: {
      userId,
      branchId,
      title: null,
      currentSlug: null,
      filesInDraft: {},
    },
  })
  const chatId = chat.chatId

  return {
    siteId,
    branchId,
    chatId,
    docsJson,
    internalHost,
    domains,
    pageCount,
    cloudflareDomain,
  }
}
