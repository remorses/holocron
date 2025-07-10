import { Route } from './+types/api.github.webhooks-worker'
import JSONC from 'tiny-jsonc'
import { Spiceflow } from 'spiceflow'
import { z } from 'zod'
import { prisma } from 'db'
import { env } from 'website/src/lib/env'
import { notifyError } from 'website/src/lib/errors'
import { generateSlugFromPath } from 'docs-website/src/lib/utils'
import { isMarkdown, getOctokit } from 'website/src/lib/github.server'
import {
    isMediaFile,
    isMetaFile,
    isDocsJsonFile,
    isStylesCssFile,
    syncSite,
    AssetForSync,
} from 'website/src/lib/sync'
import { DocsJsonType } from 'docs-website/src/lib/docs-json'

const logger = console

export const webhookWorkerRequestSchema = z.object({
    secret: z.string(),
    installationId: z.number(),
    owner: z.string(),
    repoName: z.string(),
    repoId: z.number(),
    githubBranch: z.string(),
    commits: z.array(
        z.object({
            id: z.string(),
            added: z.array(z.string()).optional(),
            modified: z.array(z.string()).optional(),
            removed: z.array(z.string()).optional(),
        }),
    ),
})

const app = new Spiceflow({ basePath: '/api/github' })
    .route({
        method: 'POST',
        path: '/webhooks-worker',
        request: webhookWorkerRequestSchema,
        async handler({ request }) {
            const {
                secret,
                installationId,
                owner,
                repoName,
                repoId,
                githubBranch,
                commits,
            } = await request.json()

            if (secret !== env.SECRET) {
                throw new Error('Invalid secret')
            }

            try {
                await updatePagesFromCommits({
                    installationId,
                    owner,
                    repoName,
                    repoId,
                    githubBranch,
                    commits,
                    secret,
                })

                return {
                    success: true,
                    message: 'Webhook processed successfully',
                }
            } catch (error) {
                logger.error('Error processing webhook:', error)
                notifyError(error, 'github webhook worker')
                throw error
            }
        },
    })
    .onError(async (error) => {
        logger.error('Error processing webhook:', error)
        notifyError(error, 'github webhook worker')
        throw error
    })

type WebhookWorkerRequest = z.infer<typeof webhookWorkerRequestSchema>

async function updatePagesFromCommits(args: WebhookWorkerRequest) {
    const { installationId, owner, repoName, repoId, githubBranch, commits } = args
    const latestCommit = commits[commits.length - 1]

    // Set check to pending state at the start
    await createPendingCheckRun({
        installationId,
        owner,
        repoName,
        commitSha: latestCommit.id,
    })

    try {
        let siteBranch = await prisma.siteBranch.findFirst({
            where: {
                githubBranch,
                site: {
                    githubInstallations: {
                        some: {
                            appId: env.GITHUB_APP_ID,
                            installationId,
                        },
                    },
                    githubOwner: owner,
                    githubRepoId: repoId,
                },
            },
            include: {
                site: true,
            },
        })

        if (!siteBranch) {
            logger.log(
                `No branch found for ${githubBranch} in ${owner}/${repoName}`,
            )

            // Check if there's a fumabase.jsonc in the commits with a new domain
            const newBranch = await tryCreateBranchFromDocsJson(args)

            if (!newBranch) {
                logger.log(
                    `No fumabase.jsonc with available domain found for ${githubBranch}`,
                )
                // Report failure for unknown branch
                await reportFailureToGithub({
                    installationId,
                    owner,
                    repoName,
                    commitSha: latestCommit.id,
                    errorMessage: 'No configured branch found for this repository',
                })
                return
            }

            siteBranch = newBranch
        }

        // Handle deletions first
        await handleDeletions({
            site: siteBranch.site,
            commits,
            branchId: siteBranch.branchId,
            githubFolder: siteBranch.site.githubFolder,
        })

        // Process non-deleted files using syncFiles
        const changedFiles = filesFromWebhookCommits({
            commits,
            installationId,
            owner,
            repo: repoName,
            githubFolder: siteBranch.site.githubFolder,
        })

        await syncSite({
            branchId: siteBranch.branchId,
            siteId: siteBranch.site.siteId,
            githubFolder: siteBranch.site.githubFolder,
            files: changedFiles,
            name: siteBranch.site.name || '',
        })

        // Update last sync info
        await prisma.siteBranch.update({
            where: { branchId: siteBranch.branchId },
            data: {
                lastGithubSyncAt: new Date(),
                lastGithubSyncCommit: latestCommit.id,
            },
        })

        // Report errors to GitHub Checks API
        await reportErrorsToGithub({
            installationId,
            owner,
            repoName,
            commitSha: latestCommit.id,
            branchId: siteBranch.branchId,
        })
    } catch (error) {
        logger.error('Error during sync process:', error)
        
        // Report failure to GitHub
        await reportFailureToGithub({
            installationId,
            owner,
            repoName,
            commitSha: latestCommit.id,
            errorMessage: `Sync failed: ${error.message}`,
        })
        
        throw error
    }
}

