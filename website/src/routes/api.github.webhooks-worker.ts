import { Route } from './+types/api.github.webhooks-worker'
import { Spiceflow } from 'spiceflow'
import { z } from 'zod'
import { prisma } from 'db'
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

const app = new Spiceflow({ basePath: '/api/github' }).route({
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

            return { success: true, message: 'Webhook processed successfully' }
        } catch (error) {
            logger.error('Error processing webhook:', error)
            notifyError(error, 'github webhook worker')
            throw error
        }
    },
})

async function updatePagesFromCommits(
    args: z.infer<typeof webhookWorkerRequestSchema>,
) {
    const { installationId, owner, repoName, commits } = args
    const site = await prisma.site.findFirst({
        where: {
            installationId,
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

    const allChangedFiles = new Set<string>()

    for (const commit of commits) {
        const added = commit.added || []
        const modified = commit.modified || []
        const removed = commit.removed || []

        for (const file of [...added, ...modified, ...removed]) {
            allChangedFiles.add(file)
        }
    }

    const changedFilesList = Array.from(allChangedFiles)
    logger.log(
        `Processing ${changedFilesList.length} changed files for ${owner}/${repoName}`,
    )

    const octokit = await getOctokit({ installationId })

    for (const filePath of changedFilesList) {
        try {
            if (isDocsJsonFile(filePath)) {
                await handleDocsJsonUpdate({
                    siteId: site.siteId,
                    filePath,
                    commits,
                    octokit,
                    owner,
                    repo: repoName,
                })
                continue
            }

            if (isStylesCssFile(filePath)) {
                await handleStylesCssUpdate({
                    siteId: site.siteId,
                    filePath,
                    commits,
                    octokit,
                    owner,
                    repo: repoName,
                })
                continue
            }

            if (isMarkdown(`/${filePath}`)) {
                await handleMarkdownFileUpdate({
                    site,
                    filePath,
                    commits,
                    octokit,
                    owner,
                    repo: repoName,
                })
                continue
            }

            if (isMediaFile(filePath)) {
                await handleMediaFileUpdate({
                    site,
                    filePath,
                    commits,
                    octokit,
                    owner,
                    repo: repoName,
                })
                continue
            }

            if (isMetaFile(filePath)) {
                await handleMetaFileUpdate({
                    site,
                    filePath,
                    commits,
                    octokit,
                    owner,
                    repo: repoName,
                })
                continue
            }
        } catch (error) {
            logger.error(`Error processing file ${filePath}:`, error)
        }
    }
}

async function handleDocsJsonUpdate({
    siteId,
    filePath,
    commits,
    octokit,
    owner,
    repo,
}: {
    siteId: string
    filePath: string
    commits: Array<{
        id: string
        added?: string[]
        modified?: string[]
        removed?: string[]
    }>
    octokit: Awaited<ReturnType<typeof getOctokit>>
    owner: string
    repo: string
}) {
    const latestCommit = commits[commits.length - 1]
    const isDeleted = latestCommit.removed?.includes(filePath)

    if (isDeleted) {
        await prisma.site.update({
            where: { siteId },
            data: { docsJson: {} },
        })
        logger.log(`Deleted docs.json/docs.jsonc for site ${siteId}`)
        return
    }

    try {
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

            await prisma.site.update({
                where: { siteId },
                data: { docsJson: jsonData },
            })

            logger.log(`Updated docs.json/docs.jsonc for site ${siteId}`)
        }
    } catch (error) {
        logger.error(`Error fetching ${filePath} content:`, error)
    }
}

async function handleStylesCssUpdate({
    siteId,
    filePath,
    commits,
    octokit,
    owner,
    repo,
}: {
    siteId: string
    filePath: string
    commits: Array<{
        id: string
        added?: string[]
        modified?: string[]
        removed?: string[]
    }>
    octokit: Awaited<ReturnType<typeof getOctokit>>
    owner: string
    repo: string
}) {
    const latestCommit = commits[commits.length - 1]
    const isDeleted = latestCommit.removed?.includes(filePath)

    if (isDeleted) {
        await prisma.site.update({
            where: { siteId },
            data: { cssStyles: '' },
        })
        logger.log(`Deleted styles.css for site ${siteId}`)
        return
    }

    try {
        const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: filePath,
        })

        if ('content' in data && data.type === 'file') {
            const content = Buffer.from(data.content, 'base64').toString(
                'utf-8',
            )

            await prisma.site.update({
                where: { siteId },
                data: { cssStyles: content },
            })

            logger.log(`Updated styles.css for site ${siteId}`)
        }
    } catch (error) {
        logger.error(`Error fetching ${filePath} content:`, error)
    }
}

