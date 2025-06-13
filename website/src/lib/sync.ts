import { Sema } from 'async-sema'
import crypto from 'crypto'
import { execSync } from 'child_process'
import { MarkdownExtension, Prisma, prisma } from 'db'
import fs from 'fs'

import path from 'path'
import { ChunkReqPayload, TrieveSDK } from 'trieve-ts-sdk'
import {
    DocumentRecord,
    processMdx,
    StructuredData,
} from 'docs-website/src/lib/mdx'
import { env } from './env'
import {
    checkGitHubIsInstalled,
    getOctokit,
    getRepoFiles,
    addInitialSlashToPath as addFrontSlashToPath,
    isMarkdown,
} from './github.server'
import { notifyError } from './errors'

type Page = {
    pageInput: Omit<Prisma.MarkdownPageUncheckedCreateInput, 'tabId'>
    structuredData: StructuredData

    totalPages: number
}

export async function syncSite({
    siteId,

    name,
    tabId,
    orgId,
    pages,
}: {
    siteId: string

    name?: string
    tabId: string
    orgId: string
    pages: AsyncIterable<Page>
}) {
    console.log('Starting import script...')

    // Ensure the site exists or create it if it doesn't
    console.log(`Upserting site with ID: ${siteId}, name: ${name}...`)
    const site = await prisma.site.upsert({
        where: { siteId },
        update: { name }, // No updates needed if it exists
        create: {
            siteId,
            name,
            orgId,
        },
        include: {
            domains: {
                where: {
                    domainType: 'internalDomain',
                },
            },
        },
    })
    console.log(`Site upsert complete: ${siteId} (${site.name}) `)

    // Find existing domain or create a new one
    console.log(`Looking for existing internal domain for site: ${siteId}...`)
    const existingDomain = site.domains.find((x) => x)

    console.log(`Using site: ${siteId}`)

    // --- 1. Find or create the Tab ---
    // Use upsert to find or create the tab in a single operation
    console.log(`Upserting tab with ID: ${tabId} for site: ${siteId}...`)
    const tab = await prisma.tab.upsert({
        where: {
            tabId: tabId,
        },
        update: {
            siteId,
        }, // No updates needed if it exists
        create: {
            siteId: siteId,
            title: 'Main',
            tabId,
        },
    })
    console.log(`Tab upsert complete: ${tab.tabId} (${tab.title})`)

    await syncPages({
        tabId,
        siteId,
        trieveDatasetId: site.trieveDatasetId || undefined,
        pages,
    })
}

export async function syncPages({
    tabId,
    siteId,
    trieveDatasetId,
    pages,
    name,
}: {
    pages: AsyncIterable<Page>
    tabId: string
    siteId: string
    trieveDatasetId?: string
    name?: string
}) {
    const concurrencyLimit = 10
    const semaphore = new Sema(concurrencyLimit)

    const chunkSize = 120
    let chunksToSync: ChunkReqPayload[] = []

    const trieve = new TrieveSDK({
        apiKey: env.TRIEVE_API_KEY!,
        organizationId: env.TRIEVE_ORGANIZATION_ID!,
        datasetId: trieveDatasetId || undefined,
    })
    if (!trieveDatasetId) {
        const { datasetId } = await createTrieveDataset({ siteId, name })
        trieve.datasetId = datasetId
    }

    const processedSlugs = new Set<string>()
    for await (const page of pages) {
        const { slug, title } = page.pageInput
        const structuredData = page.structuredData
        if (processedSlugs.has(slug)) {
            console.log(
                `Skipping duplicate page with slug: ${slug}, title: ${title}`,
            )
            continue
        }
        await semaphore.acquire() // Acquire permit for file processing
        try {
            chunksToSync.push(
                ...processForTrieve({
                    _id: slug,
                    title: title || slug,
                    url: slug,
                    structured: structuredData,
                    pageSlug: slug,
                }),
            )

            console.log(`Upserting page with slug: ${slug}, title: ${title}...`)
            await Promise.all([
                prisma.markdownPage
                    .upsert({
                        where: { tabId_slug: { tabId, slug } },
                        update: page.pageInput,
                        create: { ...page.pageInput, tabId },
                    })
                    .then((page) => {
                        console.log(
                            `Page upsert complete: ${page.pageId} (${page.title})`,
                        )
                    }),
                chunksToSync.length >= chunkSize &&
                    (async () => {
                        console.log(`Syncing ${chunkSize} chunks to Trieve...`)
                        await trieve.createChunk(
                            chunksToSync.slice(0, chunkSize),
                        )
                        console.log('Chunks synced to Trieve successfully.')
                        chunksToSync = chunksToSync.slice(chunkSize)
                    })(),
            ])
            console.log(` -> Upserted page: ${title} (ID: ${slug})`)
        } catch (e: any) {
            if (
                e.message.includes(
                    'lone leading surrogate in hex escape at line ',
                )
            ) {
                console.error(e)
                return
            }
            throw e
        } finally {
            semaphore.release() // Release permit after file processing
            processedSlugs.add(slug)
        }
    }

    if (chunksToSync.length > 0) {
        console.log(
            `Flushing remaining ${chunksToSync.length} chunks to Trieve...`,
        )
        const groups = groupByN(chunksToSync, chunkSize)
        await Promise.all(groups.map((group) => trieve.createChunk(group)))
        console.log('Remaining chunks synced to Trieve successfully.')
    } else {
        console.log('No remaining chunks to sync to Trieve.')
    }

    console.log('Import script finished.')
}