async function* filesFromWebhookCommits({
    commits,
    installationId,
    owner,
    repo,
    githubFolder,
}: {
    commits: Array<{
        id: string
        added?: string[]
        modified?: string[]
        removed?: string[]
    }>
    installationId: number
    owner: string
    repo: string
    githubFolder: string
}): AsyncGenerator<AssetForSync> {
    const octokit = await getOctokit({ installationId })
    const latestCommit = commits[commits.length - 1]

    // Helper function to check if file is within githubFolder
    const isFileInFolder = (filePath: string): boolean => {
        if (!githubFolder) return true
        return (
            filePath.startsWith(githubFolder + '/') || filePath === githubFolder
        )
    }

    // Collect all non-deleted files within githubFolder
    const allChangedFiles = new Set<string>()
    for (const commit of commits) {
        const added = commit.added || []
        const modified = commit.modified || []
        // Don't include removed files here as we handle deletions separately

        for (const file of [...added, ...modified]) {
            if (isFileInFolder(file)) {
                allChangedFiles.add(file)
            }
        }
    }

    for (const filePath of allChangedFiles) {
        if (isDocsJsonFile(filePath)) {
            const { data } = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: filePath,
            })

            if ('content' in data && data.type === 'file') {
                const content = Buffer.from(data.content, 'base64').toString(
                    'utf-8',
                )

                yield {
                    type: 'docsJson',
                    content,
                    githubPath: filePath,
                    githubSha: latestCommit.id,
                }
            }
            continue
        }

        if (isStylesCssFile(filePath)) {
            const { data } = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: filePath,
            })

            if ('content' in data && data.type === 'file') {
                const content = Buffer.from(data.content, 'base64').toString(
                    'utf-8',
                )

                yield {
                    type: 'stylesCss',
                    content,
                    githubPath: filePath,
                    githubSha: latestCommit.id,
                }
            }
            continue
        }

        if (isMarkdown(`/${filePath}`)) {
            const { data } = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: filePath,
            })

            if ('content' in data && data.type === 'file') {
                const content = Buffer.from(data.content, 'base64').toString(
                    'utf-8',
                )

                yield {
                    type: 'page',
                    totalPages: 1,
                    markdown: content,
                    githubPath: filePath,
                    githubSha: latestCommit.id,
                }
            }
            continue
        }

        if (isMediaFile(filePath)) {
            const res = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: filePath,
            })

            if ('download_url' in res.data && res.data.download_url) {
                yield {
                    type: 'mediaAsset',
                    githubSha: latestCommit.id,
                    githubPath: filePath,
                    downloadUrl: res.data.download_url,
                }
            }
            continue
        }

        if (isMetaFile(filePath)) {
            const { data } = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: filePath,
            })

            if ('content' in data && data.type === 'file') {
                const content = Buffer.from(data.content, 'base64').toString(
                    'utf-8',
                )

                yield {
                    type: 'metaFile',
                    content,
                    githubPath: filePath,
                    githubSha: latestCommit.id,
                }
            }
            continue
        }
    }
}

async function handleDeletions({
    site,
    commits,
    branchId,
    githubFolder,
}: {
    site: { siteId: string }
    commits: Array<{
        id: string
        added?: string[]
        modified?: string[]
        removed?: string[]
    }>
    branchId: string
    githubFolder: string
}) {
    // Helper function to check if file is within githubFolder
    const isFileInFolder = (filePath: string): boolean => {
        if (!githubFolder) return true
        return (
            filePath.startsWith(githubFolder + '/') || filePath === githubFolder
        )
    }

    const latestCommit = commits[commits.length - 1]
    const removedFiles = latestCommit.removed || []

    for (const filePath of removedFiles) {
        // Skip files outside of githubFolder
        if (!isFileInFolder(filePath)) {
            continue
        }
        try {
            if (isDocsJsonFile(filePath)) {
                await prisma.siteBranch.update({
                    where: { branchId },
                    data: { docsJson: {} },
                })
                logger.log(
                    `Deleted fumabase.jsonc/fumabase.jsonc for site ${site.siteId}`,
                )
                continue
            }

            if (isStylesCssFile(filePath)) {
                await prisma.siteBranch.update({
                    where: { branchId },
                    data: { cssStyles: '' },
                })
                logger.log(`Deleted styles.css for site ${site.siteId}`)
                continue
            }

            if (isMarkdown(`/${filePath}`)) {
                const pathWithFrontSlash = `/${filePath}`
                const slug = generateSlugFromPath(
                    pathWithFrontSlash,
                    githubFolder,
                )

                await prisma.markdownPage.deleteMany({
                    where: {
                        githubPath: filePath,
                        branch: {
                            siteId: site.siteId,
                        },
                    },
                })
                logger.log(`Deleted page ${slug} at ${filePath}`)
                continue
            }

            if (isMediaFile(filePath)) {
                const slug = generateSlugFromPath(`/${filePath}`, githubFolder)

                await prisma.mediaAsset.deleteMany({
                    where: {
                        githubPath: filePath,
                        branch: {
                            siteId: site.siteId,
                        },
                    },
                })
                logger.log(`Deleted media asset ${slug} at ${filePath}`)
                continue
            }

            if (isMetaFile(filePath)) {
                await prisma.metaFile.deleteMany({
                    where: {
                        githubPath: filePath,
                        branch: {
                            siteId: site.siteId,
                        },
                    },
                })
                logger.log(`Deleted meta file at ${filePath}`)
                continue
            }
        } catch (error) {
            logger.error(`Error deleting file ${filePath}:`, error)
        }
    }
}

