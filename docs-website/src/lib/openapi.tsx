import { DocsJsonType } from './docs-json'
import { loader as fumadocsLoader, VirtualFile } from 'fumadocs-core/source'
import { LRUCache } from 'lru-cache'
import type { OpenAPIV3 } from 'openapi-types'
import { DynamicIcon } from './icon'
import { attachFile } from './source'
import { FilesInDraft } from './docs-state'
import { VariantProps } from 'class-variance-authority'
import { ProcessorDataFrontmatter } from './mdx-heavy'

const openapiCache = new LRUCache<string, any>({
    max: 32,
    ttl: 1000 * 60 * 5, // 5 minutes
})

export async function getOpenapiSchema(
    openapiUrl: string,
): Promise<OpenAPIV3.Document> {
    if (!openapiUrl.startsWith('https://')) {
        throw new Error('openapi url must start with https:')
    }
    let cached = openapiCache.get(openapiUrl)
    if (cached) {
        return cached
    }
    const res = await fetch(openapiUrl, {
        headers: {
            Accept: 'application/json',
        },
    })
    if (!res.ok) {
        throw new Response(
            `Failed to fetch OpenAPI document: ${res.statusText}`,
            { status: res.status },
        )
    }
    const openapiDocumentJson = await res.json()
    openapiCache.set(openapiUrl, openapiDocumentJson)
    return openapiDocumentJson
}

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
        const openapiDocumentJson = await getOpenapiSchema(openapiUrl)
        return {
            type: 'openapi' as const,
            openapiDocument: openapiDocumentJson,
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
