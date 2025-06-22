import { Webhooks } from '@octokit/webhooks'

import { env } from 'website/src/lib/env'

import { prisma } from 'db'
import { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
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

async function updatePagesFromCommits({
    installationId,
    owner,
    repoName,
    commits,
}: {
    installationId: number
    owner: string
    repoName: string
    commits: Array<{
        id: string
        added?: string[]
        modified?: string[]
        removed?: string[]
    }>
}) {
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
            // Handle special files
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

            // Handle markdown files
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

            // Handle media files
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

            // Handle meta.json files
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
        // Delete the page
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

    // Find or create a tab for this site (using first tab as default)
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

            // Process MDX to extract title and description
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
        // Delete the media asset
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

    // Find or create a tab for this site (using first tab as default)
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
        // Delete the meta file
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

    // Find or create a tab for this site (using first tab as default)
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

function getWebhooks() {
    // https://tunnel.unframer.co/api/github/webhooks
    const webhooks = new Webhooks({
        secret: env.SECRET!,
    })

    webhooks.on('marketplace_purchase.purchased', async (event) => {
        const installationId = event.payload.installation?.id
        if (!installationId) {
            logger.log('no installation id in marketplace_purchase.purchased')
            return
        }
        const repo = event.payload.repository
        const org = event.payload.organization

        // const org = event.payload.effective_date
    })

    webhooks.on('installation', async (event) => {
        const installationId = Number(event.payload.installation?.id)

        switch (event.payload.action) {
            case 'created': {
                // const installation = await getOrCreateInstallation({
                //     githubId: payload.installation.id,
                //     deleted: false,
                // })
                // await synchronizeFromInstallationId(installation.id)
                return
            }
            case 'suspend': {
                // const installation = await getOrCreateInstallation({
                //     githubId: payload.installation.id,
                //     deleted: false,
                // })
                // await synchronizeFromInstallationId(installation.id)
                await prisma.githubInstallation.updateMany({
                    where: {
                        installationId,
                    },
                    data: {
                        status: 'suspended',
                    },
                })
                return
            }
            case 'deleted': {
                // const installation = await getOrCreateInstallation({
                //     githubId: payload.installation.id,
                //     deleted: true,
                // })
                // await synchronizeFromInstallationId(installation.id)
                logger.log(`removing installation ids form sites`)
                if (!installationId) {
                    logger.log('no installation id, not deleting')
                    return
                }
                // await prisma.site.updateMany({
                //     where: {
                //         installationId,
                //     },
                //     data: {
                //         installationId: null,
                //     },
                // })
                await prisma.githubInstallation.updateMany({
                    where: {
                        installationId,
                    },
                    data: {
                        status: 'deleted',
                    },
                })

                return
            }
        }
    })

    webhooks.on('push', async (event) => {
        const installationId = event.payload.installation?.id
        if (!installationId) {
            logger.log('no installation id in push event')
            return
        }

        const repo = event.payload.repository
        const commits = event.payload.commits || []

        if (!repo || !repo.owner || commits.length === 0) {
            logger.log('no repository, owner, or commits in push event')
            return
        }

        try {
            await updatePagesFromCommits({
                installationId: Number(installationId),
                owner: repo.owner.login,
                repoName: repo.name,
                commits,
            })
        } catch (error) {
            logger.error('Error updating pages from commits:', error)
            notifyError(error, 'github push webhook')
        }
    })

    webhooks.on('repository', async (event) => {
        if (!event.payload.installation?.id) {
            logger.log('no installation id, not renaming')
            return
        }
        switch (event.payload.action) {
            case 'renamed': {
                const repo = event.payload.repository
                logger.log(
                    `renaming repository ${repo?.owner?.login}/${repo?.name}`,
                )
                // await prisma.githubIntegration.updateMany({
                //     where: {
                //         installationId: event.payload.installation?.id,
                //         owner: repo.owner.login,
                //         repo: repo.name,
                //     },
                //     data: {
                //         repo: repo.name,
                //     },
                // })

                return
            }
            case 'deleted': {
                const repo = event.payload.repository
                logger.log(
                    `deleting repository ${repo?.owner?.login}/${repo?.name}`,
                )
                // await prisma.githubIntegration.deleteMany({
                //     where: {
                //         installationId: event.payload.installation?.id,
                //         owner: repo.owner.login,
                //         repo: repo.name,
                //     },
                // })

                return
            }
        }
        return
    })
    return webhooks
}

export function loader({}: LoaderFunctionArgs) {
    return 'use POST'
}

const webhooks = getWebhooks()
export async function action({ request }: ActionFunctionArgs) {
    const text = await request.text()
    try {
        await webhooks.verifyAndReceive({
            id: request.headers.get('x-github-delivery') || '',
            name: request.headers.get('x-github-event') || ('' as any),
            payload: text,
            signature: request.headers.get('x-hub-signature-256') || '',
        })
    } catch (error) {
        notifyError(error, 'github webhooks')
        return new Response(error.message || error, { status: 400 })
    }
    return new Response('ok')
}