async function tryCreateBranchFromDocsJson(args: WebhookWorkerRequest) {
    const { installationId, owner, repoName, repoId, githubBranch, commits } = args
    const octokit = await getOctokit({ installationId })

    // Look for fumabase.jsonc in the commits
    const docsJsonFiles: string[] = []
    for (const commit of commits) {
        const added = commit.added || []
        const modified = commit.modified || []

        for (const file of [...added, ...modified]) {
            if (isDocsJsonFile(file)) {
                docsJsonFiles.push(file)
            }
        }
    }

    if (docsJsonFiles.length === 0) {
        return null
    }

    // Get the latest fumabase.jsonc content
    const docsJsonPath = docsJsonFiles[0] // Use first found fumabase.jsonc
    try {
        const { data } = await octokit.rest.repos.getContent({
            owner,
            repo: repoName,
            path: docsJsonPath,
            ref: githubBranch,
        })

        if (!('content' in data) || data.type !== 'file') {
            return null
        }

        const content = Buffer.from(data.content, 'base64').toString('utf-8')
        const docsJson: DocsJsonType = safeJsoncParse(content, {})

        // Check if fumabase.jsonc has domains field with at least one domain
        if (
            !docsJson.domains ||
            !Array.isArray(docsJson.domains) ||
            docsJson.domains.length === 0
        ) {
            logger.log(
                `fumabase.jsonc found but no valid domains field in ${githubBranch}`,
            )
            return null
        }

        // Check which domains are available
        const domains = docsJson.domains
        const existingDomains = await prisma.domain.findMany({
            where: {
                host: {
                    in: domains,
                },
            },
        })

        const takenDomains = existingDomains.map((d) => d.host)
        const availableDomains = domains.filter(
            (domain) => !takenDomains.includes(domain),
        )

        if (availableDomains.length === 0) {
            logger.log(
                `All domains ${domains.join(', ')} are already taken, cannot create branch ${githubBranch}`,
            )
            return null
        }

        if (takenDomains.length > 0) {
            logger.log(
                `Domains ${takenDomains.join(', ')} are already taken, creating branch ${githubBranch} with available domains: ${availableDomains.join(', ')}`,
            )
        }

        // Find the site for this repo
        const site = await prisma.site.findFirst({
            where: {
                githubOwner: owner,
                githubRepoId: repoId,
                githubInstallations: {
                    some: {
                        installationId,
                        appId: env.GITHUB_APP_ID,
                    },
                },
            },
        })

        if (!site) {
            logger.log(`No site found for ${owner}/${repoName}`)
            return null
        }

        // Create new branch with available domains only
        const newBranch = await prisma.siteBranch.create({
            data: {
                siteId: site.siteId,
                githubBranch,
                title: docsJson.name || githubBranch,
                docsJson,
                // The domains are created by syncSite function
                // domains: {
                //     create: availableDomains.map(domain => ({
                //         host: domain,
                //         domainType: 'internalDomain',
                //     })),
                // },
            },
            include: {
                site: true,
            },
        })

        logger.log(
            `Created new branch ${githubBranch} with available domains ${availableDomains.join(', ')}`,
        )
        return newBranch
    } catch (error) {
        logger.error(`Error creating branch from fumabase.jsonc:`, error)
        return null
    }
}

function safeJsoncParse(str: string, defaultValue = {}) {
    try {
        return JSONC.parse(str)
    } catch {
        return defaultValue
    }
}

