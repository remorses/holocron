import { Sema } from 'sema4'
import { request } from 'undici'
import { findMatchInPaths } from 'docs-website/src/lib/html.server'
import { MarkdownExtension, Prisma, prisma } from 'db'
import exampleDocs from 'website/scripts/example-docs.json'

import { processMdxInServer } from 'docs-website/src/lib/mdx.server'
import { DocumentRecord, StructuredData } from 'docs-website/src/lib/mdx'
import path from 'path'
import { ChunkReqPayload, TrieveSDK } from 'trieve-ts-sdk'
import { env } from './env'
import { notifyError } from './errors'
import {
    addInitialSlashToPath as addFrontSlashToPath,
    checkGitHubIsInstalled,
    getOctokit,
    getRepoFiles,
    isMarkdown,
} from './github.server'
import { yieldTasksInParallel, mdxRegex } from './utils'
import { isAbsoluteUrl } from 'docs-website/src/lib/utils'
import {
    getCacheTagForMediaAsset,
    getKeyForMediaAsset,
    s3,
} from 'docs-website/src/lib/s3'
import { cloudflareClient } from './cloudflare'

export type AssetForSync =
    | {
          type: 'page'
          totalPages: number
          pageInput: Omit<Prisma.MarkdownPageUncheckedCreateInput, 'tabId'>
          structuredData: StructuredData
      }
    | {
          type: 'mediaAsset'
          slug: string
          sha: string
          downloadUrl: string
          githubPath: string
      }
    | {
          type: 'metaFile'
          jsonData: any
          githubPath: string
          githubSha: string
      }

const mediaExtensions = [
    // Image extensions
    'jpg',
    'jpeg',
    'png',
    'gif',
    'bmp',
    'webp',
    'svg',
    'ico',
    'tif',
    'tiff',
    'avif',
    // Video extensions
    'mp4',
    'mov',
    'avi',
    'wmv',
    'flv',
    'webm',
    'mkv',
    'm4v',
    '3gp',
    'ogg',
    'ogv',
].map((x) => '.' + x)

export async function syncSite({
    siteId,
    trieveDatasetId,
    tabId,
    pages,
}: {
    siteId: string
    trieveDatasetId?: string
    name?: string
    tabId: string
    orgId: string
    pages: AsyncIterable<AssetForSync>
}) {
    console.log('Starting import script...')

    // Find existing domain or create a new one
    console.log(`Looking for existing internal domain for site: ${siteId}...`)

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
        trieveDatasetId,
        pages,
    })
}

export async function* pagesFromExampleJson(): AsyncGenerator<
    AssetForSync & { filePath: string; content: string }
> {
    const totalPages = exampleDocs.length
    for (let doc of exampleDocs) {
        const entryRelativePath = doc.relativePath
        const entrySlug =
            '/' + entryRelativePath.replace(/\\/g, '/').replace(mdxRegex, '')
        const { data } = await processMdxInServer({
            markdown: doc.contents,
            extension:
                doc.relativePath.split('.').pop() === 'mdx' ? 'mdx' : 'md',
        })
        const page = {
            type: 'page',
            totalPages,
            pageInput: {
                slug: entrySlug,
                title: data.title || '',
                markdown: doc.contents,
                frontmatter: data.frontmatter,
                githubPath: entryRelativePath,
                githubSha: '',
            },

            structuredData: data.structuredData,
        } satisfies AssetForSync
        yield { ...page, content: doc.contents, filePath: entryRelativePath }
    }
}

