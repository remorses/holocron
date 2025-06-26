import { openai, OpenAIResponsesProviderOptions } from '@ai-sdk/openai'
import { docsJsonSchema } from 'docs-website/src/lib/docs-json'

import dedent from 'string-dedent'

import { anthropic } from '@ai-sdk/anthropic'
import {
    appendResponseMessages,
    generateObject,
    Message,
    streamText,
    tool,
    UIMessage,
} from 'ai'
import { prisma } from 'db'
import { s3 } from 'docs-website/src/lib/s3'
import { Spiceflow } from 'spiceflow'
import { cors } from 'spiceflow/cors'
import { openapi } from 'spiceflow/openapi'
import { z } from 'zod'
import { getSession } from './better-auth'
import { env } from './env'
import { AppError, notifyError } from './errors'
import {
    createPullRequestSuggestion,
    getOctokit,
    pushToPrOrBranch,
} from './github.server'
import { filesFromGithub, syncSite } from './sync'
import { mdxRegex } from './utils'

import { processMdxInServer } from 'docs-website/src/lib/mdx.server'
import path from 'path'
import { printDirectoryTree } from '../components/directory-tree'
import {
    createEditExecute,
    editToolParamsSchema,
    fileUpdateSchema,
} from './edit-tool'
import {
    createRenderFormExecute,
    RenderFormParameters,
} from './render-form-tool'
import { generateMessageApp, getPageContent } from './spiceflow-generate-message'

