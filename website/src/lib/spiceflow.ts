import { ulid } from 'ulid'
import { defaultDocsJsonComments, defaultStartingHolocronJson } from 'docs-website/src/lib/docs-json-examples'

import { Prisma, prisma, Site } from 'db'
import { createSite } from './site'
import { getKeyForMediaAsset, getPresignedUrl, s3 } from 'docs-website/src/lib/s3'
import { preventProcessExitIfBusy, Spiceflow } from 'spiceflow'
import { cors } from 'spiceflow/cors'
import { openapi } from 'spiceflow/openapi'
import exampleDocs from 'website/scripts/example-docs.json'
import { z } from 'zod'
import { getSession } from './better-auth'
import { env } from './env'
import { AppError, notifyError } from './errors'
import { createPullRequestSuggestion, getOctokit, pushToPrOrBranch } from './github.server'
import { filesFromGithub, assetsFromFilesList, syncSite } from './sync'

import { createHash } from 'crypto'
import { fileUpdateSchema } from 'docs-website/src/lib/edit-tool'
import { generateMessageApp, getPageContent } from './spiceflow-generate-message'
import { DocsJsonType } from 'docs-website/src/lib/docs-json'
import { openai } from '@ai-sdk/openai'
import { experimental_transcribe as transcribe } from 'ai'
import { applyJsonCComments } from './json-c-comments'
import { filesSchema, publicApiApp } from './spiceflow-public-api'
import { FilesInDraft } from 'docs-website/src/lib/docs-state'