export async function syncPages({
    tabId,
    siteId,
    trieveDatasetId,
    pages,
    name,
    signal,
}: {
    pages: AsyncIterable<AssetForSync>
    tabId: string
    siteId: string
    trieveDatasetId?: string
    name?: string
    signal?: AbortSignal
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
    const cacheTagsToInvalidate = [] as string[]
    const processedSlugs = new Set<string>()
    for await (const asset of pages) {
        await semaphore.acquire() // Acquire permit for file processing
        try {
            if (asset.type === 'metaFile') {
                await prisma.metaFile.upsert({
                    where: {
                        githubPath_tabId: {
                            githubPath: asset.githubPath,
                            tabId,
                        },
                    },
                    update: {
                        githubSha: asset.githubSha,
                        githubPath: asset.githubPath,
                        jsonData: asset.jsonData,
                        tabId,
                    },
                    create: {
                        githubPath: asset.githubPath,
                        jsonData: asset.jsonData,
                        tabId,
                        githubSha: asset.githubSha,
                    },
                })
            }
            if (asset.type === 'mediaAsset') {
                const slug = asset.slug

                const downloadUrl = asset.downloadUrl

                async function upload() {
                    const response = await request(downloadUrl, { signal })
                    const ok =
                        response.statusCode >= 200 && response.statusCode < 300
                    if (!ok) {
                        throw new Error(
                            `Failed to download asset ${response.statusCode} ${slug}`,
                        )
                    }
                    if (!response.body) {
                        throw new Error(`Failed to get body for asset ${slug}`)
                    }
                    const key = getKeyForMediaAsset({ siteId, slug, tabId })
                    await s3.file(key).write(response.body)
                    const cacheTag = getCacheTagForMediaAsset({
                        siteId,
                        slug,
                        tabId,
                    })
                    cacheTagsToInvalidate.push(cacheTag)
                }
                console.log(`uploading media asset ${asset.githubPath}`)
                await Promise.all([
                    upload(),
                    prisma.mediaAsset.upsert({
                        where: {
                            slug_tabId: {
                                tabId,
                                slug,
                            },
                        },
                        update: {
                            siteId,
                            slug,
                            tabId,
                        },
                        create: {
                            githubSha: asset.sha,
                            siteId,
                            slug,
                            githubPath: asset.githubPath,
                            tabId,
                        },
                    }),
                ])
            }
            if (asset.type === 'page') {
                const { slug, title } = asset.pageInput
                const structuredData = asset.structuredData
                if (processedSlugs.has(slug)) {
                    console.log(
                        `Skipping duplicate page with slug: ${slug}, title: ${title}`,
                    )
                    continue
                }

                chunksToSync.push(
                    ...processForTrieve({
                        _id: slug,
                        title: title || slug,
                        url: slug,
                        structured: structuredData,
                        pageSlug: slug,
                    }),
                )

                console.log(
                    `Upserting page with slug: ${slug}, title: ${title}...`,
                )
                await Promise.all([
                    prisma.markdownPage
                        .upsert({
                            where: { tabId_slug: { tabId, slug } },
                            update: asset.pageInput,
                            create: { ...asset.pageInput, tabId },
                        })
                        .then((page) => {
                            console.log(
                                `Page upsert complete: ${page.pageId} (${page.title})`,
                            )
                        }),
                    chunksToSync.length >= chunkSize &&
                        (async () => {
                            console.log(
                                `Syncing ${chunkSize} chunks to Trieve...`,
                            )
                            await trieve.createChunk(
                                chunksToSync.slice(0, chunkSize),
                            )
                            console.log('Chunks synced to Trieve successfully.')
                            chunksToSync = chunksToSync.slice(chunkSize)
                        })(),
                ])
                processedSlugs.add(slug)
                console.log(` -> Upserted page: ${title} (ID: ${slug})`)
            }
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
        }
    }
    if (cacheTagsToInvalidate.length) {
        await cloudflareClient.invalidateCacheTags(cacheTagsToInvalidate)
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

function isMetaFile(path: string) {
    if (!path) return false
    return path.endsWith('/meta.json') || path === 'meta.json'
}

export async function* pagesFromGithub({
    repo,
    owner,
    installationId,
    tabId,
    basePath = '',
    signal,
    onlyGithubPaths = new Set<string>(), // TODO probably not needed
    forceFullSync = false,
}) {
    if (!installationId) throw new Error('Installation ID is required')
    const octokit = await getOctokit({ installationId })
    const timeId = Date.now()
    const [
        repoResult,
        ok,
        existingPages,
        existingMediaAssets,
        existingMetaFiles,
    ] = await Promise.all([
        octokit.rest.repos.get({
            owner,
            repo,
            request: { signal },
        }),
        checkGitHubIsInstalled({ installationId }),
        prisma.markdownPage.findMany({
            where: {
                tabId,
            },
            select: {
                githubSha: true,
                slug: true,
                githubPath: true,
            },
        }),
        prisma.mediaAsset.findMany({
            where: {
                tabId,
            },
        }),
        prisma.metaFile.findMany({
            where: {
                tabId,
            },
        }),
    ])
    console.timeEnd(`${owner}/${repo} - repo checks ${timeId}`)

    if (!ok) {
        throw new Error('Github app no longer installed')
    }
    let branch = repoResult.data.default_branch
    const existingPathsPlusSha = new Set<string>(
        existingPages
            .map((f) => f.githubPath + f.githubSha)
            .concat(
                existingMetaFiles.map((f) => f.githubPath + f.githubSha),
                existingMediaAssets.map((f) => f.githubPath + f.githubSha),
            ),
    )
    const existingSlugs = new Set(existingPages.map((f) => f.slug))
    let maxBlobFetches = 10_000
    let blobFetches = 0

    console.time(`${owner}/${repo} - fetch files ${timeId}`)
    const files = await getRepoFiles({
        fetchBlob(file) {

            let pathWithFrontSlash = addFrontSlashToPath(file.path || '')
            if (!file.sha) {
                console.log(`Skipping file ${file.path} because sha is missing`);
                return false;
            }
            if (!pathWithFrontSlash?.startsWith(basePath)) {
                console.log(`Skipping file ${file.path} because path does not start with basePath (${basePath})`);
                return false;
            }
            if (!isMarkdown(pathWithFrontSlash) && !isMetaFile(pathWithFrontSlash)) {
                console.log(`Skipping file ${file.path} because it is neither markdown nor meta file`);
                return false;
            }
            if (forceFullSync) return true
            if (onlyGithubPaths.size && file.path) {
                return onlyGithubPaths.has(file.path)
            }
            if (file.sha && existingPathsPlusSha.has(file.path + file.sha)) {
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
    // console.log(files)
    const mediaAssetsDownloads = yieldTasksInParallel(
        6,
        files
            .filter((x) => {
                return (
                    x?.pathWithFrontSlash?.startsWith(basePath) &&
                    mediaExtensions.some((ext) => {
                        return x.githubPath.endsWith(ext)
                    })
                )
            })
            .filter((x) => {
                if (forceFullSync) return true
                return !existingPathsPlusSha.has(x.githubPath + x.sha)
            })
            .map((x) => async () => {
                const slug = generateSlugFromPath(x.githubPath, basePath)

                const res = await octokit.rest.repos.getContent({
                    owner,
                    repo,
                    path: x.githubPath,
                    ref: branch,
                    request: { signal },
                })
                if (!('download_url' in res.data)) {
                    throw new Error('Could not get download url for image')
                }
                console.log('download url', res.data.download_url)
                const downloadUrl = res.data.download_url || ''
                const asset: AssetForSync = {
                    type: 'mediaAsset',
                    slug,
                    sha: x.sha,
                    githubPath: x.githubPath,
                    downloadUrl,
                }
                return asset
            }),
    )
    for await (let upload of mediaAssetsDownloads) {
        yield upload
    }
    const onlyMetaFiles = files
        .filter((x) => {
            if (
                x.content == null ||
                !x?.pathWithFrontSlash?.startsWith(basePath) ||
                !isMetaFile(x.pathWithFrontSlash)
            ) {
                return false
            }
            return true
        })
        .filter((x) => {
            if (forceFullSync) return true
            return !existingPathsPlusSha.has(x.githubPath + x.sha)
        })

    for (let file of onlyMetaFiles) {
        const jsonData = safeJsonParse(file.content || '{}')
        if (!jsonData) {
            console.log('skipping meta file for invalid json', file.githubPath)
            continue
        }
        const meta: AssetForSync = {
            type: 'metaFile',
            jsonData,
            githubPath: file.githubPath,
            githubSha: file.sha,
        }
        yield meta
    }

    let onlyMarkdown = files.filter((x) => {
        if (x.content == null) {
            console.log(`Skipping file ${x.githubPath} because content is null`)
            return false
        }
        if (!x?.pathWithFrontSlash?.startsWith(basePath)) {
            console.log(
                `Skipping file ${x.githubPath} because path does not start with basePath (${basePath})`,
            )
            return false
        }
        if (!isMarkdown(x.pathWithFrontSlash)) {
            console.log(
                `Skipping file ${x.githubPath} because it is not a markdown file`,
            )
            return false
        }
        return true
    })

    console.log(
        `found ${onlyMarkdown.length} files to sync, from ${files.filter((x) => x?.pathWithFrontSlash?.startsWith(basePath) && isMarkdown(x?.pathWithFrontSlash)).length} total files`,
    )

    console.time(`${owner}/${repo} - process markdown ${timeId}`)
    const slugsFound = new Set<string>()
    let totalPages = onlyMarkdown.length
    let pagesToSync = onlyMarkdown
    if (onlyGithubPaths.size) {
        pagesToSync = onlyMarkdown.filter((x) =>
            onlyGithubPaths.has(x.pathWithFrontSlash),
        )
    }
    for (const x of pagesToSync) {
        if (x?.content == null) {
            continue
        }

        const pathWithFrontSlash = x.pathWithFrontSlash
        let content = x.content
        let extension: MarkdownExtension = path
            .extname(x.pathWithFrontSlash)
            ?.endsWith('mdx')
            ? 'mdx'
            : 'md'
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
        const { data } = await processMdxInServer({
            markdown: x.content,

            extension,
        })

        let frontmatter = data.frontmatter
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
                structuredData: data.structuredData as any,
                // ast: data.ast
            },
            structuredData: data.structuredData,
            totalPages,
            type: 'page',
        } satisfies AssetForSync
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
        '/' + pathWithFrontSlash.replace(/\.mdx?$/, '').replace(/\/index$/, '')

    return res
}

function safeJsonParse(str: string, defaultValue: any = {}) {
    try {
        return JSON.parse(str)
    } catch {
        return defaultValue
    }
}
