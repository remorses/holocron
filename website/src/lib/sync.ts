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
    addFrontSlashToPath,
    checkGitHubIsInstalled,
    getOctokit,
    getRepoFiles,
    isMarkdown,
} from './github.server'
import { yieldTasksInParallel, mdxRegex } from './utils'
import { generateSlugFromPath, isAbsoluteUrl } from 'docs-website/src/lib/utils'
import {
    getCacheTagForMediaAsset,
    getKeyForMediaAsset,
    s3,
} from 'docs-website/src/lib/s3'
import { cloudflareClient } from './cloudflare'
import { DocsJsonType } from 'docs-website/src/lib/docs-json'

export type AssetForSync =
    | {
          type: 'page'
          totalPages: number
          pageInput: Omit<Prisma.MarkdownPageUncheckedCreateInput, 'branchId'>
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
    | {
          type: 'docsJson'
          jsonData: any
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
export async function* pagesFromExampleJson({
    docsJson,
}: {
    docsJson: DocsJsonType
}): AsyncGenerator<AssetForSync & { filePath: string; content: string }> {
    // First handle meta.json files if present in exampleDocs
    for (let doc of exampleDocs) {
        const entryRelativePath = doc.relativePath
        if (entryRelativePath.endsWith('meta.json')) {
            let jsonData
            try {
                jsonData = JSON.parse(doc.contents)
            } catch {
                jsonData = {}
            }
            yield {
                type: 'metaFile',
                jsonData,
                githubPath: entryRelativePath,
                githubSha: '',
                filePath: entryRelativePath,
                content: doc.contents,
            }
        }
    }

    // Now yield any docs.json file if docsJson param is provided
    if (docsJson !== undefined) {
        yield {
            type: 'docsJson',
            jsonData:
                typeof docsJson === 'string' ? JSON.parse(docsJson) : docsJson,
            githubPath: 'docs.json',
            githubSha: '',
            filePath: 'docs.json',
            content:
                typeof docsJson === 'string'
                    ? docsJson
                    : JSON.stringify(docsJson),
        }
    }

    // Next handle styles.css
    for (let doc of exampleDocs) {
        const entryRelativePath = doc.relativePath
        if (entryRelativePath === 'styles.css') {
            yield {
                type: 'stylesCss',
                content: doc.contents,
                githubPath: entryRelativePath,
                githubSha: '',
                filePath: entryRelativePath,
                // content: doc.contents,
            }
        }
    }

    // Handle media assets
    for (let doc of exampleDocs) {
        const entryRelativePath = doc.relativePath
        if (isMediaFile(entryRelativePath)) {
            // As these are local example files, we just use a 'downloadUrl' as a data-url or placeholder
            // For lack of a real downloadUrl, just pass content in the struct.
            const slug = entryRelativePath
                .replace(/\\/g, '/')
                .replace(/^\/+/, '')
            yield {
                type: 'mediaAsset',
                slug,
                sha: '',
                downloadUrl: '', // Could be a data-url if desired
                githubPath: entryRelativePath,
                filePath: entryRelativePath,
                content: doc.contents,
            }
        }
    }

    // Now handle page markdown/MDX files
    const totalPages = exampleDocs.filter((doc) => {
        const entryRelativePath = doc.relativePath
        return isMarkdown(entryRelativePath)
    }).length

    for (let doc of exampleDocs) {
        const entryRelativePath = doc.relativePath
        if (!isMarkdown(entryRelativePath)) continue
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
                        jsonData: asset.jsonData,
                        branchId,
                    },
                    create: {
                        githubPath: asset.githubPath,
                        jsonData: asset.jsonData,
                        branchId,
                        githubSha: asset.githubSha,
                    },
                })
            }
            if (asset.type === 'docsJson') {
                console.log(`Updating docsJson for branch ${branchId}`)
                await prisma.siteBranch.update({
                    where: { branchId },
                    data: { docsJson: asset.jsonData },
                })

                // Handle domain connections
                if (
                    asset.jsonData.domains &&
                    Array.isArray(asset.jsonData.domains)
                ) {
                    const existingDomains = await prisma.domain.findMany({
                        where: { branchId },
                        select: { host: true },
                    })
                    const existingHosts = new Set(
                        existingDomains.map((d) => d.host),
                    )

                    const domainsToConnect = asset.jsonData.domains.filter(
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
                                // TODO add a way to show errors to the user in cases like this, if domain is already taken, send them an email?
                                continue
                            }
                            await cloudflareClient.createDomain(host)
                            await prisma.domain.create({
                                data: {
                                    host,
                                    branchId,
                                    domainType: 'customDomain',
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
                    const key = getKeyForMediaAsset({ siteId, slug, branchId })
                    await s3.file(key).write(response.body)
                    const cacheTag = getCacheTagForMediaAsset({
                        siteId,
                        slug,
                        branchId,
                    })
                    cacheTagsToInvalidate.push(cacheTag)
                }
                console.log(`uploading media asset ${asset.githubPath}`)
                await Promise.all([
                    upload(),
                    prisma.mediaAsset.upsert({
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
                        },
                        create: {
                            githubSha: asset.sha,
                            siteId,
                            slug,
                            githubPath: asset.githubPath,
                            branchId,
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
                            where: { branchId_slug: { branchId, slug } },
                            update: asset.pageInput,
                            create: { ...asset.pageInput, branchId },
                        })
                        .then((page) => {
                            console.log(
                                `Page upsert complete: ${page.pageId} (${page.title})`,
                            )
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
    return path === 'docs.json' || path === 'docs.jsonc'
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
                    `Skipping file ${file.path} because it is not a markdown, meta, docs.json, or styles.css file`,
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

    // Process docs.json file (root only)
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
        const jsonData = safeJsonParse(docsJsonFile.content || '{}')
        if (jsonData) {
            const docsJson: AssetForSync = {
                type: 'docsJson',
                jsonData,
                githubPath: docsJsonFile.githubPath,
                githubSha: docsJsonFile.sha,
            }
            yield docsJson
        } else {
            console.log(
                'skipping docs.json file for invalid json',
                docsJsonFile.githubPath,
            )
        }
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