function groupByN<T>(array: T[], n: number): T[][] {
    if (n <= 0) {
        throw new Error('Group size must be greater than 0')
    }

    // Return original array as single group if array length is smaller than n
    if (array.length <= n) {
        return [array]
    }

    const result: T[][] = []
    for (let i = 0; i < array.length; i += n) {
        result.push(array.slice(i, i + n))
    }
    return result
}

const mdxRegex = /\.mdx?$/

export async function* pagesFromDirectory(
    dirPath: string,
    base = '',
): AsyncGenerator<Page & { filePath: string; content: string }> {
    if (!base) {
        base = dirPath
    }
    console.log(`Processing directory: ${path.relative(base, dirPath)}`)
    const entries = await fs.promises.readdir(dirPath, {
        withFileTypes: true,
    })
    const totalPages = 0

    // Process files first
    for (const entry of entries.filter(
        (entry) => entry.isFile() && mdxRegex.test(entry.name),
    )) {
        const fullPath = path.join(dirPath, entry.name)
        const entryRelativePath = path.relative(base, fullPath)
        const entrySlug =
            '/' + entryRelativePath.replace(/\\/g, '/').replace(mdxRegex, '')

        const fileContent = await fs.promises.readFile(fullPath, 'utf8')

        const { data } = await processMdx({
            markdown: fileContent,
            extension: entry.name.split('.').pop() === 'mdx' ? 'mdx' : 'md',
        })
        const page = {
            totalPages,
            pageInput: {
                slug: entrySlug,
                title: data.title || '',
                markdown: fileContent,
                frontmatter: data.frontmatter,
                githubPath: entryRelativePath,
                githubSha: '',
            },

            structuredData: data.structuredData,
        } satisfies Page | null
        if (page) {
            yield { ...page, content: fileContent, filePath: entryRelativePath }
        }
    }

    // Then process subdirectories
    for (const entry of entries.filter((entry) => entry.isDirectory())) {
        const fullPath = path.join(dirPath, entry.name)
        yield* pagesFromDirectory(fullPath, base)
    }
}

