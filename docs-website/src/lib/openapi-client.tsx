import { loader as fumadocsLoader, VirtualFile } from 'fumadocs-core/source'
import type { OpenAPIV3 } from 'openapi-types'
import { DocsJsonType } from './docs-json'
import { FilesInDraft } from './docs-state'
import { DynamicIcon } from './icon'
import { ProcessorDataFrontmatter } from './mdx-heavy'
import { attachFile } from './source'


export function getOperations(openapiDocument) {
    const ops: { path: string; method: string }[] = Object.entries(
        openapiDocument.paths ?? {},
    ).flatMap(([path, pathItem]) =>
        Object.entries(pathItem ?? {})

            .map(([method]) => ({
                path,
                method,
            })),
    )
    return ops
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
    const operations = getOperations(openapiDocument)
    const openapiPathsFiles: VirtualFile[] = operations?.map(function ({
        path,
        method,
    }) {
        return {
            id: path + method,
            name: path,
            type: 'page',
            data: {
                badge: {
                    color: getMethodColor(method),
                    content: method,
                },
                title: path,
            } satisfies ProcessorDataFrontmatter,
            path: [path, method].join('/') + '.mdx',
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
