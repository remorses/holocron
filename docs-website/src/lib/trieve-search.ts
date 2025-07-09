import { SortedResult as BaseSortedResult } from 'fumadocs-core/server'
import { env } from './env'

import {
    ChunkGroup,
    TrieveSDK,
    ChunkFilter,
    SearchOverGroupsReqPayload,
    ChunkMetadata,
} from 'trieve-ts-sdk'
import { prisma } from 'db'

export interface TrieveChunkMetadata {
    page_title?: string
    section?: string
    section_id?: string
    page_id?: string
    line?: string
    [key: string]: string | undefined
}

export interface SortedResult extends BaseSortedResult {
    line?: number
}

export type Chunk = Omit<ChunkMetadata, 'metadata'> & {
    highlight?: string | undefined | null
    highlightTitle?: string | undefined | null
    highlightDescription?: string | undefined | null
    metadata: TrieveChunkMetadata
}

type ChunkWithHighlights = {
    chunk: Chunk
    highlights: string[]
}

export type GroupChunk = {
    chunks: ChunkWithHighlights[]
    group: ChunkGroup
}

export type GroupSearchResults = {
    groups: GroupChunk[]
    requestID: string
}

export async function searchDocsWithTrieve({
    query,
    tag,
    trieveDatasetId,
}: {
    query: string
    trieveDatasetId?: string | null
    tag?: string
}): Promise<SortedResult[]> {
    const trieve = new TrieveSDK({
        apiKey: env.TRIEVE_API_KEY!,
        organizationId: env.TRIEVE_ORGANIZATION_ID!,
        datasetId: trieveDatasetId || undefined,
    })
    if (!trieveDatasetId) {
        console.log(`no trieveDatasetId`)
        return []
    }
    let filters: ChunkFilter = {
        must: [],
        must_not: [],
        should: [],
    }

    if (tag && filters != undefined) {
        filters.must?.push({
            field: 'tag_set',
            match_all: [tag],
        })
    }

    if (query.length === 0) {
        return []
    }

    const request: SearchOverGroupsReqPayload = {
        query,
        search_type: 'fulltext',
        score_threshold: 1,
        group_size: 4,
        metadata: {
          line: true
        },
        highlight_options: {
            highlight_results: false,
            // highlight_window: 100,
        },
        filters,
    }

    const result = await trieve.searchOverGroups(request)

    return groupResults(result.results as GroupChunk[])
}

function groupResults(groups: GroupChunk[]): SortedResult[] {
    const grouped: SortedResult[] = []

    for (const group of groups) {
        const firstChunk = group.chunks[0]?.chunk
        grouped.push({
            id: 'page' + group.group.id,
            type: 'page',
            url: group.chunks[0]?.chunk.link || '',
            content:
                (group.group.metadata as any)?.page_title ||
                (firstChunk?.metadata as any)?.page_title ||
                group.group.name,
        })

        for (const c of group.chunks) {
            const chunk = c.chunk

            grouped.push({
                // ...c.chunk,
                id: chunk.tracking_id || '',
                type:
                    chunk.chunk_html === chunk.metadata.section
                        ? 'heading'
                        : 'text',
                url: chunk.metadata.section_id
                    ? `${chunk.link}#${chunk.metadata.section_id}`
                    : chunk.link || '',
                content: chunk.chunk_html || '',
                line: chunk.metadata.line ? parseInt(chunk.metadata.line) : undefined,
            })
        }
    }
    return grouped
}

export async function getAllTrieveGroups({
    trieveDatasetId,
}: {
    trieveDatasetId: string
}): Promise<ChunkGroup[]> {
    const trieve = new TrieveSDK({
        apiKey: env.TRIEVE_API_KEY!,
        organizationId: env.TRIEVE_ORGANIZATION_ID!,
        datasetId: trieveDatasetId,
    })

    const allGroups: ChunkGroup[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
        const response = await trieve.getGroupsForDataset({
            page,
        })

        allGroups.push(...response.groups)

        // Check if there are more pages
        hasMore =
            response.groups.length > 0 && page < (response.total_pages || 1)
        page++
    }

    return allGroups
}

// function highlightText(
//     searchTerm: string,
//     textToHighlight: string | null | undefined,
// ) {
//     const regex = new RegExp(`(${searchTerm})`, 'gi')
//     if (textToHighlight && textToHighlight.match(regex)) {
//         const parts = textToHighlight.split(regex)
//         const highlightedText = parts
//             .map((part) => (part.match(regex) ? `<mark>${part}</mark>` : part))
//             .join('')
//         return highlightedText
//     } else {
//         return textToHighlight
//     }
// }

export async function cleanupOrphanedTrieveChunks({
    siteId,
    branchId,
}: {
    siteId: string
    branchId: string
}) {
    console.log(
        `Cleaning up orphaned Trieve chunks for site ${siteId}, branch ${branchId}`,
    )

    // 1. Get the branch to retrieve the Trieve dataset ID
    const branch = await prisma.siteBranch.findUnique({
        where: { branchId },
        select: { trieveDatasetId: true },
    })

    if (!branch || !branch.trieveDatasetId) {
        console.log(
            `No Trieve dataset found for site ${siteId}, skipping cleanup`,
        )
        return
    }

    const datasetId = branch.trieveDatasetId
    // 2. Initialize Trieve SDK
    const trieve = new TrieveSDK({
        apiKey: env.TRIEVE_API_KEY!,
        organizationId: env.TRIEVE_ORGANIZATION_ID!,
        datasetId,
    })

    try {
        // 3. Get all existing page slugs from the database
        const existingPages = await prisma.markdownPage.findMany({
            where: { branchId },
            select: { slug: true },
        })
        const existingSlugs = new Set(existingPages.map((page) => page.slug))

        console.log(`Found ${existingSlugs.size} existing pages in database`)

        const trieveGroups = await getAllTrieveGroups({
            trieveDatasetId: datasetId,
        })

        if (!trieveGroups || !trieveGroups.length) {
            console.log('No groups found in Trieve dataset')
            return
        }

        console.log(`Found ${trieveGroups.length} groups in Trieve dataset`)

        // 5. Find orphaned groups (groups that exist in Trieve but not in DB)
        const orphanedGroups = trieveGroups.filter((group) => {
            // Groups use page slugs as tracking IDs, so we check if the slug exists in our DB
            const groupSlug = group.tracking_id
            return groupSlug && !existingSlugs.has(groupSlug)
        })

        console.log(`Found ${orphanedGroups.length} orphaned groups`)

        // 6. Delete orphaned groups and their chunks
        for (const orphanedGroup of orphanedGroups) {
            try {
                console.log(
                    `Deleting orphaned group: ${orphanedGroup.tracking_id}`,
                )

                await trieve.deleteGroup({
                    deleteChunks: true,
                    groupId: orphanedGroup.id,
                    trDataset: branch.trieveDatasetId,
                })

                console.log(
                    `Successfully deleted orphaned group: ${orphanedGroup.tracking_id}`,
                )
            } catch (error) {
                console.error(
                    `Error deleting orphaned group ${orphanedGroup.tracking_id}:`,
                    error,
                )
            }
        }

        console.log('Orphaned Trieve chunks cleanup completed')
    } catch (error) {
        console.error('Error during Trieve cleanup:', error)
        throw error
    }
}