export async function* pagesFromGithub({
    repo,
    owner,
    installationId,
    basePath = '',
    signal,
    urlLikeFrontmatterFields = [],
    onlyGithubPaths = new Set<string>(),
}): AsyncGenerator<Page> {
    if (!installationId) throw new Error('Installation ID is required')
    const octokit = await getOctokit({ installationId })
    const timeId = Date.now()
    const [repoResult, ok, existingFiles] = await Promise.all([
        octokit.rest.repos.get({
            owner,
            repo,
            request: { signal },
        }),
        checkGitHubIsInstalled({ installationId }),
        prisma.markdownPage.findMany({
            where: {
                tab: { site: { installationId } },
            },
        }),
    ])
    console.timeEnd(`${owner}/${repo} - repo checks ${timeId}`)

    if (!ok) {
        throw new Error('Github app no longer installed')
    }
    let branch = repoResult.data.default_branch
    const existingShas = new Set(existingFiles.map((f) => f.githubSha))
    const existingSlugs = new Set(existingFiles.map((f) => f.slug))
    let maxBlobFetches = 4000
    let blobFetches = 0

    console.time(`${owner}/${repo} - fetch files ${timeId}`)
    const files = await getRepoFiles({
        fetchBlob(file) {
            if (blobFetches > maxBlobFetches) {
                return false
            }
            let pathWithFrontSlash = addFrontSlashToPath(file.path || '')
            if (
                !file.sha ||
                !pathWithFrontSlash?.startsWith(basePath) ||
                !isMarkdown(pathWithFrontSlash)
            ) {
                return false
            }
            if (onlyGithubPaths.size && file.path) {
                // in case the item is not in Framer fetch it again
                if (!onlyGithubPaths.has(file.path)) {
                    return true
                }
                return false
            }
            blobFetches++
            return true
        },
        branch: branch,
        octokit: octokit.rest,
        owner,
        repo,
        signal,
    })
    console.timeEnd(`${owner}/${repo} - fetch files ${timeId}`)

    const allCurrentPagePaths = new Set(
        files.map((x) => x.pathWithFrontSlash).filter(Boolean),
    )
    const toDelete = [...existingSlugs].filter(
        (slug) => !allCurrentPagePaths.has(slug),
    )

    let allAssetPaths = files.map((x) => x.pathWithFrontSlash)
    let onlyMarkdown = files.filter((x) => {
        if (
            x.content == null ||
            !x?.pathWithFrontSlash?.startsWith(basePath) ||
            !isMarkdown(x.pathWithFrontSlash)
        ) {
            return false
        }
        return true
    })

    console.log(
        `found ${onlyMarkdown.length} files to sync, from ${files.filter((x) => x?.pathWithFrontSlash?.startsWith(basePath) && isMarkdown(x?.pathWithFrontSlash)).length} total files`,
    )

    let mapImageUrl = (imgPath) =>
        publicFileMapUrl({ branch, imgPath, owner, repo })

    if (repoResult.data.private) {
        mapImageUrl = async (imgPath) => {
            try {
                const res = await octokit.rest.repos.getContent({
                    owner,
                    repo,
                    path: imgPath,
                    ref: branch,
                    request: { signal },
                })
                if (!('download_url' in res.data)) {
                    throw new Error('Could not get download url for image')
                }
                console.log('download url', res.data.download_url)
                return res.data.download_url || ''
            } catch (error) {
                notifyError(error, 'error getting download url for image')
                throw error
            }
        }
    }

    async function resolveUrlsInFrontmatter(frontmatter: Record<string, any>) {
        if (!frontmatter) {
            return frontmatter
        }
        if (typeof frontmatter !== 'object') {
            return frontmatter
        }
        for (const field of urlLikeFrontmatterFields) {
            const value = frontmatter[field]
            if (!value) {
                continue
            }
            const filePath = frontmatter[field]
            if (isValidUrl(filePath)) {
                continue
            }
            const resolved = findMatchInPaths({
                filePath,
                paths: allAssetPaths,
            })
            if (resolved) {
                frontmatter[field] = await mapImageUrl(resolved)
            } else {
                delete frontmatter[field]
            }
        }
        // TODO handle relative paths in frontmatter for some things
        // // Handle rich text fields by converting markdown to HTML
        // for (const field of richTextFields) {
        //     try {
        //         const value = frontmatter[field]
        //         if (!value || typeof value !== 'string') {
        //             continue
        //         }
        //         const { html } = await markdownToHtml(value, '.md')
        //         frontmatter[field] = html
        //     } catch (error) {
        //         notifyError(
        //             error,
        //             `Error converting rich text field '${field}' to HTML`,
        //         )
        //         // Keep original value on error
        //         continue
        //     }
        // }
        return frontmatter
    }

    console.time(`${owner}/${repo} - process markdown ${timeId}`)
    const slugsFound = new Set<string>()
    let totalPages = onlyMarkdown.length
    let pagesToSync = onlyMarkdown
    if (onlyGithubPaths.size) {
        pagesToSync = onlyMarkdown.filter((x) =>
            onlyGithubPaths.has(x.pathWithFrontSlash),
        )
    }
    for (const x of onlyMarkdown) {
        if (x?.content == null) {
            continue
        }

        const pathWithFrontSlash = x.pathWithFrontSlash
        let content = x.content
        let extension = path.extname(x.pathWithFrontSlash) as MarkdownExtension
        const slug = generateSlugFromPath(pathWithFrontSlash, basePath)
        if (slugsFound.has(slug)) {
            console.log(
                'duplicate slug found',
                slug,
                'in',
                owner + '/' + repo,
                'at',
                pathWithFrontSlash,
            )
            continue
        }
        slugsFound.add(slug)
        const { data } = await processMdx({
            markdown: x.content,
            extension,
        })

        let frontmatter = await resolveUrlsInFrontmatter(data.frontmatter)
        let title = frontmatter?.title

        yield {
            pageInput: {
                slug,
                title: title || '',
                markdown: content,
                frontmatter: frontmatter,
                githubSha: x.sha,
                githubPath: x.githubPath,
                description: data.description,
                extension,
            },
            structuredData: data.structuredData,
            totalPages,
        }
    }
}

