import { Route } from './+types/api.github.webhooks-worker'
import { Spiceflow } from 'spiceflow'
import { z } from 'zod'
import { MarkdownExtension, prisma } from 'db'
import { env } from 'website/src/lib/env'
import { notifyError } from 'website/src/lib/errors'
import { processMdxInServer } from 'docs-website/src/lib/mdx.server'
import { generateSlugFromPath } from 'docs-website/src/lib/utils'
import { isMarkdown, getOctokit } from 'website/src/lib/github.server'
import {
    isMediaFile,
    isMetaFile,
    isDocsJsonFile,
    isStylesCssFile,
    syncFiles,
    AssetForSync,
} from 'website/src/lib/sync'

const logger = console

export const webhookWorkerRequestSchema = z.object({
    secret: z.string(),
    installationId: z.number(),
    owner: z.string(),
    repoName: z.string(),
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
            const { secret, installationId, owner, repoName, commits } =
                await request.json()

            if (secret !== env.SECRET) {
                throw new Error('Invalid secret')
            }

            try {
                await updatePagesFromCommits({
                    installationId,
                    owner,
                    repoName,
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

async function updatePagesFromCommits(
    args: z.infer<typeof webhookWorkerRequestSchema>,
) {
    const { installationId, owner, repoName, commits } = args
    const site = await prisma.site.findFirst({
        where: {
            githubInstallations: {
                some: {
                    installationId,
                },
            },
            githubOwner: owner,
            githubRepo: repoName,
        },
        include: {
            tabs: true,
        },
    })

    if (!site) {
        logger.log(`No site found for ${owner}/${repoName}`)
        return
    }

    const tab = site.tabs[0]
    if (!tab) {
        logger.log(`No tabs found for site ${site.siteId}`)
        return
    }

    // Handle deletions first
    await handleDeletions({ site, commits, tabId: tab.tabId })

    // Process non-deleted files using syncFiles
    const changedFiles = filesFromWebhookCommits({
        commits,
        installationId,
        owner,
        repo: repoName,
    })

    await syncFiles({
        tabId: tab.tabId,
        siteId: site.siteId,
        files: changedFiles,
    })
}

async function* filesFromWebhookCommits({
    commits,
    installationId,
    owner,
    repo,
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
}): AsyncGenerator<AssetForSync> {
    const octokit = await getOctokit({ installationId })
    const latestCommit = commits[commits.length - 1]

    // Collect all non-deleted files
    const allChangedFiles = new Set<string>()
    for (const commit of commits) {
        const added = commit.added || []
        const modified = commit.modified || []
        // Don't include removed files here as we handle deletions separately

        for (const file of [...added, ...modified]) {
            allChangedFiles.add(file)
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
                const jsonData = safeJsonParse(content, {})

                yield {
                    type: 'docsJson',
                    jsonData,
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
                const extension: MarkdownExtension = filePath.endsWith('.mdx')
                    ? 'mdx'
                    : 'md'
                const pathWithFrontSlash = `/${filePath}`
                const slug = generateSlugFromPath(pathWithFrontSlash, '')

                const { data: processedData } = await processMdxInServer({
                    markdown: content,
                    extension,
                })

                yield {
                    type: 'page',
                    totalPages: 1,
                    pageInput: {
                        slug,
                        title: processedData.title || '',
                        description: processedData.description,
                        markdown: content,
                        frontmatter: processedData.frontmatter,
                        githubSha: latestCommit.id,
                        githubPath: filePath,
                        extension,
                        structuredData: processedData.structuredData as any,
                    },
                    structuredData: processedData.structuredData,
                }
            }
            continue
        }

        if (isMediaFile(filePath)) {
            const slug = generateSlugFromPath(`/${filePath}`, '')
            const res = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: filePath,
            })

            if ('download_url' in res.data && res.data.download_url) {
                yield {
                    type: 'mediaAsset',
                    slug,
                    sha: latestCommit.id,
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
                const jsonData = safeJsonParse(content, {})

                yield {
                    type: 'metaFile',
                    jsonData,
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
    tabId,
}: {
    site: { siteId: string }
    commits: Array<{
        id: string
        added?: string[]
        modified?: string[]
        removed?: string[]
    }>
    tabId: string
}) {
    const latestCommit = commits[commits.length - 1]
    const removedFiles = latestCommit.removed || []

    for (const filePath of removedFiles) {
        try {
            if (isDocsJsonFile(filePath)) {
                await prisma.site.update({
                    where: { siteId: site.siteId },
                    data: { docsJson: {} },
                })
                logger.log(
                    `Deleted docs.json/docs.jsonc for site ${site.siteId}`,
                )
                continue
            }

            if (isStylesCssFile(filePath)) {
                await prisma.site.update({
                    where: { siteId: site.siteId },
                    data: { cssStyles: '' },
                })
                logger.log(`Deleted styles.css for site ${site.siteId}`)
                continue
            }

            if (isMarkdown(`/${filePath}`)) {
                const pathWithFrontSlash = `/${filePath}`
                const slug = generateSlugFromPath(pathWithFrontSlash, '')

                await prisma.markdownPage.deleteMany({
                    where: {
                        githubPath: filePath,
                        tab: {
                            siteId: site.siteId,
                        },
                    },
                })
                logger.log(`Deleted page ${slug} at ${filePath}`)
                continue
            }

            if (isMediaFile(filePath)) {
                const slug = generateSlugFromPath(`/${filePath}`, '')

                await prisma.mediaAsset.deleteMany({
                    where: {
                        githubPath: filePath,
                        site: {
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
                        tab: {
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

function safeJsonParse(str: string, defaultValue = {}) {
    try {
        return JSON.parse(str)
    } catch {
        return defaultValue
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
