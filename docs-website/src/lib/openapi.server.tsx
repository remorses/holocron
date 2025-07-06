import { LRUCache } from 'lru-cache'
import type { OpenAPIV3_1 } from 'openapi-types'
import { DocsJsonType } from './docs-json'

import { dereference, load, upgrade } from '@scalar/openapi-parser'
import { fetchUrls } from '@scalar/openapi-parser/plugins/fetch-urls'
import { getOperations } from './openapi-client'

type Operation = {
    method: OpenAPIV3_1.HttpMethods
    path: string
}

export async function getOpenapiDocument({
    url,
    docsJson,
}: {
    url: URL
    docsJson: DocsJsonType
}) {
    const openapiPath = '/api-reference'
    const { openapiUrl, renderer = 'fumadocs' } = await getOpenapiUrl({
        docsJson,
        url,
    })

    if (!openapiUrl) {
        return {
            operations: [] as Operation[],
        }
    }
    if (renderer === 'scalar') {
        return {
            renderer,
            type: 'openapi' as const,
            openapiDocument: {},
            operations: [] as Operation[],
            openapiUrl,
        }
    }
    const processedOpenAPI = await processDocument(openapiUrl)
    let pathWithoutBase = url.pathname.slice(openapiPath.length)
    const method = pathWithoutBase.split('/').pop() as OpenAPIV3_1.HttpMethods
    const path = pathWithoutBase.split('/').slice(1).join('/')
    const operations = getOperations(processedOpenAPI)
    const found = operations.find(
        (op) => op.method === method && op.path === path,
    )
    if (!found) {
        return {
            type: 'openapi' as const,
            openapiUrl,
            renderer,
            processedOpenAPI: processedOpenAPI,
            operations: operations.slice(0, 1),
        }
    }
    return {
        renderer,
        openapiUrl,
        type: 'openapi' as const,
        processedOpenAPI: processedOpenAPI,
        operations: [found],
    }

    return {}
}

export async function getOpenapiUrl({
    url,
    docsJson,
}: {
    url: URL
    docsJson: DocsJsonType
}) {
    const openapiPath = '/api-reference'
    const openapiTab = docsJson.tabs?.find((x) => 'openapi' in x && x.openapi)
    const isApiReferencePath =
        url.pathname === openapiPath ||
        url.pathname.startsWith(openapiPath + '/')
    if (isApiReferencePath && openapiTab && 'openapi' in openapiTab) {
        const openapiUrl = openapiTab.openapi
        const { renderer } = openapiTab
        return {
            renderer: renderer || 'fumadocs',
            openapiUrl,
        }
    }
    return {}
}

export type DocumentInput = string | any
export type DereferenceMap = Map<unknown, string>

export type ProcessedDocument = {
    document: Document
    dereferenceMap: DereferenceMap
    downloaded: Document
}
const lru = new LRUCache<string, ProcessedDocument>({
    max: 32,
    ttl: 1000 * 60 * 5, // 5 minutes
})
/**
 * process & reference input document to a Fumadocs OpenAPI compatible format
 */
export async function processDocument(
    input: DocumentInput,
    disableCache = false,
): Promise<ProcessedDocument> {
    const cached =
        !disableCache && typeof input === 'string' ? lru.get(input) : null

    if (cached) return cached

    const dereferenceMap: DereferenceMap = new Map()
    const loaded = await load(input, {
        plugins: [fetchUrls()],
    })

    if (loaded.errors && loaded.errors.length > 0) {
        throw new Error(
            loaded.errors
                .map((err) => `${err.code}: ${err.message}`)
                .join('\n'),
        )
    }

    // upgrade
    loaded.specification = upgrade(loaded.specification).specification
    const { schema: dereferenced } = (await dereference(loaded.filesystem, {
        onDereference({ ref, schema }) {
            dereferenceMap.set(schema, ref)
        },
    })) as any

    const processed: ProcessedDocument = {
        document: dereferenced as any,
        dereferenceMap,
        downloaded: loaded.specification as any,
    }

    if (!disableCache && typeof input === 'string') {
        lru.set(input, processed)
    }

    return processed as any
}