export async function deletePages({
    slugs,
    siteId,
    tabId,
}: {
    slugs: string[]
    siteId: string
    tabId: string
}) {
    console.log(
        `Deleting pages with slugs: ${slugs.join(', ')} from tab ${tabId} in site ${siteId}`,
    )

    // 1. Get the site to retrieve the Trieve dataset ID
    const site = await prisma.site.findUnique({
        where: { siteId },
        select: { trieveDatasetId: true },
    })

    if (!site) {
        throw new Error(`Site with ID ${siteId} not found`)
    }

    // 2. Initialize Trieve SDK if we have a dataset ID
    let trieve: TrieveSDK | undefined
    if (site.trieveDatasetId) {
        trieve = new TrieveSDK({
            apiKey: env.TRIEVE_API_KEY!,
            organizationId: env.TRIEVE_ORGANIZATION_ID!,
            datasetId: site.trieveDatasetId,
        })
        console.log(
            `Initialized Trieve SDK with dataset ID: ${site.trieveDatasetId}`,
        )
    } else {
        console.log(
            `No Trieve dataset found for site ${siteId}, skipping Trieve cleanup`,
        )
    }

    // 3. For each slug, find all pages that have that slug or start with that slug + "/"
    for (const rootSlug of slugs) {
        // Find the main page and all its children
        console.log(`Finding pages for slug ${rootSlug} in tab ${tabId}`)
        const pagesToDelete = await prisma.markdownPage.findMany({
            where: {
                tabId,
                OR: [
                    { slug: rootSlug },
                    { slug: { startsWith: `${rootSlug}/` } },
                ],
            },
            select: {
                pageId: true,
                slug: true,
            },
        })

        if (pagesToDelete.length === 0) {
            console.log(`No pages found for slug ${rootSlug} in tab ${tabId}`)
            continue
        }

        console.log(
            `Found ${pagesToDelete.length} pages to delete for slug ${rootSlug}`,
        )

        // 4. Delete chunks from Trieve if available (do this before deleting pages from DB)
        if (trieve && site.trieveDatasetId) {
            for (const page of pagesToDelete) {
                try {
                    console.log(
                        `Deleting chunks for page ${page.slug} from Trieve`,
                    )

                    await trieve.deleteGroup({
                        deleteChunks: true,
                        groupId: page.slug,
                        trDataset: site.trieveDatasetId,
                    })

                    console.log(
                        `Successfully deleted chunks for page ${page.slug} from Trieve`,
                    )
                } catch (error) {
                    console.error(
                        `Error deleting chunks for page ${page.slug} from Trieve:`,
                        error,
                    )
                }
            }
        }

        // 5. Delete pages from database
        console.log(`Deleting pages from database for slug ${rootSlug}`)
        const deleteResult = await prisma.markdownPage.deleteMany({
            where: {
                tabId,
                OR: [
                    { slug: rootSlug },
                    { slug: { startsWith: `${rootSlug}/` } },
                ],
            },
        })

        console.log(
            `Deleted ${deleteResult.count} pages from database for slug ${rootSlug}`,
        )
    }

    console.log('Page deletion completed')
}

function processForTrieve(page: DocumentRecord & { pageSlug: string }) {
    const chunks: ChunkReqPayload[] = []
    const group_tracking_ids = [page.title, page.pageSlug]
    const tag_set = page.tag ? [page.tag] : []
    if (page.description)
        chunks.push({
            tracking_id: `${page._id}-${page.description}`,
            chunk_html: page.description,
            link: page.url,
            tag_set,
            metadata: {
                page_title: page.title,
                // section: section || '',
                // section_id: sectionId || '',
                page_id: page._id,
            },
            upsert_by_tracking_id: true,
            group_tracking_ids,
        })

    page.structured.contents.forEach((p) => {
        const heading = p.heading
            ? page.structured.headings.find((h) => p.heading === h.id)
            : null

        chunks.push({
            tracking_id: `${page._id}-${heading?.id}-content`,
            chunk_html: p.content,
            link: page.url,
            tag_set,
            metadata: {
                page_title: page.title,
                section: heading?.content || '',
                section_id: heading?.id || '',
                page_id: page._id,
            },
            upsert_by_tracking_id: true,
            group_tracking_ids,
        })
    })
    page.structured.headings.forEach((heading) => {
        chunks.push({
            tracking_id: `${page._id}-${heading?.id}-heading`,
            chunk_html: heading.content,
            link: page.url,
            tag_set,
            metadata: {
                page_title: page.title,
                section: heading?.content || '',
                section_id: heading?.id || '',
                page_id: page._id,
            },
            upsert_by_tracking_id: true,
            group_tracking_ids,
        })
    })

    return chunks
}

