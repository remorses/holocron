import { createHash } from 'crypto'
import { MarkdownExtension, Prisma, prisma } from 'db'
import { Sema } from 'sema4'
import { request } from 'undici'
import { Readable } from 'node:stream'

import { DomainType } from 'db/src/generated/enums'
import { DocsJsonType } from 'docs-website/src/lib/docs-json'
import {
    DocumentRecord,
    StructuredData,
    ProcessorData,
} from 'docs-website/src/lib/mdx-heavy'
import { processMdxInServer } from 'docs-website/src/lib/mdx.server'
import { MdastToJsx } from 'safe-mdx'
import { mdxComponents } from 'docs-website/src/components/mdx-components'
import {
    getCacheTagForMediaAsset,
    getKeyForMediaAsset,
    s3,
} from 'docs-website/src/lib/s3'
import { generateSlugFromPath } from 'docs-website/src/lib/utils'
import path from 'path'
import { ChunkReqPayload, TrieveSDK } from 'trieve-ts-sdk'
import { cloudflareClient } from './cloudflare'
import { env } from './env'
import { notifyError } from './errors'
import {
    addFrontSlashToPath,
    checkGitHubIsInstalled,
    getOctokit,
    getRepoFiles,
    isMarkdown,
} from './github.server'
import { mdxRegex, yieldTasksInParallel } from './utils'
import { imageDimensionsFromData } from 'image-dimensions'

export function gitBlobSha(
    content: string | Buffer,
    algo: 'sha1' | 'sha256' = 'sha1',
): string {
    const body = Buffer.isBuffer(content)
        ? content
        : Buffer.from(content, 'utf8')

    // Build the canonical Git header:  `blob <size>\0`
    const header = Buffer.from(`blob ${body.length}\0`, 'utf8')

    // Concatenate header + body and hash
    return createHash(algo)
        .update(Buffer.concat([header, body]))
        .digest('hex')
}

export type AssetForSync =
    | {
          type: 'page'
          totalPages: number
          markdown: string
          githubPath: string
          githubSha: string
      }
    | {
          type: 'mediaAsset'
          githubSha: string
          downloadUrl: string
          githubPath: string
          width?: number
          height?: number
          bytes?: number
      }
    | {
          type: 'metaFile'
          content: string
          githubPath: string
          githubSha: string
      }
    | {
          type: 'docsJson'
          content: string
          githubPath: string
          githubSha: string
      }
    | {
          type: 'stylesCss'
          content: string
          githubPath: string
          githubSha: string
      }