// Create the main spiceflow app with comprehensive routes and features
export const app = new Spiceflow({ basePath: '/api' })
  // .state('env', {} as Env)
  // Health check endpoint
  .state('userId', '')
  .use(preventProcessExitIfBusy())
  .use(async ({ request, state }) => {
    const session = await getSession({ request })
    state.userId = session?.userId
  })
  .use(openapi())
  .use(cors())
  .use(publicApiApp)
  .route({
    method: 'GET',
    path: '/health',
    detail: {
      hide: true,
    },
    handler() {
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      }
    },
  })
  .route({
    method: 'POST',
    path: '/getPageContent',
    detail: {
      hide: true,
    },
    request: z.object({
      branchId: z.string(),
      githubPath: z.string(),
    }),
    async handler({ request, state: { userId } }) {
      let { branchId, githubPath } = await request.json()
      // Remove leading slash from githubPath, if present
      if (githubPath.startsWith('/')) {
        githubPath = githubPath.slice(1)
      }
      // First, check if the branch exists and get site visibility
      const branch = await prisma.siteBranch.findFirst({
        where: {
          branchId,
        },
        include: {
          site: {
            include: {
              org: {
                include: {
                  users: true,
                },
              },
            },
          },
        },
      })

      if (!branch) {
        throw new Error('Branch not found')
      }

      const site = branch.site
      const isPublic = site.visibility === 'public'
      const isOrgMember = userId && site.org.users.some((u) => u.userId === userId)

      // For private sites, require user to be org member
      if (!isPublic && !isOrgMember) {
        throw new Error('You do not have access to this branch')
      }

      const content = await getPageContent({ githubPath, branchId })

      return {
        success: true,
        content,
      }
    },
  })
  .use(generateMessageApp)
  .route({
    method: 'POST',
    path: '/githubSync',
    detail: {
      hide: true,
    },
    request: z.object({
      siteId: z.string().min(1, 'siteId is required'),
      githubBranch: z.string().min(1, 'githubBranch is required'),
    }),
    async handler({ request, state: { userId } }) {
      const { siteId, githubBranch } = await request.json()

      if (!userId) {
        throw new AppError('Missing userId')
      }

      // Find site and check user access
      const site = await prisma.site.findFirst({
        where: {
          siteId,
          org: {
            users: {
              some: { userId },
            },
          },
        },
        include: {
          githubInstallations: {
            where: {
              appId: env.GITHUB_APP_ID!,
            },
          },
          branches: {
            where: {
              githubBranch,
            },
          },
        },
      })

      if (!site) {
        throw new AppError('Site not found or user has no access')
      }
      if (!site.githubOwner || !site.githubRepo) {
        throw new AppError('GitHub owner and repo must be set for the site')
      }

      // Find the branch for this GitHub branch
      const branch = site.branches[0]
      if (!branch) {
        throw new AppError(`Branch '${githubBranch}' not found for this site`)
      }

      const branchId = branch.branchId
      const orgId = site.orgId
      const name = site.name
      const installation = site.githubInstallations.find((x) => x.appId === env.GITHUB_APP_ID)
      const installationId = installation?.installationId
      if (!installationId) throw new AppError(`no installationId found for site`)
      const githubFolder = site.githubFolder || ''
      const pages = filesFromGithub({
        installationId,
        owner: site.githubOwner,
        repo: site.githubRepo,
        signal: request.signal,
        branchId,
        basePath: githubFolder,
        branch: githubBranch,
        forceFullSync: true,
      })
      const docsJson = (branch.docsJson || {}) as any
      const { pageCount } = await syncSite({
        siteId,
        githubFolder,
        branchId,
        name: site.name || '',
        files: pages,
        ignorePatterns: docsJson?.ignore || [],
      })

      await prisma.siteBranch.update({
        where: { branchId },
        data: {
          lastGithubSyncAt: new Date(),
          // lastGithubSyncCommit: latestCommit.commit.sha,
        },
      })

      return {
        success: true,
        siteId,
        branchId,
        githubBranch,
        message: 'Sync route called successfully',
      }
    },
  })
  // .route({
  //     method: 'POST',
  //     path: '/upload/*',

  //     async handler({ request, params: { '*': key }, state }) {
  //         const bucket = state.env.UPLOADS_BUCKET
  //         // TODO check that user can do this
  //         await bucket.put(key, request.body as any, {
  //             httpMetadata: request.headers as any,
  //         })
  //         return null
  //     },
  // })
  // .route({
  //     method: 'POST',
  //     path: '/createUploadSignedUrl',
  //     request: z.object({
  //         key: z.string().min(1, 'Key is required'),
  //         contentType: z.string().optional(),
  //     }),
  //     async handler({ request, state }) {
  //         const body = await request.json()

  //         // const signedUrl = s3.presign(body.key, {
  //         //     method: 'PUT',
  //         // })
  //         const signedUrl = this.safePath('/api/upload/*', { '*': body.key })
  //         const finalUrl = new URL(body.key, env.UPLOADS_BASE_URL).toString()

  //         return {
  //             success: true,
  //             path: body.key,
  //             signedUrl,
  //             finalUrl,
  //         }
  //     },
  // })
  .route({
    method: 'POST',
    path: '/createUploadSignedUrl',
    detail: {
      hide: true,
    },
    request: z.object({
      siteId: z.string().min(1, 'siteId is required'),
      // branchId: z.string().min(1, 'branchId is required'),
      files: z
        .array(
          z.object({
            slug: z.string().min(1, 'slug is required'),
            contentLength: z.number(),
            contentType: z.string().optional(),
          }),
        )
        .min(1, 'At least one file is required'),
    }),
    async handler({ request, state: { userId } }) {
      const body = await request.json()
      if (!userId) {
        throw new AppError('User not authenticated')
      }

      const signedFiles = await Promise.all(
        body.files.map(async (file) => {
          const key = getKeyForMediaAsset({
            siteId: body.siteId,
            slug: file.slug,
          })
          const signedUrl = await getPresignedUrl({
            method: 'PUT',
            key,
            headers: {
              'content-type': file.contentType,
              'Content-Length': file.contentLength,
            },
          })
          // console.log('signed', file.slug)
          const finalUrl = new URL(key, env.UPLOADS_BASE_URL).toString()
          return {
            path: file.slug,
            signedUrl,
            finalUrl,
          }
        }),
      )

      return {
        success: true,
        files: signedFiles,
      }
    },
  })
  .route({
    method: 'POST',
    path: '/newChat',
    detail: {
      hide: true,
    },
    request: z.object({
      branchId: z.string(),
      orgId: z.string(),
    }),
    async handler({ request, state: { userId } }) {
      const { branchId, orgId } = await request.json()

      // Require authentication
      if (!userId) {
        throw new Error('User not authenticated')
      }
      // throw new Error('User not authenticated')

      // Check if the branch exists and get site visibility
      const branch = await prisma.siteBranch.findFirst({
        where: {
          branchId,
        },
        include: {
          site: {
            include: {
              org: {
                include: {
                  users: true,
                },
              },
            },
          },
        },
      })

      if (!branch) {
        throw new Error('Branch not found')
      }

      const site = branch!.site
      const isPublic = site.visibility === 'public'
      const isOrgMember = site.org.users.some((u) => u.userId === userId)

      // For private sites, require user to be an org member
      // For public sites, any authenticated user can create a chat
      if (!isPublic && !isOrgMember) {
        throw new Error('You do not have access to this branch')
      }

      // Create a new chat
      const newChat = await prisma.chat.create({
        data: {
          branchId,
          userId,
          title: null,
          currentSlug: null,
          filesInDraft: {},
        },
      })

      return {
        success: true,
        chatId: newChat.chatId,
      }
    },
  })

  // .route({
  //     method: 'POST',
  //     path: '/commitChangesToRepo',
  //     request: z.object({
  //         branchId: z.string().min(1, 'branchId is required'),
  //         filesInDraft: z.record(z.string(), fileUpdateSchema),
  //     }),
  //     async handler({ request, state: { userId } }) {
  //         const { branchId, filesInDraft } = await request.json()

  //         if (!userId) {
  //             throw new AppError('Missing userId')
  //         }

  //         // Check user has access to the branch
  //         const commitBranch = await prisma.siteBranch.findFirst({
  //             where: {
  //                 branchId,
  //                 site: {
  //                     org: {
  //                         users: {
  //                             some: { userId },
  //                         },
  //                     },
  //                 },
  //             },
  //             include: {
  //                 site: {
  //                     include: {
  //                         githubInstallations: {
  //                             where: {
  //                                 appId: env.GITHUB_APP_ID,
  //                             },
  //                             include: {
  //                                 github: true,
  //                             },
  //                         },
  //                     },
  //                 },
  //             },
  //         })

  //         if (!commitBranch) {
  //             throw new AppError('Branch not found or access denied')
  //         }

  //         const site = commitBranch.site
  //         const githubInstallation = site.githubInstallations.find(
  //             (x) => x.appId === env.GITHUB_APP_ID,
  //         )
  //         if (!githubInstallation) {
  //             throw new AppError('GitHub installation not found')
  //         }

  //         const installationId = githubInstallation.installationId
  //         const octokit = await getOctokit({ installationId })

  //         if (!site.githubOwner || !site.githubRepo) {
  //             throw new AppError(
  //                 'GitHub owner and repo must be set for the site',
  //             )
  //         }
  //         const owner = site.githubOwner
  //         const repo = site.githubRepo

  //         // Get the default branch of the repo
  //         const { data: repoData } = await octokit.rest.repos.get({
  //             owner,
  //             repo,
  //         })
  //         const defaultBranch = repoData.default_branch

  //         // Convert filesInDraft to files format
  //         const files = Object.entries(filesInDraft).map(
  //             ([filePath, fileUpdate]) => ({
  //                 filePath,
  //                 content: fileUpdate?.content || '',
  //             }),
  //         )

  //         try {
  //             const result = await pushToPrOrBranch({
  //                 auth: githubInstallation?.github.oauthToken || '',
  //                 files,
  //                 owner,
  //                 repo,
  //                 branch: defaultBranch,
  //             })

  //             return {
  //                 prUrl: result.prUrl || '',
  //                 commitUrl: result.commitUrl || '',
  //                 githubAuthUrl: '',
  //             }
  //         } catch (error) {
  //             throw new AppError(`Failed to commit changes: ${error.message}`)
  //         }
  //     },
  // })
  .route({
    method: 'POST',
    path: '/updateChatFilesInDraft',
    detail: {
      hide: true,
    },
    request: z.object({
      chatId: z.string().min(1, 'chatId is required'),
      filesInDraft: z.record(z.string(), fileUpdateSchema),
      branchId: z.string().optional(),
    }),
    async handler({ request, state: { userId } }) {
      const { chatId, filesInDraft, branchId } = await request.json()

      if (!userId) {
        throw new AppError('Missing userId')
      }



      // Upsert chat - create if doesn't exist, update if exists
      await prisma.chat.upsert({
        where: { chatId, userId },
        update: {
          filesInDraft: filesInDraft as any,
        },
        create: {
          chatId,
          userId,
          branchId: branchId || '',
          filesInDraft: filesInDraft as any,
        },
      })

      return { success: true }
    },
  })
  .route({
    method: 'POST',
    path: '/saveChangesForChat',
    detail: {
      hide: true,
    },
    request: z.object({
      branchId: z.string().min(1, 'branchId is required'),
      chatId: z.string().min(1, 'chatId is required'),
      filesInDraft: z.record(z.string(), fileUpdateSchema),
    }),
    async handler({ request, state }) {
      const { userId } = state
      const { branchId, filesInDraft, chatId } = await request.json()

      if (!userId) {
        throw new AppError('Missing userId')
      }
      // throw new Error('test')

      // Check user has access to the branch through chat
      const [branch, chat] = await Promise.all([
        prisma.siteBranch.findFirst({
          where: {
            branchId,
            site: {
              org: {
                users: {
                  some: { userId },
                },
              },
            },
          },
          include: {
            site: true,
          },
        }),
        prisma.chat.findFirst({
          where: {
            chatId,
            userId,
            branchId,
          },
        }),
      ])

      if (!branch) {
        throw new AppError('Branch not found or access denied')
      }
      if (!chat) {
        throw new AppError('Chat not found or access denied')
      }

      const site = branch.site

      // Convert filesInDraft to files array for syncSite
      const files = Object.entries(filesInDraft)
        .filter(([_, fileUpdate]) => fileUpdate?.content !== undefined)
        .map(([filePath, fileUpdate]) => ({
          relativePath: filePath,
          contents: fileUpdate?.content || '',
        }))

      // Convert files to assets generator
      // Only include files that are actually modified - no defaults
      const assets = assetsFromFilesList({
        files,
        githubFolder: site.githubFolder || '',
      })

      // Get current docsJson for syncSite (needed for ignore patterns)
      const docsJson = (branch.docsJson || {}) as DocsJsonType

      // Sync the files as markdown pages
      const { pageCount } = await syncSite({
        files: assets,
        githubFolder: site.githubFolder || '',
        branchId,
        siteId: site.siteId,
        name: site.name || '',
        ignorePatterns: (docsJson)?.ignore || [],
      })

      // Update chat with the saved files
      await prisma.chat.update({
        where: { chatId, userId },
        data: {
          lastPushedFiles: filesInDraft as any,
          filesInDraft: filesInDraft as any,
        },
      })

      return { success: true }
    },
  })
  .route({
    method: 'POST',
    path: '/getCliSession',
    detail: {
      hide: true,
    },
    request: z.object({
      secret: z.string().regex(/^\d{6}$/, 'Secret must be a 6-digit code'),
    }),
    async handler({ request }) {
      const { secret } = await request.json()

      // Find the CLI login session
      const session = await prisma.cliLoginSession.findUnique({
        where: { secret },
        include: {
          user: {
            include: {
              orgs: {
                include: {
                  org: true,
                },
              },
            },
          },
        },
      })

      if (!session) {
        return {}
      }

      // Check if session is expired
      if (new Date() > session.expiresAt) {
        // Clean up expired session
        await prisma.cliLoginSession.delete({
          where: { secret },
        })
        throw new AppError('Session expired')
      }

      // Return the API key and user info if session has an API key
      if (!session.apiKey) {
        throw new AppError('Session not ready yet')
      }

      return {
        apiKey: session.apiKey,
        userId: session.userId,
        userEmail: session.user.email,
        orgs: session.user.orgs.map(({ org }) => ({
          orgId: org.orgId,
          name: org.name,
        })),
      }
    },
  })
  .route({
    method: 'POST',
    path: '/upsertSiteFromFiles',
    detail: {
      hide: true,
    },
    request: z.object({
      name: z.string().min(1, 'Name is required'),
      files: filesSchema,
      orgId: z.string().min(1, 'Organization ID is required'),
      githubOwner: z.string().optional(),
      githubRepo: z.string().optional(),
      githubRepoId: z.number().optional(),
      githubBranch: z.string().optional(),
      githubFolder: z.string().optional(),
      siteId: z.string().optional(),
    }),
    async handler({ request, state: { userId } }) {
      let { name, files, orgId, githubOwner, githubRepo, githubRepoId, githubBranch, githubFolder, siteId } =
        await request.json()

      if (!userId) {
        throw new AppError('User not authenticated')
      }

      // Check if user has access to the organization
      const orgUser = await prisma.orgsUsers.findFirst({
        where: {
          userId,
          orgId,
        },
      })

      if (!orgUser) {
        throw new AppError('Access denied to organization')
      }

      let finalSiteId: string
      let finalBranchId: string

      if (siteId) {
        // Update existing site
        const existingSite = await prisma.site.findFirst({
          where: {
            siteId,
            org: {
              users: {
                some: { userId },
              },
            },
          },
          include: {
            branches: {
              where: {
                githubBranch: githubBranch || 'main',
              },
            },
          },
        })

        if (!existingSite) {
          throw new AppError('Site not found or access denied')
        }

        if (githubFolder === '.') {
          githubFolder = ''
        }

        // Update site info
        const site = await prisma.site.update({
          where: { siteId },
          data: {
            name,
            githubOwner: githubOwner || existingSite.githubOwner,
            githubRepo: githubRepo || existingSite.githubRepo,
            githubRepoId: githubRepoId || existingSite.githubRepoId || 0,
            githubFolder: githubFolder || existingSite.githubFolder,
          },
        })

        finalSiteId = siteId

        // Find or create branch for this GitHub branch
        let branch = existingSite.branches[0]
        if (!branch) {
          branch = await prisma.siteBranch.create({
            data: {
              branchId: ulid(),
              siteId,
              title: 'Main',
              githubBranch: githubBranch || 'main',
            },
          })
        }
        finalBranchId = branch.branchId
      } else {
        // Create new site using createSite helper
        const result = await createSite({
          name,
          orgId,
          userId,
          githubOwner,
          githubRepo,
          githubRepoId,
          githubFolder,
          githubBranch: githubBranch || 'main',
          files, // Pass the files directly
        })

        finalSiteId = result.siteId
        finalBranchId = result.branchId
      }

      let pageCount: number

      // For updates (existing sites), we need to sync again
      if (siteId) {
        // Fetch the branch's latest docsJson (needed for syncSite's ignore patterns)
        const branch = await prisma.siteBranch.findFirst({
          where: { branchId: finalBranchId },
        })
        const docsJson = branch?.docsJson as DocsJsonType

        // Convert files to pages format
        const assets = assetsFromFilesList({
          files,
          githubFolder: githubFolder || '',
        })

        const syncResult = await syncSite({
          files: assets,
          githubFolder: githubFolder || '',
          branchId: finalBranchId,
          siteId: finalSiteId,
          name,
          ignorePatterns: (docsJson as any)?.ignore || [],
        })
        pageCount = syncResult.pageCount
      } else {
        // For new sites, createSite already synced the files
        const result = await prisma.markdownPage.count({
          where: { branchId: finalBranchId },
        })
        pageCount = result
      }

      // Get the generated docsJson and any sync errors
      const [branch, syncErrors] = await Promise.all([
        prisma.siteBranch.findUnique({
          where: { branchId: finalBranchId },
          include: {
            site: true,
          },
        }),
        prisma.markdownPageSyncError.findMany({
          where: {
            page: {
              branchId: finalBranchId,
            },
          },
          include: {
            page: {
              select: {
                githubPath: true,
                slug: true,
              },
            },
          },
        }),
      ])

      const errors = syncErrors.map((error) => ({
        githubPath: error.page.githubPath,
        line: error.line,
        errorMessage: error.errorMessage,
        errorType: error.errorType,
      }))

      // Get docsJsonComments from the branch
      const branchDocsJsonComments = (branch?.docsJsonComments || {}) as any

      const docsJsonWithComments = applyJsonCComments(branch?.docsJson || {}, {
        ...defaultDocsJsonComments,
        ...branchDocsJsonComments,
      })

      return {
        ...(branch?.site || {}),
        success: true,
        docsJsonWithComments,
        siteId: finalSiteId,
        branchId: finalBranchId,
        docsJson: (branch?.docsJson || {}) as DocsJsonType,
        errors,
      }
    },
  })
  .route({
    method: 'GET',
    path: '/getStarterTemplate',
    detail: {
      hide: true,
    },
    async handler() {
      return {
        success: true,
        files: exampleDocs,
      }
    },
  })
  .route({
    method: 'POST',
    path: '/transcribeAudio',
    detail: {
      hide: true,
    },
    async handler({ request, state: { userId } }) {
      // no auth so this can be used from docs websites
      // if (!userId) {
      //     throw new AppError('User not authenticated')
      // }

      const formData = await request.formData()
      const audioFile = formData.get('audio') as File | null

      if (!audioFile) {
        throw new AppError('No audio file provided')
      }

      // Validate file type
      if (!audioFile.type.startsWith('audio/')) {
        throw new AppError('Invalid file type. Please provide an audio file.')
      }

      try {
        // Convert File to Buffer for the ai package
        const arrayBuffer = await audioFile.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Use the ai package to transcribe
        const result = await transcribe({
          model: openai.transcription('gpt-4o-transcribe'),
          providerOptions: {
            openai: {
              temperature: 0,
              timestampGranularities: ['word'],
            },
          },
          audio: buffer,
        })

        return {
          success: true,
          text: result.text,
        }
      } catch (error) {
        notifyError(error, 'Transcription error')
        throw new AppError(`Failed to transcribe audio: ${error.message}`)
      }
    },
  })
  .route({
    method: 'POST',
    path: '/getRepoBranches',
    detail: {
      hide: true,
    },
    request: z.object({
      orgId: z.string().min(1, 'orgId is required'),
      owner: z.string().min(1, 'owner is required'),
      repo: z.string().min(1, 'repo is required'),
      installationId: z.number().min(1, 'installationId is required'),
    }),
    async handler({ request, state: { userId } }) {
      const { orgId, owner, repo, installationId } = await request.json()

      if (!userId) {
        throw new AppError('User not authenticated')
      }

      // Check if user has access to the organization
      const orgUser = await prisma.orgsUsers.findFirst({
        where: {
          userId,
          orgId,
        },
      })

      if (!orgUser) {
        throw new AppError('Access denied to organization')
      }

      // Verify the installation belongs to the org
      const githubInstallation = await prisma.githubInstallation.findFirst({
        where: {
          installationId,
          appId: env.GITHUB_APP_ID,
          orgs: {
            some: {
              orgId,
            },
          },
        },
      })

      if (!githubInstallation) {
        throw new AppError('GitHub installation not found or access denied')
      }

      const octokit = await getOctokit({
        installationId,
      })

      // Get repository info including default branch
      const { data: repoData } = await octokit.rest.repos.get({
        owner,
        repo,
      })

      // Get all branches
      const { data: branches } = await octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: 100,
      })

      // Sort branches: default first, then by commit date
      const sortedBranches = branches.sort((a, b) => {
        // Default branch always first
        if (a.name === repoData.default_branch) return -1
        if (b.name === repoData.default_branch) return 1
        // Otherwise keep original order (GitHub returns them by last pushed)
        return 0
      })

      return {
        success: true,
        branches: sortedBranches.map((b) => ({
          name: b.name,
          isDefault: b.name === repoData.default_branch,
        })),
        defaultBranch: repoData.default_branch,
      }
    },
  })
  .route({
    method: 'POST',
    path: '/updateSiteVisibility',
    detail: {
      hide: true,
    },
    request: z.object({
      siteId: z.string().min(1, 'siteId is required'),
      visibility: z.enum(['public', 'private']),
    }),
    async handler({ request, state: { userId } }) {
      const { siteId, visibility } = await request.json()

      if (!userId) {
        throw new AppError('User not authenticated')
      }

      // Find site and check user access
      const site = await prisma.site.findFirst({
        where: {
          siteId,
          org: {
            users: {
              some: { userId },
            },
          },
        },
      })

      if (!site) {
        throw new AppError('Site not found or user has no access')
      }

      // Update site visibility
      const updatedSite = await prisma.site.update({
        where: { siteId },
        data: { visibility },
      })

      return {
        success: true,
        siteId,
        visibility: updatedSite.visibility,
        message: `Site visibility updated to ${visibility}`,
      }
    },
  })
  .route({
    method: 'POST',
    path: '/deleteWebsite',
    detail: {
      hide: true,
    },
    request: z.object({
      siteId: z.string().min(1, 'siteId is required'),
    }),
    async handler({ request, state: { userId } }) {
      const { siteId } = await request.json()

      if (!userId) {
        throw new AppError('User not authenticated')
      }

      // Find site and check user access
      const site = await prisma.site.findFirst({
        where: {
          siteId,
          org: {
            users: {
              some: { userId },
            },
          },
        },
        include: {
          branches: true,
        },
      })

      if (!site) {
        throw new AppError('Site not found or user has no access')
      }

      // Delete the site and all related data (cascading deletes will handle branches, pages, etc.)
      await prisma.site.delete({
        where: { siteId },
      })

      return {
        success: true,
        message: `Site "${site.name}" has been deleted successfully`,
        siteId,
      }
    },
  })
  .route({
    method: 'POST',
    path: '/getBranchFilesWithHashes',
    detail: {
      hide: true,
    },
    request: z.object({
      branchId: z.string(),
    }),
    async handler({ request, state: { userId } }) {
      const { branchId } = await request.json()

      const branch = await prisma.siteBranch.findFirst({
        where: {
          branchId,
          OR: [
            {
              site: {
                org: {
                  users: {
                    some: { userId },
                  },
                },
              },
            },
            {
              site: {
                visibility: 'public',
              },
            },
          ],
        },
        include: {
          site: true,
        },
      })

      if (!branch) {
        throw new AppError('Branch not found or you do not have access')
      }

      const [pages, metaFiles, mediaAssets] = await Promise.all([
        prisma.markdownPage.findMany({
          where: { branchId },
          select: {
            githubPath: true,
            githubSha: true,
          },
        }),
        prisma.metaFile.findMany({
          where: { branchId },
          select: {
            githubPath: true,
            githubSha: true,
          },
        }),
        prisma.mediaAsset.findMany({
          where: { branchId },
          select: {
            githubPath: true,
            githubSha: true,
          },
        }),
      ])

      const files = [
        ...pages.map((page) => ({
          githubPath: page.githubPath,
          sha1: page.githubSha || '',
        })),
        ...metaFiles.map((meta) => ({
          githubPath: meta.githubPath,
          sha1: meta.githubSha,
        })),
        ...mediaAssets.map((asset) => ({
          githubPath: asset.githubPath,
          sha1: asset.githubSha,
        })),
      ]

      // Include docsJson hash
      const docsJsonContent = branch.docsJsonComments
        ? applyJsonCComments(branch.docsJson, branch.docsJsonComments as any, 2)
        : JSON.stringify(branch.docsJson, null, 2)
      const docsJsonPath = branch.site?.githubFolder ? `${branch.site.githubFolder}/holocron.jsonc` : 'holocron.jsonc'
      files.push({
        githubPath: docsJsonPath,
        sha1: createHash('sha1').update(docsJsonContent, 'utf-8').digest('hex'),
      })

      if (branch.cssStyles) {
        const cssPath = branch.site?.githubFolder ? `${branch.site.githubFolder}/styles.css` : 'styles.css'
        files.push({
          githubPath: cssPath,
          sha1: createHash('sha1').update(branch.cssStyles, 'utf-8').digest('hex'),
        })
      }

      return {
        files,
      }
    },
  })
  .route({
    method: 'POST',
    path: '/getOrCreateDevChat',
    detail: {
      hide: true,
    },
    request: z.object({
      siteId: z.string(),
      branchId: z.string().optional(),
    }),
    async handler({ request, state: { userId } }) {
      let { siteId, branchId } = await request.json()

      if (!userId) {
        throw new AppError('User not authenticated')
      }

      let branch

      if (branchId) {
        branch = await prisma.siteBranch.findFirst({
          where: {
            branchId,
            site: {
              siteId,
              org: {
                users: {
                  some: { userId },
                },
              },
            },
          },
        })
      } else {
        branch = await prisma.siteBranch.findFirst({
          where: {
            site: {
              siteId,
              org: {
                users: {
                  some: { userId },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        })
      }

      if (!branch) {
        throw new AppError('Branch not found or you do not have access')
      }

      let chat = await prisma.chat.findFirst({
        where: {
          userId,
          branchId: branch.branchId,
          title: '__dev_session__',
        },
      })

      if (!chat) {
        chat = await prisma.chat.create({
          data: {
            chatId: ulid(),
            userId,
            branchId: branch.branchId,
            title: '__dev_session__',
            type: 'hidden',
            filesInDraft: {},
          },
        })
      }

      return {
        chatId: chat.chatId,
        branchId: branch.branchId,
        filesInDraft: (chat.filesInDraft as FilesInDraft) || {},
      }
    },
  })

  .route({
    method: 'POST',
    path: '/databaseNightlyCleanup',
    detail: {
      hide: true,
    },
    request: z.object({
      SERVICE_SECRET: z.string().min(1, 'SERVICE_SECRET is required'),
    }),
    async handler({ request }) {
      const { SERVICE_SECRET } = await request.json()

      // Validate the secret key
      if (!env.SERVICE_SECRET || SERVICE_SECRET !== env.SERVICE_SECRET) {
        throw new AppError('Invalid secret key')
      }

      // Find all MarkdownBlob records that have no connected pages
      const orphanedBlobs = await prisma.markdownBlob.findMany({
        where: {
          pages: {
            none: {},
          },
        },
        select: {
          githubSha: true,
        },
      })

      if (orphanedBlobs.length === 0) {
        return {
          success: true,
          message: 'No orphaned blobs found',
          deletedCount: 0,
        }
      }

      // Delete the orphaned blobs
      const deleteResult = await prisma.markdownBlob.deleteMany({
        where: {
          githubSha: {
            in: orphanedBlobs.map((blob) => blob.githubSha),
          },
        },
      })

      console.log(`Database cleanup: deleted ${deleteResult.count} orphaned MarkdownBlob records`)

      return {
        success: true,
        message: `Successfully deleted ${deleteResult.count} orphaned MarkdownBlob records`,
        deletedCount: deleteResult.count,
      }
    },
  })
  .onError(({ error, request, path }) => {
    notifyError(error, `spiceflow api error in ${request.url}`)
  })

export type SpiceflowApp = typeof app