async function createTrieveDataset({ siteId, name }) {
    const trieve = new TrieveSDK({
        apiKey: env.TRIEVE_API_KEY!,
        organizationId: env.TRIEVE_ORGANIZATION_ID!,
    })
    console.log(
        `No Trieve dataset found for site ${siteId}, creating new dataset...`,
    )
    const dataset = await trieve
        .createDataset({
            dataset_name: `${name} ${siteId}`,
            tracking_id: siteId,
            server_configuration: {},
        })
        .catch((e) => {
            if (e.message.includes('already exists')) {
                console.log('Trieve dataset already exists')
                return null
            }
            throw e
        })
    let datasetId = dataset?.id
    if (!datasetId) {
        console.log(`Trieve dataset already exists for site ${siteId}`)
        const dataset = await trieve.getDatasetByTrackingId(siteId)
        if (!dataset) {
            throw new Error(
                'Trieve dataset not found even if it already exists',
            )
        }
        datasetId = dataset.id
    }

    console.log(`Created Trieve dataset with ID: ${datasetId}`)

    console.log(`Creating read-only API key for dataset ${datasetId}...`)
    const token = await trieve.createOrganizationApiKey({
        name: `read only for site ${siteId}`,
        role: 0,

        dataset_ids: [datasetId],
    })
    console.log(`API key created successfully`)

    trieve.datasetId = datasetId
    console.log(`Updating site record with Trieve dataset information...`)
    await prisma.site.update({
        where: { siteId },
        data: {
            trieveDatasetId: datasetId,
            trieveReadApiKey: token.api_key,
        },
    })
    console.log(`Site record updated with Trieve dataset ID and API key`)
    return { datasetId: datasetId }
}

export async function publicFileMapUrl({
    owner,
    repo,
    branch,
    imgPath,
}: {
    owner: string
    repo: string
    branch: string
    imgPath: string
}) {
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}${imgPath}`
}

function isValidUrl(string: string): boolean {
    return string.startsWith('http://') || string.startsWith('https://')
}

export function findMatchInPaths({
    filePath,
    paths,
}: {
    paths: string[]
    filePath: string
}) {
    // hashes are alright
    if (!filePath) {
        return ''
    }
    if (isAbsoluteUrl(filePath)) {
        return filePath
    }
    const normalized = normalizeFilePathForSearch(filePath)
    let found = paths.find((x) => {
        if (x === normalized) {
            return true
        }
        if (x.endsWith(normalized)) {
            return true
        }
        return false
    })
    return found || ''
}

function normalizeFilePathForSearch(filePath: string) {
    if (filePath.startsWith('/')) {
        filePath = filePath.slice(1)
    }
    let parts = filePath.split('/').filter(Boolean)
    // remove relative parts
    parts = parts.filter((x) => {
        if (x === '.') {
            return false
        }
        if (x === '..') {
            return false
        }
        return true
    })
    return parts.join('/')
}

function isAbsoluteUrl(url: string) {
    if (!url) {
        return false
    }
    let abs = [
        '#',
        'https://',
        'http://',
        'mailto:', //
    ].some((x) => url.startsWith(x))
    return abs
}

function generateSlugFromPath(pathWithFrontSlash: string, basePath) {
    if (isAbsoluteUrl(pathWithFrontSlash)) {
        return pathWithFrontSlash
    }
    if (pathWithFrontSlash.startsWith(basePath)) {
        pathWithFrontSlash = pathWithFrontSlash.slice(basePath.length)
    }
    if (pathWithFrontSlash.startsWith('/')) {
        pathWithFrontSlash = pathWithFrontSlash.slice(1)
    }
    let res =
        '/' +
        pathWithFrontSlash
            .replace(/\.mdx?$/, '')
            // .replace(/\/index$/, '')
            .replace(/\//g, '-') // framer does not support folders inside CMS, you will need to create separate collections for each folderF
    return res
}