async function handleMarkdownFileUpdate({
    site,
    filePath,
    commits,
    octokit,
    owner,
    repo,
}: {
    site: { siteId: string; tabs: Array<{ tabId: string }> }
    filePath: string
    commits: Array<{
        id: string
        added?: string[]
        modified?: string[]
        removed?: string[]
    }>
    octokit: Awaited<ReturnType<typeof getOctokit>>
    owner: string
    repo: string
}) {
    const latestCommit = commits[commits.length - 1]
    const isDeleted = latestCommit.removed?.includes(filePath)

    const pathWithFrontSlash = `/${filePath}`
    const slug = generateSlugFromPath(pathWithFrontSlash, '')

    if (isDeleted) {
        await prisma.markdownPage.deleteMany({
            where: {
                githubPath: filePath,
                tab: {
                    siteId: site.siteId,
                },
            },
        })
        logger.log(`Deleted page ${slug} at ${filePath}`)
        return
    }

    const tab = site.tabs[0]
    if (!tab) {
        logger.log(`No tabs found for site ${site.siteId}`)
        return
    }

    try {
        const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: filePath,
        })

        if ('content' in data && data.type === 'file') {
            const content = Buffer.from(data.content, 'base64').toString(
                'utf-8',
            )
            const extension = filePath.endsWith('.mdx') ? 'mdx' : 'md'
            const githubSha = latestCommit.id

            const { data: processedData } = await processMdxInServer({
                markdown: content,
                extension,
            })

            await prisma.markdownPage.upsert({
                where: {
                    tabId_slug: {
                        tabId: tab.tabId,
                        slug,
                    },
                },
                update: {
                    title: processedData.title || '',
                    description: processedData.description,
                    markdown: content,
                    frontmatter: processedData.frontmatter,
                    githubSha,
                    githubPath: filePath,
                    lastEditedAt: new Date(),
                    structuredData: processedData.structuredData as any,
                },
                create: {
                    slug,
                    tabId: tab.tabId,
                    title: processedData.title || '',
                    description: processedData.description,
                    markdown: content,
                    frontmatter: processedData.frontmatter,
                    githubSha,
                    githubPath: filePath,
                    extension,
                    structuredData: processedData.structuredData as any,
                },
            })

            logger.log(`Updated/created page ${slug} at ${filePath}`)
        }
    } catch (error) {
        logger.error(`Error fetching ${filePath} content:`, error)
    }
}

async function handleMediaFileUpdate({
    site,
    filePath,
    commits,
    octokit,
    owner,
    repo,
}: {
    site: { siteId: string; tabs: Array<{ tabId: string }> }
    filePath: string
    commits: Array<{
        id: string
        added?: string[]
        modified?: string[]
        removed?: string[]
    }>
    octokit: Awaited<ReturnType<typeof getOctokit>>
    owner: string
    repo: string
}) {
    const latestCommit = commits[commits.length - 1]
    const isDeleted = latestCommit.removed?.includes(filePath)

    const slug = generateSlugFromPath(`/${filePath}`, '')

    if (isDeleted) {
        await prisma.mediaAsset.deleteMany({
            where: {
                githubPath: filePath,
                site: {
                    siteId: site.siteId,
                },
            },
        })
        logger.log(`Deleted media asset ${slug} at ${filePath}`)
        return
    }

    const tab = site.tabs[0]
    if (!tab) {
        logger.log(`No tabs found for site ${site.siteId}`)
        return
    }

    const githubSha = latestCommit.id

    await prisma.mediaAsset.upsert({
        where: {
            slug_tabId: {
                tabId: tab.tabId,
                slug,
            },
        },
        update: {
            githubSha,
            githubPath: filePath,
        },
        create: {
            slug,
            tabId: tab.tabId,
            siteId: site.siteId,
            githubSha,
            githubPath: filePath,
        },
    })

    logger.log(`Updated/created media asset ${slug} at ${filePath}`)
}

async function handleMetaFileUpdate({
    site,
    filePath,
    commits,
    octokit,
    owner,
    repo,
}: {
    site: { siteId: string; tabs: Array<{ tabId: string }> }
    filePath: string
    commits: Array<{
        id: string
        added?: string[]
        modified?: string[]
        removed?: string[]
    }>
    octokit: Awaited<ReturnType<typeof getOctokit>>
    owner: string
    repo: string
}) {
    const latestCommit = commits[commits.length - 1]
    const isDeleted = latestCommit.removed?.includes(filePath)

    if (isDeleted) {
        await prisma.metaFile.deleteMany({
            where: {
                githubPath: filePath,
                tab: {
                    siteId: site.siteId,
                },
            },
        })
        logger.log(`Deleted meta file at ${filePath}`)
        return
    }

    const tab = site.tabs[0]
    if (!tab) {
        logger.log(`No tabs found for site ${site.siteId}`)
        return
    }

    try {
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
            const githubSha = latestCommit.id

            await prisma.metaFile.upsert({
                where: {
                    githubPath_tabId: {
                        githubPath: filePath,
                        tabId: tab.tabId,
                    },
                },
                update: {
                    githubSha,
                    jsonData,
                },
                create: {
                    githubPath: filePath,
                    tabId: tab.tabId,
                    githubSha,
                    jsonData,
                },
            })

            logger.log(`Updated/created meta file at ${filePath}`)
        }
    } catch (error) {
        logger.error(`Error fetching ${filePath} content:`, error)
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
