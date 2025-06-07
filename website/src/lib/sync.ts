import { Sema } from 'async-sema'
import { execSync } from 'child_process'
import { Prisma, prisma } from 'db'
import fs from 'fs'

import path from 'path'
import { ChunkReqPayload, TrieveSDK } from 'trieve-ts-sdk'
import {
    DocumentRecord,
    processMdx,
    StructuredData,
} from 'docs-website/app/lib/mdx'

type Page = {
    pageInput: Omit<Prisma.MarkdownPageUncheckedCreateInput, 'tabId'>
    structuredData: StructuredData
    totalPages: number
}

export async function syncWebsiteDocsV2({
    siteId,
    internalHost,
    name,
    tabId,
    orgId,
    pages,
}: {
    siteId: string
    internalHost: string
    name?: string
    tabId: string
    orgId: string
    pages: AsyncIterable<Page>
}) {
    console.log('Starting import script...')

    // Ensure the site exists or create it if it doesn't
    console.log(`Upserting site with ID: ${siteId}, name: ${name}...`)
    const site = await prisma.site.upsert({
        where: { id: siteId },
        update: { name }, // No updates needed if it exists
        create: {
            id: siteId,
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
    console.log(
        `Site upsert complete: ${site.id} (${site.name}) `,
    )

    // Find existing domain or create a new one
    console.log(`Looking for existing internal domain for site: ${site.id}...`)
    const existingDomain = site.domains.find((x) => x)

    if (existingDomain && existingDomain?.host !== internalHost) {
        console.log(
            `Updating existing domain (${existingDomain.id}) with host: ${internalHost}...`,
        )
        await prisma.domain.update({
            where: { id: existingDomain.id },
            data: {
                siteId: site.id,
                domainType: 'internalDomain',
                host: internalHost,
            },
        })
        console.log(`Domain updated successfully: ${existingDomain.id}`)
    }
    if (!existingDomain) {
        console.log(
            `Creating new internal domain with host: ${internalHost}...`,
        )
        const newDomain = await prisma.domain.create({
            data: {
                host: internalHost,
                siteId: site.id,
                domainType: 'internalDomain',
            },
        })
        console.log(`New domain created: ${newDomain.id}`)
    }

    console.log(`Using site: ${site.id}`)

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
        apiKey: process.env.TRIEVE_API_KEY!,
        organizationId: process.env.TRIEVE_ORGANIZATION_ID!,
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
): AsyncGenerator<Page> {
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
        const page: Page | null = {
            totalPages,
            pageInput: {
                slug: entrySlug,
                title: data.title || '',
                markdown: fileContent,
                frontmatter: data.frontmatter,
            },
            structuredData: data.structuredData,
        }
        if (page) {
            yield page
        }
    }

    // Then process subdirectories
    for (const entry of entries.filter((entry) => entry.isDirectory())) {
        const fullPath = path.join(dirPath, entry.name)
        yield* pagesFromDirectory(fullPath, base)
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
        where: { id: siteId },
        select: { trieveDatasetId: true },
    })

    if (!site) {
        throw new Error(`Site with ID ${siteId} not found`)
    }

    // 2. Initialize Trieve SDK if we have a dataset ID
    let trieve: TrieveSDK | undefined
    if (site.trieveDatasetId) {
        trieve = new TrieveSDK({
            apiKey: process.env.TRIEVE_API_KEY!,
            organizationId: process.env.TRIEVE_ORGANIZATION_ID!,
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
        apiKey: process.env.TRIEVE_API_KEY!,
        organizationId: process.env.TRIEVE_ORGANIZATION_ID!,
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
        where: { id: siteId },
        data: {
            trieveDatasetId: datasetId,
            trieveReadApiKey: token.api_key,
        },
    })
    console.log(`Site record updated with Trieve dataset ID and API key`)
    return { datasetId: datasetId }
}