export const mediaExtensions = [
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

export function isMediaFile(path: string): boolean {
    if (!path) return false
    return mediaExtensions.some((ext) => path.toLowerCase().endsWith(ext))
}

export async function syncSite({
    siteId,
    trieveDatasetId,
    branchId,
    pages,
}: {
    siteId: string
    trieveDatasetId?: string
    name?: string
    branchId: string
    orgId: string
    pages: AsyncIterable<AssetForSync>
}) {
    console.log('Starting import script...')

    // Find existing domain or create a new one
    console.log(`Looking for existing internal domain for site: ${siteId}...`)

    console.log(`Using site: ${siteId}`)

    // --- 1. Find or create the Branch ---
    // Use upsert to find or create the branch in a single operation
    console.log(`Upserting branch with ID: ${branchId} for site: ${siteId}...`)
    const branch = await prisma.siteBranch.upsert({
        where: {
            branchId: branchId,
        },
        update: {
            siteId,
        }, // No updates needed if it exists
        create: {
            siteId: siteId,
            title: 'Main',
            branchId,
        },
    })
    console.log(`Branch upsert complete: ${branch.branchId} (${branch.title})`)

    await syncFiles({
        branchId,
        siteId,
        trieveDatasetId,
        files: pages,
    })
}

export async function* pagesFromFilesList({
    files,
    docsJson,
}: {
    files: {
        relativePath: string
        contents: string
        downloadUrl?: string
        metadata?: { width?: number; height?: number; bytes?: number }
    }[]
    docsJson?: DocsJsonType
}): AsyncGenerator<AssetForSync & { filePath: string; content: string }> {
    // First handle meta.json files
    const metaFiles = files.filter((file) =>
        file.relativePath.endsWith('meta.json'),
    )
    for (const file of metaFiles) {
        let jsonData
        try {
            jsonData = JSON.parse(file.contents)
        } catch {
            jsonData = {}
        }
        yield {
            type: 'metaFile',
            content: file.contents,
            githubPath: file.relativePath,
            githubSha: gitBlobSha(file.contents),
            filePath: file.relativePath,
        }
    }

    // Now yield fumabase.json if provided
    if (docsJson !== undefined) {
        const content =
            typeof docsJson === 'string'
                ? docsJson
                : JSON.stringify(docsJson, null, 2)
        yield {
            type: 'docsJson',
            content,
            githubPath: 'fumabase.json',
            githubSha: gitBlobSha(content),
            filePath: 'fumabase.json',
        }
    }

    // Handle styles.css
    const stylesCssFile = files.find(
        (file) => file.relativePath === 'styles.css',
    )
    if (stylesCssFile) {
        yield {
            type: 'stylesCss',
            content: stylesCssFile.contents,
            githubPath: stylesCssFile.relativePath,
            githubSha: gitBlobSha(stylesCssFile.contents),
            filePath: stylesCssFile.relativePath,
        }
    }

    // Handle media assets
    const mediaFiles = files.filter((file) => isMediaFile(file.relativePath))
    for (const file of mediaFiles) {
        yield {
            type: 'mediaAsset',
            githubSha: gitBlobSha(file.contents || file.downloadUrl || ''),
            downloadUrl: file.downloadUrl || '', // Use provided downloadUrl or empty for local files
            githubPath: file.relativePath,
            width: file.metadata?.width,
            height: file.metadata?.height,
            bytes: file.metadata?.bytes,
            filePath: file.relativePath,
            content: file.contents,
        }
    }

    // Handle markdown/MDX files
    const markdownFiles = files.filter((file) => isMarkdown(file.relativePath))
    const totalPages = markdownFiles.length

    for (const file of markdownFiles) {
        yield {
            type: 'page',
            totalPages,
            markdown: file.contents,
            githubPath: file.relativePath,
            githubSha: gitBlobSha(file.contents),
            filePath: file.relativePath,
            content: file.contents,
        }
    }
}

export async function syncFiles({
    branchId,
    siteId,
    trieveDatasetId,
    files,
    name,
    signal,
}: {
    files: AsyncIterable<AssetForSync>
    branchId: string
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
        try {
            const { datasetId } = await createTrieveDataset({
                siteId,
                branchId,
                name,
            })
            trieve.datasetId = datasetId
        } catch (e) {
            notifyError(e)
        }
    }
    const cacheTagsToInvalidate = [] as string[]
    const processedSlugs = new Set<string>()
    for await (const asset of files) {
        await semaphore.acquire() // Acquire permit for file processing
        try {
            if (asset.type === 'metaFile') {
                let jsonData
                try {
                    jsonData = JSON.parse(asset.content)
                } catch {
                    jsonData = {}
                }
                await prisma.metaFile.upsert({
                    where: {
                        githubPath_branchId: {
                            githubPath: asset.githubPath,
                            branchId,
                        },
                    },
                    update: {
                        githubSha: asset.githubSha,
                        githubPath: asset.githubPath,
                        jsonData,
                        branchId,
                    },
                    create: {
                        githubPath: asset.githubPath,
                        jsonData,
                        branchId,
                        githubSha: asset.githubSha,
                    },
                })
            }
            if (asset.type === 'docsJson') {
                console.log(`Updating docsJson for branch ${branchId}`)
                let jsonData
                try {
                    // TODO add support for jsonc
                    jsonData = JSON.parse(asset.content)
                } catch {
                    console.error(
                        `Failed to parse docsJson content, using empty object. Content:`,
                        asset.content,
                    )
                    jsonData = {}
                }
                await prisma.siteBranch.update({
                    where: { branchId },
                    data: { docsJson: jsonData },
                })

                // Handle domain connections
                if (jsonData.domains && Array.isArray(jsonData.domains)) {
                    const existingDomains = await prisma.domain.findMany({
                        where: { branchId },
                        select: { host: true },
                    })
                    const existingHosts = new Set(
                        existingDomains.map((d) => d.host),
                    )

                    const domainsToConnect = jsonData.domains.filter(
                        (domain: string) => !existingHosts.has(domain),
                    )

                    if (domainsToConnect.length > 0) {
                        console.log(
                            `Connecting ${domainsToConnect.length} new domains for site ${siteId}`,
                        )
                        for (const host of domainsToConnect) {
                            const domainTaken = await prisma.domain.findFirst({
                                where: { host },
                            })
                            if (domainTaken) {
                                console.log(
                                    `Domain ${host} is already taken, skipping.`,
                                )
                                // TODO add a way to show errors to the user in cases like this (domain already taken), if domain is already taken, send them an email?
                                continue
                            }
                            await cloudflareClient.createDomain(host)
                            const domainType: DomainType = host.endsWith(
                                '.' + env.APPS_DOMAIN,
                            )
                                ? 'internalDomain'
                                : 'customDomain'
                            await prisma.domain.create({
                                data: {
                                    host,
                                    branchId,
                                    domainType,
                                },
                            })
                        }
                    }
                }
            }
            if (asset.type === 'stylesCss') {
                console.log(`Updating stylesCss for branch ${branchId}`)
                await prisma.siteBranch.update({
                    where: { branchId },
                    data: { cssStyles: asset.content },
                })
            }
            if (asset.type === 'mediaAsset') {
                const slug = asset.githubPath
                    .replace(/\\/g, '/')
                    .replace(/^\/+/, '')
                const downloadUrl = asset.downloadUrl

                let imageMetadata = {
                    width: asset.width,
                    height: asset.height,
                    bytes: asset.bytes,
                }

                // Check if this is an image file based on extension
                const isImage = [
                    '.jpg',
                    '.jpeg',
                    '.png',
                    '.gif',
                    '.bmp',
                    '.webp',
                    '.tif',
                    '.tiff',
                    '.avif',
                ].some((ext) => asset.githubPath.toLowerCase().endsWith(ext))

                async function uploadAndGetMetadata() {
                    if (!downloadUrl) return imageMetadata

                    // Skip downloading/uploading if the downloadUrl is from our own uploads base URL
                    if (
                        downloadUrl &&
                        isValidUrl(downloadUrl) &&
                        downloadUrl.startsWith(env.UPLOADS_BASE_URL!)
                    ) {
                        console.log(
                            `Skipping upload for asset ${slug} as it is already hosted at UPLOADS_BASE_URL (${env.UPLOADS_BASE_URL})`,
                        )
                        return imageMetadata
                    }

                    const readable = await request(downloadUrl, { signal })

                    const ok =
                        readable.statusCode >= 200 && readable.statusCode < 300
                    if (!ok) {
                        throw new Error(
                            `Failed to download asset ${readable.statusCode} ${slug}`,
                        )
                    }
                    if (!readable.body) {
                        throw new Error(`Failed to get body for asset ${slug}`)
                    }

                    const key = getKeyForMediaAsset({ siteId, slug })

                    // Download the full file
                    const buffer = Buffer.from(
                        await readable.body.arrayBuffer(),
                    )
                    imageMetadata.bytes = buffer.length

                    // For images, extract dimensions
                    if (isImage) {
                        try {
                            const dimensions = imageDimensionsFromData(buffer)
                            if (dimensions) {
                                imageMetadata.width = dimensions.width
                                imageMetadata.height = dimensions.height
                            }
                        } catch (error) {
                            // Continue without dimensions
                        }
                    }

                    await s3.file(key).write(buffer)

                    const cacheTag = getCacheTagForMediaAsset({
                        siteId,
                        slug,
                    })
                    cacheTagsToInvalidate.push(cacheTag)

                    return imageMetadata
                }

                console.log(`uploading media asset ${asset.githubPath}`)

                // First download and get metadata
                const metadata = await uploadAndGetMetadata()

                // Then update database with the metadata
                await prisma.mediaAsset.upsert({
                    where: {
                        slug_branchId: {
                            branchId,
                            slug,
                        },
                    },
                    update: {
                        siteId,
                        slug,
                        branchId,
                        width: metadata.width,
                        height: metadata.height,
                        bytes: metadata.bytes,
                    },
                    create: {
                        githubSha: asset.githubSha,
                        siteId,
                        slug,
                        githubPath: asset.githubPath,
                        branchId,
                        width: metadata.width,
                        height: metadata.height,
                        bytes: metadata.bytes || 0,
                    },
                })
            }
            if (asset.type === 'page') {
                const entrySlug =
                    '/' +
                    asset.githubPath.replace(/\\/g, '/').replace(mdxRegex, '')
                const extension = asset.githubPath.endsWith('.mdx')
                    ? 'mdx'
                    : 'md'

                if (processedSlugs.has(entrySlug)) {
                    console.log(
                        `Skipping duplicate page with slug: ${entrySlug}`,
                    )
                    continue
                }

                let data: ProcessorData
                let errors: Array<{
                    errorMessage: string;
                    line: number;
                    errorType: 'mdxParse' | 'mdParse' | 'render'
                }> = []

                let markdown = asset.markdown
                try {
                    const result = await processMdxInServer({
                        markdown: asset.markdown,
                        githubPath: asset.githubPath,
                        extension: extension as MarkdownExtension,
                    })
                    data = result.data

                    // Run safe-mdx validation to discover component errors
                    try {
                        const visitor = new MdastToJsx({
                            markdown: asset.markdown,
                            mdast: data.ast,
                            components: mdxComponents,
                        })
                        visitor.run()

                        // Add safe-mdx errors as render errors
                        if (visitor.errors && visitor.errors.length > 0) {
                            for (const safeMdxError of visitor.errors) {
                                errors.push({
                                    errorMessage: safeMdxError.message,
                                    line: safeMdxError.line || 1,
                                    errorType: 'render',
                                })
                            }
                        }
                    } catch (safeMdxError: any) {
                        markdown = ''
                        // If safe-mdx throws an error, add it as a render error
                        errors.push({
                            errorMessage: `Component validation error: ${safeMdxError.message}`,
                            line: 1,
                            errorType: 'render',
                        })
                    }
                } catch (error: any) {
                    markdown = ''
                    const line =
                        'line' in error && typeof error.line === 'number'
                            ? error.line
                            : 1
                    // Determine error type based on the extension
                    const errorType = extension === 'mdx' ? 'mdxParse' : 'mdParse'
                    errors.push({
                        errorMessage: error.message,
                        line,
                        errorType,
                    })
                    console.error(
                        `Failed to process ${asset.githubPath}:`,
                        error.message,
                    )
                    // Create placeholder data for failed processing
                    data = {
                        title: asset.githubPath,
                        frontmatter: {},
                        structuredData: { headings: [], contents: [] },
                        ast: { type: 'root', children: [] },
                        toc: [],
                    }
                }

                const pageInput = {
                    slug: entrySlug,
                    title: data.title || '',
                    markdown, // Empty markdown for failed pages
                    frontmatter: data.frontmatter,
                    githubPath: asset.githubPath,
                    githubSha: asset.githubSha,
                    extension: extension as MarkdownExtension,
                    description: data?.frontmatter?.description || '',
                    structuredData: data.structuredData as any,
                }

                const structuredData = data.structuredData

                chunksToSync.push(
                    ...processForTrieve({
                        _id: entrySlug,
                        title: pageInput.title || entrySlug,
                        url: entrySlug,
                        structured: structuredData,
                        pageSlug: entrySlug,
                    }),
                )

                console.log(
                    `Upserting page with slug: ${entrySlug}, title: ${pageInput.title}...`,
                )
                await Promise.all([
                    prisma.$transaction(async (prisma) => {
                        // Upsert the page
                        const page = await prisma.markdownPage.upsert({
                            where: {
                                branchId_slug: { branchId, slug: entrySlug },
                            },
                            update: pageInput,
                            create: { ...pageInput, branchId },
                        })

                        // Delete existing sync errors for this page
                        await prisma.markdownPageSyncError.deleteMany({
                            where: { pageId: page.pageId },
                        })

                        // Create new sync errors if there were processing errors
                        if (errors.length > 0) {
                            for (const error of errors) {
                                await prisma.markdownPageSyncError.create({
                                    data: {
                                        pageId: page.pageId,
                                        line: error.line,
                                        errorMessage: error.errorMessage,
                                        errorType: error.errorType,
                                    },
                                })
                            }
                        }

                        console.log(
                            `Page upsert complete: ${page.pageId} (${page.title})${errors.length > 0 ? ` with ${errors.length} error(s)` : ''}`,
                        )

                        return page
                    }),
                    chunksToSync.length >= chunkSize &&
                        (async () => {
                            if (trieve.datasetId) {
                                console.log(
                                    `Syncing ${chunkSize} chunks to Trieve...`,
                                )
                                await trieve.createChunk(
                                    chunksToSync.slice(0, chunkSize),
                                )
                            }
                            console.log('Chunks synced to Trieve successfully.')
                            chunksToSync = chunksToSync.slice(chunkSize)
                        })(),
                ])
                processedSlugs.add(entrySlug)
                console.log(
                    ` -> Upserted page: ${pageInput.title} (ID: ${entrySlug})`,
                )
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
        if (trieve.datasetId) {
            await Promise.all(groups.map((group) => trieve.createChunk(group)))
        }
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

export function isMetaFile(path: string) {
    if (!path) return false
    return path.endsWith('/meta.json') || path === 'meta.json'
}

export function isDocsJsonFile(path: string): boolean {
    if (!path) return false
    return path === 'fumabase.json' || path === 'fumabase.jsonc'
}

export function isStylesCssFile(path: string): boolean {
    if (!path) return false
    return path === 'styles.css'
}

export async function* filesFromGithub({
    repo,
    owner,
    installationId,
    branchId,
    basePath = '',
    signal,
    onlyGithubPaths = new Set<string>(),
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
                branchId,
            },
            select: {
                githubSha: true,
                slug: true,
                githubPath: true,
            },
        }),
        prisma.mediaAsset.findMany({
            where: {
                branchId,
            },
        }),
        prisma.metaFile.findMany({
            where: {
                branchId,
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
                console.log(`Skipping file ${file.path} because sha is missing`)
                return false
            }
            if (!pathWithFrontSlash?.startsWith(basePath)) {
                console.log(
                    `Skipping file ${file.path} because path does not start with basePath (${basePath})`,
                )
                return false
            }
            if (
                !isMarkdown(pathWithFrontSlash) &&
                !isMetaFile(pathWithFrontSlash) &&
                !isDocsJsonFile(pathWithFrontSlash) &&
                !isStylesCssFile(pathWithFrontSlash)
            ) {
                console.log(
                    `Skipping file ${file.path} because it is not a markdown, meta, fumabase.json, or styles.css file`,
                )
                return false
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
                    githubSha: x.sha,
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
        const meta: AssetForSync = {
            type: 'metaFile',
            content: file.content || '{}',
            githubPath: file.githubPath,
            githubSha: file.sha,
        }
        yield meta
    }

    // Process fumabase.json file (root only)
    const docsJsonFile = files.find((x) => {
        if (
            x.content == null ||
            !x?.pathWithFrontSlash?.startsWith(basePath) ||
            !isDocsJsonFile(x.pathWithFrontSlash)
        ) {
            return false
        }
        if (forceFullSync) return true
        return !existingPathsPlusSha.has(x.githubPath + x.sha)
    })

    if (docsJsonFile) {
        const docsJson: AssetForSync = {
            type: 'docsJson',
            content: docsJsonFile.content || '{}',
            githubPath: docsJsonFile.githubPath,
            githubSha: docsJsonFile.sha,
        }
        yield docsJson
    }

    // Process styles.css file (root only)
    const stylesCssFile = files.find((x) => {
        if (
            x.content == null ||
            !x?.pathWithFrontSlash?.startsWith(basePath) ||
            !isStylesCssFile(x.pathWithFrontSlash)
        ) {
            return false
        }
        if (forceFullSync) return true
        return !existingPathsPlusSha.has(x.githubPath + x.sha)
    })

    if (stylesCssFile) {
        const stylesCss: AssetForSync = {
            type: 'stylesCss',
            content: stylesCssFile.content || '',
            githubPath: stylesCssFile.githubPath,
            githubSha: stylesCssFile.sha,
        }
        yield stylesCss
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

        yield {
            type: 'page',
            totalPages,
            markdown: content,
            githubPath: x.githubPath,
            githubSha: x.sha,
        } satisfies AssetForSync
    }
}

export async function deletePages({
    slugs,
    siteId,
    branchId,
}: {
    slugs: string[]
    siteId: string
    branchId: string
}) {
    console.log(
        `Deleting pages with slugs: ${slugs.join(', ')} from branch ${branchId} in site ${siteId}`,
    )

    // 1. Get the branch to retrieve the Trieve dataset ID
    const branch = await prisma.siteBranch.findUnique({
        where: { branchId },
        select: { trieveDatasetId: true },
    })

    if (!branch) {
        throw new Error(`Branch with ID ${branchId} not found`)
    }

    // 2. Initialize Trieve SDK if we have a dataset ID
    let trieve: TrieveSDK | undefined
    if (branch.trieveDatasetId) {
        trieve = new TrieveSDK({
            apiKey: env.TRIEVE_API_KEY!,
            organizationId: env.TRIEVE_ORGANIZATION_ID!,
            datasetId: branch.trieveDatasetId,
        })
        console.log(
            `Initialized Trieve SDK with dataset ID: ${branch.trieveDatasetId}`,
        )
    } else {
        console.log(
            `No Trieve dataset found for site ${siteId}, skipping Trieve cleanup`,
        )
    }

    // 3. For each slug, find all pages that have that slug or start with that slug + "/"
    for (const rootSlug of slugs) {
        // Find the main page and all its children
        console.log(`Finding pages for slug ${rootSlug} in branch ${branchId}`)
        const pagesToDelete = await prisma.markdownPage.findMany({
            where: {
                branchId,
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
            console.log(
                `No pages found for slug ${rootSlug} in branch ${branchId}`,
            )
            continue
        }

        console.log(
            `Found ${pagesToDelete.length} pages to delete for slug ${rootSlug}`,
        )

        // 4. Delete chunks from Trieve if available (do this before deleting pages from DB)
        if (trieve && branch.trieveDatasetId) {
            for (const page of pagesToDelete) {
                try {
                    console.log(
                        `Deleting chunks for page ${page.slug} from Trieve`,
                    )

                    await trieve.deleteGroup({
                        deleteChunks: true,
                        groupId: page.slug,
                        trDataset: branch.trieveDatasetId,
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
                branchId,
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

async function createTrieveDataset({ siteId, branchId, name }) {
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
    await prisma.siteBranch.update({
        where: { branchId },
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

function safeJsonParse(str: string, defaultValue: any = {}) {
    try {
        return JSON.parse(str)
    } catch {
        return defaultValue
    }
}