async function createPendingCheckRun({
    installationId,
    owner,
    repoName,
    commitSha,
}: {
    installationId: number
    owner: string
    repoName: string
    commitSha: string
}) {
    try {
        const octokit = await getOctokit({ installationId })
        
        await octokit.rest.checks.create({
            owner,
            repo: repoName,
            name: 'Fumabase Sync',
            head_sha: commitSha,
            status: 'in_progress',
            output: {
                title: 'Syncing documentation...',
                summary: 'Processing markdown files and checking for errors.',
            },
        })

        logger.log(`Created pending check run for commit ${commitSha}`)
    } catch (error) {
        logger.error('Failed to create pending check run:', error)
        notifyError(error, 'GitHub Checks API pending state')
    }
}

async function reportFailureToGithub({
    installationId,
    owner,
    repoName,
    commitSha,
    errorMessage,
}: {
    installationId: number
    owner: string
    repoName: string
    commitSha: string
    errorMessage: string
}) {
    try {
        const octokit = await getOctokit({ installationId })
        
        await octokit.rest.checks.create({
            owner,
            repo: repoName,
            name: 'Fumabase Sync',
            head_sha: commitSha,
            status: 'completed',
            conclusion: 'failure',
            output: {
                title: 'Documentation sync failed',
                summary: errorMessage,
            },
        })

        logger.log(`Reported sync failure to GitHub for commit ${commitSha}`)
    } catch (error) {
        logger.error('Failed to report sync failure to GitHub:', error)
        notifyError(error, 'GitHub Checks API failure reporting')
    }
}

async function reportErrorsToGithub({
    installationId,
    owner,
    repoName,
    commitSha,
    branchId,
}: {
    installationId: number
    owner: string
    repoName: string
    commitSha: string
    branchId: string
}) {
    try {
        const octokit = await getOctokit({ installationId })
        
        // Get all sync errors for this branch
        const syncErrors = await prisma.markdownPageSyncError.findMany({
            where: {
                page: {
                    branchId,
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
        })

        if (syncErrors.length === 0) {
            // Create a successful check run if no errors
            await octokit.rest.checks.create({
                owner,
                repo: repoName,
                name: 'Fumabase Sync',
                head_sha: commitSha,
                status: 'completed',
                conclusion: 'success',
                output: {
                    title: 'Documentation sync successful',
                    summary: 'All markdown files processed successfully.',
                },
            })
            return
        }

        // Check if all errors are recoverable render errors
        const nonRenderErrors = syncErrors.filter(error => error.errorType !== 'render')
        const hasOnlyRenderErrors = nonRenderErrors.length === 0

        // Convert sync errors to GitHub annotations (max 50 per request)
        const annotations = syncErrors.slice(0, 50).map((error) => ({
            path: error.page.githubPath,
            start_line: error.line,
            end_line: error.line,
            annotation_level: hasOnlyRenderErrors ? 'warning' as const : 'failure' as const,
            message: `${error.errorType}: ${error.errorMessage}`,
        }))

        const errorsByType = syncErrors.reduce((acc, error) => {
            acc[error.errorType] = (acc[error.errorType] || 0) + 1
            return acc
        }, {} as Record<string, number>)

        const summary = Object.entries(errorsByType)
            .map(([type, count]) => `${count} ${type} error(s)`)
            .join(', ')

        if (hasOnlyRenderErrors) {
            // Create a neutral check run for render-only errors (recoverable)
            await octokit.rest.checks.create({
                owner,
                repo: repoName,
                name: 'Fumabase Sync',
                head_sha: commitSha,
                status: 'completed',
                conclusion: 'neutral',
                output: {
                    title: `Documentation sync completed with ${syncErrors.length} recoverable error(s)`,
                    summary: `Found ${summary} in markdown files. These are recoverable rendering errors that don't prevent the sync from completing.`,
                    annotations,
                },
            })
        } else {
            // Create a failing check run with error annotations
            await octokit.rest.checks.create({
                owner,
                repo: repoName,
                name: 'Fumabase Sync',
                head_sha: commitSha,
                status: 'completed',
                conclusion: 'failure',
                output: {
                    title: `Documentation sync failed with ${syncErrors.length} error(s)`,
                    summary: `Found ${summary} in markdown files.`,
                    annotations,
                },
            })
        }

        logger.log(`Reported ${syncErrors.length} errors to GitHub Checks API for commit ${commitSha}`)
    } catch (error) {
        logger.error('Failed to report errors to GitHub Checks API:', error)
        notifyError(error, 'GitHub Checks API error reporting')
    }
}

export const loader = async ({ request }: Route.LoaderArgs) => {
    const res = await app.handle(request)
    return res
}

export const action = async ({ request }: Route.ActionArgs) => {
    const res = await app.handle(request)
    return res
}
