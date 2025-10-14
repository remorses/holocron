import { z } from 'zod'
import { prisma, Prisma } from 'db'
import { Spiceflow } from 'spiceflow'
import { cors } from 'spiceflow/cors'
import { openapi } from 'spiceflow/openapi'
import { createSite } from './site'
import { AppError, notifyError } from './errors'
import { assetsFromFilesList, syncSite } from './sync'
import { defaultDocsJsonComments } from 'docs-website/src/lib/docs-json-examples'
import { DocsJsonType } from 'docs-website/src/lib/docs-json'
import { CloudflareClient, getZoneIdForDomain } from './cloudflare'
import dedent from 'string-dedent'

import { client as searchApi } from 'docs-website/src/lib/search-api'
import { HolocronSite } from '@holocron.so/cli/src'

// Export schemas for reuse
export const filesSchema = z.array(
  z.object({
    relativePath: z.string(),
    contents: z.string(),
    downloadUrl: z.string().optional(),
    metadata: z
      .object({
        width: z.number().optional(),
        height: z.number().optional(),
      })
      .optional(),
  }),
)

export const publicApiApp = new Spiceflow({ basePath: '/v1', disableSuperJsonUnlessRpc: true })
  .state('apiKey', '')
  .state('userId', '')
  .state('orgId', '')
  .use(cors())
  .use(openapi())
  .use(async ({ request, state }, next) => {
    const apiKey = request.headers.get('x-api-key')

    if (!apiKey) {
      throw new Response(JSON.stringify({ error: 'API key required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const userSession = await prisma.cliLoginSession.findFirst({
      where: { apiKey },
      include: {
        user: {
          include: {
            orgs: {
              include: {
                org: true
              }
            }
          }
        }
      }
    })

    if (!userSession) {
      throw new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    state.apiKey = apiKey
    state.userId = userSession.userId
    state.orgId = userSession.user.orgs[0]?.orgId || ''

    if (!state.orgId) {
      throw new Response(JSON.stringify({ error: 'User has no organization, create one first' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return next()
  })
  .route({
    method: 'POST',
    path: '/sites/create',
    detail: {
      summary: 'Create a new documentation site',
      description: 'Creates a new site with the provided files and configuration'
    },
    request: z.object({
      name: z.string().min(1, 'Name is required'),
      orgId: z.string().min(1, 'Organization ID is required'),
      files: filesSchema,
      githubOwner: z.string().optional(),
      githubRepo: z.string().optional(),
      githubRepoId: z.number().optional(),
      githubBranch: z.string().optional(),
      githubFolder: z.string().optional(),
      metadata: z.record(z.string(), z.any()).optional()
    }),
    async handler({ request, state }) {
      const body = await request.json()
      const { name, orgId, files, githubOwner, githubRepo, githubRepoId, githubBranch, githubFolder, metadata } = body

      const userOrgAccess = await prisma.orgsUsers.findFirst({
        where: {
          userId: state.userId,
          orgId
        }
      })

      if (!userOrgAccess) {
        throw new Response(JSON.stringify({ error: 'Access denied to organization' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const result = await createSite({
        name,
        orgId,
        userId: state.userId,
        githubOwner,
        githubRepo,
        githubRepoId,
        githubFolder,
        githubBranch: githubBranch || 'main',
        files,
        metadata
      })

      const [branch, syncErrors] = await Promise.all([
        prisma.siteBranch.findUnique({
          where: { branchId: result.branchId }
        }),
        prisma.markdownPageSyncError.findMany({
          where: {
            page: {
              branchId: result.branchId
            }
          },
          include: {
            page: {
              select: {
                githubPath: true,
                slug: true
              }
            }
          }
        })
      ])

      const errors = syncErrors.map((error) => ({
        githubPath: error.page.githubPath,
        line: error.line,
        errorMessage: error.errorMessage,
        errorType: error.errorType
      }))

      return {
        success: true,
        siteId: result.siteId,
        branchId: result.branchId,
        chatId: result.chatId,
        docsJson: (branch?.docsJson || {}) as DocsJsonType,
        errors
      }
    }
  })
  .route({
    method: 'POST',
    path: '/sites/sync',
    detail: {
      summary: 'Sync files to an existing site',
      description: 'Updates an existing site with new or modified files'
    },
    request: z.object({
      siteId: z.string(),
      files: filesSchema,
    }),
    async handler({ request, state }) {
      const body = await request.json()
      const { files, siteId } = body

      const site = await prisma.site.findFirst({
        where: {
          siteId,
          org: {
            users: {
              some: { userId: state.userId }
            }
          }
        },
        include: {
          branches: {
            orderBy: { createdAt: 'asc' },

            take: 1
          },
        }
      })

      if (!site) {
        throw new Response(JSON.stringify({ error: 'Site not found or access denied' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Get the first (and only) branch
      const branch = site.branches[0]
      if (!branch) {
        throw new Response(JSON.stringify({ error: 'No branch found for site' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const docsJson = (branch.docsJson || {}) as DocsJsonType

      const assets = assetsFromFilesList({
        files,
        githubFolder: site.githubFolder || '',
      })

      const { pageCount } = await syncSite({
        files: assets,
        githubFolder: site.githubFolder || '',
        branchId: branch.branchId,
        siteId,
        name: site.name || '',
        ignorePatterns: (docsJson)?.ignore || []
      })

      await prisma.siteBranch.update({
        where: { branchId: branch.branchId },
        data: {
          lastGithubSyncAt: new Date()
        }
      })

      const [updatedBranch, syncErrors] = await Promise.all([
        prisma.siteBranch.findUnique({
          where: { branchId: branch.branchId }
        }),
        prisma.markdownPageSyncError.findMany({
          where: {
            page: {
              branchId: branch.branchId
            }
          },
          include: {
            page: {
              select: {
                githubPath: true,
                slug: true
              }
            }
          }
        })
      ])

      const errors = syncErrors.map((error) => ({
        githubPath: error.page.githubPath,
        line: error.line,
        errorMessage: error.errorMessage,
        errorType: error.errorType
      }))

      return {
        success: true,
        siteId,
        branchId: branch.branchId,
        pageCount,
        docsJson: (updatedBranch?.docsJson || {}) as DocsJsonType,
        errors
      }
    }
  })
  .route({
    method: 'POST',
    path: '/sites/deleteFiles',
    detail: {
      summary: 'Delete files from a site',
      description: 'Deletes specified files from the site and syncs the changes'
    },
    request: z.object({
      siteId: z.string(),
      filePaths: z.array(z.string()).min(1, 'At least one file path is required')
    }),
    async handler({ request, state }) {
      const body = await request.json()
      const { filePaths, siteId } = body

      const site = await prisma.site.findFirst({
        where: {
          siteId,
          org: {
            users: {
              some: { userId: state.userId }
            }
          }
        },
        include: {
          branches: {
            orderBy: { createdAt: 'asc' },
            take: 1
          }
        }
      })

      if (!site) {
        throw new Response(JSON.stringify({ error: 'Site not found or access denied' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Get the first (and only) branch
      const branch = site.branches[0]
      if (!branch) {
        throw new Response(JSON.stringify({ error: 'No branch found for site' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Delete pages with the specified githubPaths
      const deletedPages = await prisma.markdownPage.deleteMany({
        where: {
          branchId: branch.branchId,
          githubPath: {
            in: filePaths
          }
        }
      })

      // Delete media assets with the specified githubPaths
      const deletedMediaAssets = await prisma.mediaAsset.deleteMany({
        where: {
          branchId: branch.branchId,
          githubPath: {
            in: filePaths
          }
        }
      })

      // Delete meta files with the specified githubPaths
      const deletedMetaFiles = await prisma.metaFile.deleteMany({
        where: {
          branchId: branch.branchId,
          githubPath: {
            in: filePaths
          }
        }
      })

      // Delete files from search API
      if (filePaths.length > 0) {
        try {
          await searchApi.deleteFiles({
            datasetId: branch.branchId,
            filenames: filePaths
          })
        } catch (error) {
          console.error('Error deleting files from search API:', error)
          notifyError(error, 'search API delete in public API')
        }
      }

      const totalDeleted = deletedPages.count + deletedMediaAssets.count + deletedMetaFiles.count

      return {
        success: true,
        deletedCount: totalDeleted,
        deletedPages: deletedPages.count,
        deletedMediaAssets: deletedMediaAssets.count,
        deletedMetaFiles: deletedMetaFiles.count
      }
    }
  })
  .route({
    method: 'POST',
    path: '/sites/update',
    detail: {
      summary: 'Update site configuration',
      description: 'Updates site metadata and configuration'
    },
    request: z.object({
      siteId: z.string(),
      name: z.string().optional(),
      visibility: z.enum(['public', 'private']).optional(),
      githubOwner: z.string().optional(),
      githubRepo: z.string().optional(),
      githubFolder: z.string().optional(),
      metadata: z.record(z.string(), z.any()).optional()
    }),
    async handler({ request, state }) {
      const body = await request.json()
      const { siteId } = body

      const site = await prisma.site.findFirst({
        where: {
          siteId,
          org: {
            users: {
              some: { userId: state.userId }
            }
          }
        }
      })

      if (!site) {
        throw new Response(JSON.stringify({ error: 'Site not found or access denied' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const updatedSite = await prisma.site.update({
        where: { siteId },
        data: {
          ...(body.name && { name: body.name }),
          ...(body.visibility && { visibility: body.visibility }),
          ...(body.githubOwner && { githubOwner: body.githubOwner }),
          ...(body.githubRepo && { githubRepo: body.githubRepo }),
          ...(body.githubFolder !== undefined && { githubFolder: body.githubFolder }),
          ...(body.metadata !== undefined && { metadata: body.metadata })
        }
      })

      return {
        success: true,
        siteId: updatedSite.siteId,
        name: updatedSite.name || '',
        visibility: updatedSite.visibility
      }
    }
  })
  .route({
    method: 'POST',
    path: '/sites/list',
    detail: {
      summary: 'List all sites',
      description: dedent`
        Returns all sites accessible to the authenticated user with optional JSON metadata filtering.

        Example: to filter sites where metadata.users array contains an object with exact match:
        {
          "metadata": {
            "path": ["users"],
            "array_contains": { "userId": "user-123", "role": "admin" }
          }
        }

        Note: array_contains requires exact object match (all fields must match). Field order doesn't matter.

        For partial matching (e.g., any object with userId="user-123" regardless of other fields),
        Prisma's JsonFilter doesn't support this. You would need to use PostgreSQL's @> operator directly
        with raw SQL: metadata->'users' @> '[{"userId": "user-123"}]'

        Other examples:
        - Simple field match: { "metadata": { "path": ["environment"], "equals": "production" } }
        - Nested field: { "metadata": { "path": ["config", "theme"], "equals": "dark" } }
      `
    },
    request: z.object({
      metadata: z.any() as z.ZodType<Prisma.JsonFilter<'Site'> | undefined>
    }),
    async handler({ request, state }) {
      const { metadata: metadataFilter } = await request.json()

      const sites = await prisma.site.findMany({
        where: {
          org: {
            users: {
              some: { userId: state.userId }
            }
          },
          ...(metadataFilter && { metadata: metadataFilter })
        },
        orderBy: { createdAt: 'desc' }
      })

      return {
        success: true,
        sites: sites.map(site => ({
          siteId: site.siteId,
          name: site.name,
          visibility: site.visibility,
          githubOwner: site.githubOwner,
          githubRepo: site.githubRepo,
          githubFolder: site.githubFolder,
          metadata: site.metadata,
          createdAt: site.createdAt
        }))
      }
    }
  })
  .route({
    method: 'POST',
    path: '/sites/get',
    detail: {
      summary: 'Get site details',
      description: 'Returns detailed information about a specific site including docsJson'
    },
    request: z.object({
      siteId: z.string()
    }),
    async handler({ request, state }) {
      const body = await request.json()
      const { siteId } = body

      const site = await prisma.site.findFirst({
        where: {
          siteId,
          org: {
            users: {
              some: { userId: state.userId }
            }
          }
        },
        include: {
          branches: {
            orderBy: { createdAt: 'asc' },
            include: {
              domains: true,
            },
            take: 1
          }
        }
      })

      if (!site) {
        throw new Response(JSON.stringify({ error: 'Site not found or access denied' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      const branch = site.branches[0]

      const data = {
        ...site,
        metadata: site.metadata as Record<string, any>,
        branch: { ...branch, docsJson: branch.docsJson as DocsJsonType, docsJsonComments: branch.docsJsonComments as Record<string, any> },
        domains: branch?.domains || [],
      } satisfies HolocronSite
      return data
    }
  })
  .route({
    method: 'POST',
    path: '/sites/delete',
    detail: {
      summary: 'Delete a site',
      description: 'Permanently deletes a site and all associated data including domains'
    },
    request: z.object({
      siteId: z.string()
    }),
    async handler({ request, state }) {
      const body = await request.json()
      const { siteId } = body

      const site = await prisma.site.findFirst({
        where: {
          siteId,
          org: {
            users: {
              some: { userId: state.userId }
            }
          }
        },
        include: {
          branches: {
            include: {
              domains: true
            }
          }
        }
      })

      if (!site) {
        throw new Response(JSON.stringify({ error: 'Site not found or access denied' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Delete all domains from Cloudflare
      for (const branch of site.branches) {
        for (const domain of branch.domains) {
          try {
            const zoneId = getZoneIdForDomain(domain.host)
            if (zoneId) {
              const cloudflareClient = new CloudflareClient({ zoneId })
              await cloudflareClient.removeDomain(domain.host)
              console.log(`Deleted domain ${domain.host} from Cloudflare`)
            }
          } catch (error) {
            console.error(`Error deleting domain ${domain.host} from Cloudflare:`, error)
            notifyError(error, `Failed to delete domain ${domain.host} from Cloudflare`)
          }
        }
      }

      // Delete the site (cascading deletes will handle branches, pages, domains, etc.)
      await prisma.site.delete({
        where: { siteId }
      })

      return {
        success: true,
        message: `Site "${site.name}" has been deleted successfully`
      }
    }
  })
  .onError(({ error, request }) => {
    notifyError(error, `Public API error: ${request.method} ${request.url}`)

    throw new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  })

export type PublicApiApp = typeof publicApiApp
