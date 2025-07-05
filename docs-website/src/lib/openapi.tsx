import { loader as fumadocsLoader, VirtualFile } from 'fumadocs-core/source'
import { LRUCache } from 'lru-cache'
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types'
import { DocsJsonType } from './docs-json'
import { FilesInDraft } from './docs-state'
import { DynamicIcon } from './icon'
import { ProcessorDataFrontmatter } from './mdx-heavy'
import { attachFile } from './source'

import { dereference, load, upgrade } from '@scalar/openapi-parser'
import { fetchUrls } from '@scalar/openapi-parser/plugins/fetch-urls'

export async function getOpenapiDocument({
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
        const openapiDocumentJson = await processDocument(openapiUrl)
        const pathWithoutBase = url.pathname.slice(openapiPath.length)
        const method = pathWithoutBase
            .split('/')
            .pop() as OpenAPIV3_1.HttpMethods
        const path = pathWithoutBase.split('/').slice(1).join('/')
        return {
            type: 'openapi' as const,
            openapiDocument: openapiDocumentJson,
            operations: [{ method, path }],
        }
    }
    return {}
}

export function getSourceForOpenAPI({
    filesInDraft,
    docsJson,
    openapiDocument,
}: {
    docsJson: DocsJsonType
    filesInDraft: FilesInDraft
    openapiDocument: OpenAPIV3.Document
}) {
    const openapiPath = `/api-reference`
    // TODO if docsJson tab for openapi is a relative path, get the json from the filesInDraft, then parse it and use it as openapiDocument, this way user can preview changes to an openapi schema with the cli and the agent
    const paths: { path: string; method: string }[] = Object.entries(
        openapiDocument.paths ?? {},
    ).flatMap(([path, pathItem]) =>
        Object.entries(pathItem ?? {})

            .map(([method]) => ({
                path,
                method,
            })),
    )
    const openapiPathsFiles: VirtualFile[] = paths?.map(function ({
        path,
        method,
    }) {
        return {
            id: path,
            name: path,
            type: 'page',
            data: {
                badge: {
                    color: getMethodColor(method),
                    content: method,
                },
                title: path,
            } satisfies ProcessorDataFrontmatter,
            path: path,
        }
    })

    const source = fumadocsLoader<any>({
        source: { files: openapiPathsFiles },
        baseUrl: openapiPath,
        pageTree: {
            attachFile,
        },
        icon(icon) {
            if (!icon) return
            return <DynamicIcon icon={icon as any} />
        },
    })
    const tree = source.pageTree
    return source
}

function getMethodColor(method: string) {
    switch (method.toUpperCase()) {
        case 'PUT':
            return 'yellow'
        case 'PATCH':
            return 'orange'
        case 'POST':
            return 'blue'
        case 'DELETE':
            return 'red'
        default:
            return 'green'
    }
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
