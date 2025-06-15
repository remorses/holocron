import { SortedResult } from 'fumadocs-core/server'
import { useMemo, useRef, useState } from 'react'
import { TrieveSDK } from 'trieve-ts-sdk'

import { useOnChange } from 'fumadocs-core/utils/use-on-change'

import { useDebounce } from 'docs-website/src/lib/hooks'
import {
    ChunkFilter,
    ChunkGroup,
    ChunkMetadata,
    SearchOverGroupsReqPayload
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

function groupResults(results: GroupChunk[]): SortedResult[] {
    const grouped: SortedResult[] = []

    for (const result of results) {
        grouped.push({
            id: result.group.id,
            type: 'page',
            url: result.chunks[0]?.chunk.link || '',
            content: result.group.name,
        })

        for (const c of result.chunks) {
            const chunk = c.chunk
            grouped.push({
                id: chunk.tracking_id || '',
                type:
                    chunk.chunk_html === chunk.metadata['section']
                        ? 'heading'
                        : 'text',
                url: chunk.metadata['section_id']
                    ? `${chunk.link}#${chunk.metadata['section_id']}`
                    : chunk.link || '',
                content: chunk.chunk_html || '',
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

export async function searchDocs(
    trieve: TrieveSDK,
    query: string,
    tag?: string,
): Promise<SortedResult[]> {
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

interface useTrieveSearch {
    search: string
    setSearch: (v: string) => void
    query: {
        isLoading: boolean
        data?: SortedResult[] | 'empty'
        error?: Error
    }
}

const cache = new Map<string, SortedResult[] | 'empty'>()

export function useTrieveSearch(
    client: TrieveSDK,
    locale?: string,
    tag?: string,
    delayMs = 100,
    allowEmpty = false,
    key?: string,
): useTrieveSearch {
    const [search, setSearch] = useState('')
    const [results, setResults] = useState<SortedResult[] | 'empty'>('empty')
    const [error, setError] = useState<Error>()
    const [isLoading, setIsLoading] = useState(false)
    const debouncedValue = useDebounce(search, delayMs)
    const onStart = useRef<() => void>(null)

    const cacheKey = useMemo(() => {
        return key ?? JSON.stringify([client, debouncedValue, locale, tag])
    }, [client, debouncedValue, locale, tag, key])

    useOnChange(cacheKey, () => {
        const cached = cache.get(cacheKey)

        if (onStart.current) {
            onStart.current()
            onStart.current = null
        }

        if (cached) {
            setIsLoading(false)
            setError(undefined)
            setResults(cached)
            return
        }

        setIsLoading(true)
        let interrupt = false
        onStart.current = () => {
            interrupt = true
        }

        async function run(): Promise<SortedResult[] | 'empty'> {
            if (debouncedValue.length === 0 && !allowEmpty) return 'empty'

            return searchDocs(client, debouncedValue, tag)
        }

        void run()
            .then((res) => {
                cache.set(cacheKey, res)
                if (interrupt) return

                setError(undefined)
                setResults(res)
            })
            .catch((err: unknown) => {
                setError(err as Error)
            })
            .finally(() => {
                setIsLoading(false)
            })
    })

    return { search, setSearch, query: { isLoading, data: results, error } }
}