// Create the main spiceflow app with comprehensive routes and features
export const app = new Spiceflow({ basePath: '/api' })
    // .state('env', {} as Env)
    // Health check endpoint
    .state('userId', '')
    .use(async ({ request, state }) => {
        const session = await getSession({ request })
        state.userId = session?.userId
    })
    .use(openapi())
    .use(cors())
    .route({
        method: 'GET',
        path: '/health',
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
        request: z.object({
            tabId: z.string(),
            githubPath: z.string(),
        }),
        async handler({ request, state: { userId } }) {
            let { tabId, githubPath } = await request.json()
            // Remove leading slash from githubPath, if present
            if (githubPath.startsWith('/')) {
                githubPath = githubPath.slice(1)
            }
            // First, check if the user can access the requested tab
            const tab = await prisma.tab.findFirst({
                where: {
                    tabId,
                    site: {
                        org: {
                            users: {
                                some: {
                                    userId,
                                },
                            },
                        },
                    },
                },
            })
            if (!tab) {
                throw new Error('You do not have access to this tab')
            }

            const content = await getPageContent({ githubPath, tabId })

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
        request: z.object({
            siteId: z.string().min(1, 'siteId is required'),
            // tabId: z.string().min(1, 'tabId is required'),
        }),
        async handler({ request, state: { userId } }) {
            const { siteId } = await request.json()

            if (!userId) {
                throw new Error('Missing x-user-id header')
            }
            const site = await prisma.site.findFirst({
                where: { siteId, org: { users: { some: { userId } } } },
                include: { tabs: true },
            })

            if (!site) {
                throw new Error('Site not found for this user')
            }
            const tab = site.tabs.find((x) => x)
            if (!tab) {
                throw new Error('Tab not found for this site')
            }
            const tabId = tab.tabId
            const orgId = site.orgId
            const name = site.name
            const pages = filesFromGithub({
                installationId: site.installationId,
                owner: site.githubOwner,
                repo: site.githubRepo,
                signal: request.signal,
                tabId,
                // forceFullSync: true,
            })
            await syncSite({
                orgId,
                siteId,
                tabId,
                name: site.name || '',
                trieveDatasetId: site.trieveDatasetId || undefined,
                pages,
            })
            // Implement your sync logic here
            // For now, just echo back the input
            return {
                success: true,
                siteId,
                tabId,
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
        request: z.object({
            key: z.string().min(1, 'Key is required'),
            contentType: z.string().optional(),
        }),
        async handler({ request, state }) {
            const body = await request.json()

            const signedUrl = s3.presign(body.key, {
                method: 'PUT',
            })

            const finalUrl = new URL(body.key, env.UPLOADS_BASE_URL).toString()

            return {
                success: true,
                path: body.key,
                signedUrl,
                finalUrl,
            }
        },
    })
    .route({
        method: 'POST',
        path: '/newChat',
        request: z.object({
            siteId: z.string(),
            orgId: z.string(),
        }),
        async handler({ request, state: { userId } }) {
            const { siteId, orgId } = await request.json()

            if (!userId) {
                throw new Error('User not authenticated')
            }

            // Check if user has access to this site through org membership
            const orgUser = await prisma.orgsUsers.findUnique({
                where: {
                    userId_orgId: {
                        userId,
                        orgId,
                    },
                },
            })

            if (!orgUser) {
                throw new Error('You do not have access to this organization')
            }

            // Verify the site exists and user has access
            const site = await prisma.site.findUnique({
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
                throw new Error('Site not found or access denied')
            }

            // Create a new chat
            const newChat = await prisma.chat.create({
                data: {
                    siteId,
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

    // currently not used
    .route({
        method: 'POST',
        path: '/submitRateFeedback',
        request: z.object({
            siteId: z.string().min(1, 'siteId is required'),
            url: z.string().min(1, 'url is required'),
            opinion: z.enum(['good', 'bad']),
            message: z.string().min(1, 'message is required'),
        }),
        async handler({ request, state: { userId } }) {
            const { siteId, url, opinion, message } = await request.json()

            // if (!userId) {
            //     throw new AppError('User not authenticated')
            // }

            // Check user has access to the site
            const site = await prisma.site.findFirst({
                where: {
                    siteId,
                    // org: {
                    //     users: {
                    //         some: { userId },
                    //     },
                    // },
                },
                include: {
                    githubInstallation: true,
                },
            })

            if (!site) {
                throw new AppError('Site not found or access denied')
            }

            const DocsCategory = 'Docs Feedback'
            let discussionUrl = `https://github.com/${site.githubOwner}/${site.githubRepo}/discussions`

            // Create GitHub discussion using GraphQL API
            if (site.githubInstallation?.oauthToken) {
                try {
                    const octokit = await getOctokit({
                        installationId: site.githubInstallation.installationId,
                    })

                    // Get repository info and discussion categories
                    const repositoryInfo: {
                        repository: {
                            id: string
                            discussionCategories: {
                                nodes: { id: string; name: string }[]
                            }
                        }
                    } = await octokit.graphql(`
                        query {
                            repository(owner: "${site.githubOwner}", name: "${site.githubRepo}") {
                                id
                                discussionCategories(first: 25) {
                                    nodes { id name }
                                }
                            }
                        }
                    `)

                    const repository = repositoryInfo.repository
                    const category = repository.discussionCategories.nodes.find(
                        (cat) => cat.name === DocsCategory,
                    )

                    if (!category) {
                        console.warn(
                            `Discussion category "${DocsCategory}" not found in repository`,
                        )
                        // Fall back to creating issue instead
                        const issueTitle = `Documentation feedback: ${url}`
                        const issueBody = `**Feedback Type:** ${opinion}\n**Page URL:** ${url}\n**User Message:**\n\n${message}\n\n> Forwarded from user feedback on docs site.`

                        const { data: issue } =
                            await octokit.rest.issues.create({
                                owner: site.githubOwner,
                                repo: site.githubRepo,
                                title: issueTitle,
                                body: issueBody,
                                labels: [
                                    'documentation',
                                    'feedback',
                                    opinion === 'bad' ? 'bug' : 'enhancement',
                                ],
                            })

                        discussionUrl = issue.html_url
                    } else {
                        const title = `Feedback for ${url}`
                        const body = `[${opinion}] ${message}\n\n> Forwarded from user feedback.`

                        // Search for existing discussion
                        const searchResult: {
                            search: {
                                nodes: { id: string; url: string }[]
                            }
                        } = await octokit.graphql(`
                            query {
                                search(type: DISCUSSION, query: ${JSON.stringify(`${title} in:title repo:${site.githubOwner}/${site.githubRepo}`)}, first: 1) {
                                    nodes {
                                        ... on Discussion { id, url }
                                    }
                                }
                            }
                        `)

                        const existingDiscussion = searchResult.search.nodes[0]

                        if (existingDiscussion) {
                            // Add comment to existing discussion
                            await octokit.graphql(`
                                mutation {
                                    addDiscussionComment(input: { body: ${JSON.stringify(body)}, discussionId: "${existingDiscussion.id}" }) {
                                        comment { id }
                                    }
                                }
                            `)
                            discussionUrl = existingDiscussion.url
                        } else {
                            // Create new discussion
                            const result: {
                                createDiscussion: {
                                    discussion: { id: string; url: string }
                                }
                            } = await octokit.graphql(`
                                mutation {
                                    createDiscussion(input: {
                                        repositoryId: "${repository.id}",
                                        categoryId: "${category.id}",
                                        body: ${JSON.stringify(body)},
                                        title: ${JSON.stringify(title)}
                                    }) {
                                        discussion { id, url }
                                    }
                                }
                            `)

                            discussionUrl =
                                result.createDiscussion.discussion.url
                        }
                    }
                } catch (error) {
                    console.error(
                        'Failed to create GitHub discussion for feedback:',
                        error,
                    )
                    // Don't throw error - feedback will still be saved
                }
            }

            // Store feedback in database
            await prisma.pageFeedback.create({
                data: {
                    siteId,
                    url,
                    opinion,
                    message,
                    discussionUrl,
                },
            })

            return {
                success: true,
                githubUrl: discussionUrl,
            }
        },
    })

    .route({
        method: 'POST',
        path: '/commitChangesToRepo',
        request: z.object({
            siteId: z.string().min(1, 'siteId is required'),
            filesInDraft: z.record(fileUpdateSchema),
        }),
        async handler({ request, state: { userId } }) {
            const { siteId, filesInDraft } = await request.json()

            if (!userId) {
                throw new AppError('Missing userId')
            }

            // Check user has access to the site
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
                    githubInstallation: true,
                },
            })

            if (!site) {
                throw new AppError('Site not found or access denied')
            }

            if (!site.githubInstallation) {
                throw new AppError('GitHub installation not found')
            }

            const installationId = site.githubInstallation.installationId
            const octokit = await getOctokit({ installationId })

            const owner = site.githubOwner
            const repo = site.githubRepo

            // Get the default branch of the repo
            const { data: repoData } = await octokit.rest.repos.get({
                owner,
                repo,
            })
            const branch = repoData.default_branch

            // Convert filesInDraft to files format
            const files = Object.entries(filesInDraft).map(
                ([filePath, fileUpdate]) => ({
                    filePath,
                    content: fileUpdate.content || '',
                }),
            )

            try {
                const result = await pushToPrOrBranch({
                    auth: site.githubInstallation.oauthToken || '',
                    files,
                    owner,
                    repo,
                    branch,
                })

                return {
                    prUrl: result.prUrl || '',
                    commitUrl: result.commitUrl || '',
                    githubAuthUrl: '',
                }
            } catch (error) {
                throw new AppError(`Failed to commit changes: ${error.message}`)
            }
        },
    })
    .route({
        method: 'POST',
        path: '/createPrSuggestionForChat',
        request: z.object({
            siteId: z.string().min(1, 'siteId is required'),
            chatId: z.string().min(1, 'chatId is required'),
            // branchId: z.string().min(1, 'branchId is required'),
            filesInDraft: z.record(fileUpdateSchema),
        }),
        async handler({ request, state }) {
            const { userId } = state
            const { siteId, filesInDraft, chatId } = await request.json()

            if (!userId) {
                throw new AppError('Missing userId')
            }

            // Check user has access to the site
            const [site, chat] = await Promise.all([
                prisma.site.findFirst({
                    where: {
                        siteId,
                        chats: {
                            some: {
                                chatId,
                            },
                        },
                        org: {
                            users: {
                                some: { userId },
                            },
                        },
                    },
                    include: {
                        githubInstallation: true,
                    },
                }),
                prisma.chat.findFirst({
                    where: {
                        chatId,
                        userId,
                    },
                }),
            ])

            if (!site) {
                throw new AppError('Site not found or access denied')
            }
            if (!chat) {
                throw new AppError('Chat not found or access denied')
            }
            if (!site.githubInstallation) {
                throw new AppError('GitHub installation for site not found')
            }
            const installationId = site.githubInstallation.installationId

            // Get GitHub installation
            const githubInstallation = site.githubInstallation

            if (!githubInstallation) {
                throw new AppError('Missing GitHub installation')
            }

            const octokit = await getOctokit({ installationId })

            if (!chat) {
                throw new AppError('Chat not found')
            }

            // Convert filesInDraft to files format
            const files = Object.entries(filesInDraft).map(
                ([filePath, fileUpdate]) => ({
                    filePath,
                    content: fileUpdate.content || '',
                }),
            )

            // If chat already has a PR, push to the existing PR branch
            if (chat.prNumber) {
                console.log(
                    `Chat ${chatId} has existing PR #${chat.prNumber}, attempting to push to existing PR`,
                )

                // Get the existing PR details
                const { data: existingPr } = await octokit.rest.pulls.get({
                    owner: site.githubOwner,
                    repo: site.githubRepo,
                    pull_number: chat.prNumber,
                })

                console.log(
                    `Found existing PR #${chat.prNumber} with branch: ${existingPr.head.ref}`,
                )

                // Push to the existing PR branch using pushToPrOrBranch
                const result = await pushToPrOrBranch({
                    auth: site.githubInstallation.oauthToken || '',
                    files,
                    owner: site.githubOwner,
                    repo: site.githubRepo,
                    branch: existingPr.head.ref,
                    message: chat.title || '',
                })

                console.log(
                    `Successfully pushed to existing PR #${chat.prNumber}`,
                )

                // Update chat with the new PR number
                await prisma.chat.update({
                    where: { chatId, userId },
                    data: {
                        lastPushedFiles: filesInDraft,
                    },
                })
                return { prUrl: result.prUrl || existingPr.html_url }
            }

            // Create a new PR (either first time or if existing PR was not found)
            console.log(`Creating new PR for chat ${chatId}`)

            const { data: repoData } = await octokit.rest.repos.get({
                owner: site.githubOwner,
                repo: site.githubRepo,
            })
            const branch = repoData.default_branch

            const { url, prNumber } = await createPullRequestSuggestion({
                files,
                octokit,
                owner: site.githubOwner,
                repo: site.githubRepo,
                branch,
                accountLogin: '',
                fork: false,
                title: chat.title || 'Update documentation',
                body:
                    (chat as any).description ??
                    'Updated content from FumaBase assistant.',
            })

            console.log(`Successfully created new PR #${prNumber} at ${url}`)

            // Update chat with the new PR number
            await prisma.chat.update({
                where: { chatId, userId },
                data: {
                    prNumber,
                    lastPushedFiles: filesInDraft,
                },
            })

            return { prUrl: url }
        },
    })
    .onError(({ error }) => {
        notifyError(error)
    })

export type SpiceflowApp = typeof app
