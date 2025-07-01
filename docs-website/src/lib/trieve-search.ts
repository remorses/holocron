import { SortedResult } from 'fumadocs-core/server'
import { env } from './env'

import {
    ChunkGroup,
    TrieveSDK,
    ChunkFilter,
    SearchOverGroupsReqPayload,
    ChunkMetadata,
} from 'trieve-ts-sdk'

export type Chunk = Omit<ChunkMetadata, 'metadata'> & {
    highlight?: string | undefined | null
    highlightTitle?: string | undefined | null
    highlightDescription?: string | undefined | null
    metadata: {
        [key: string]: string
    }
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
        group_size: 3,
        filters,
    }

    const result = await trieve.searchOverGroups(request)

    const resultsWithHighlight = result.results.map((group) => {
        group.chunks = group.chunks.map((chunk) => {
            const c = chunk.chunk as unknown as Chunk
            return {
                ...chunk,
                chunk: {
                    ...chunk.chunk,
                    highlight: highlightText(query, c.chunk_html),
                },
            }
        })
        return group
    })

    const trieveResults = {
        groups: resultsWithHighlight,
        requestID: result.id,
    } as unknown as GroupSearchResults

    return groupResults(trieveResults.groups)
}

function groupResults(groups: GroupChunk[]): SortedResult[] {
    const grouped: SortedResult[] = []

    for (const group of groups) {
        grouped.push({
            id: group.group.id,
            type: 'page',
            url: group.chunks[0]?.chunk.link || '',
            content: group.group.name,
        })

        for (const c of group.chunks) {
            const chunk = c.chunk

            grouped.push({
                ...c.chunk,
                id: chunk.tracking_id || '',
                type:
                    chunk.chunk_html === chunk.metadata['section']
                        ? 'heading'
                        : 'text',
                url: chunk.metadata['section_id']
                    ? `${chunk.link}#${chunk.metadata['section_id']}`
                    : chunk.link || '',
                content: chunk.highlight || chunk.chunk_html || '',
            })
        }
    }
    return grouped
}

function highlightText(
    searchTerm: string,
    textToHighlight: string | null | undefined,
) {
    const regex = new RegExp(`(${searchTerm})`, 'gi')
    if (textToHighlight && textToHighlight.match(regex)) {
        const parts = textToHighlight.split(regex)
        const highlightedText = parts
            .map((part) => (part.match(regex) ? `<mark>${part}</mark>` : part))
            .join('')
        return highlightedText
    } else {
        return textToHighlight
    }
}
