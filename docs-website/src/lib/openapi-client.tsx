import { loader as fumadocsLoader, VirtualFile } from 'fumadocs-core/source'
import { isTruthy } from 'docs-website/src/lib/utils'

import { loader, MetaData, PageData, PageFile } from 'fumadocs-core/source'
import { idToTitle } from 'fumadocs-openapi/utils/id-to-title'
import type { OpenAPIV3 } from 'openapi-types'
import * as PageTree from 'fumadocs-core/page-tree'
import { DocsJsonType } from './docs-json'
import { FilesInDraft } from './docs-state'
import { DynamicIcon } from './icon'
import { ProcessorDataFrontmatter } from './mdx-heavy'
import { attachFile } from './source'

export function getOperations(openapiDocument) {
  const ops: { path: string; method: string }[] = Object.entries(openapiDocument.paths ?? {}).flatMap(
    ([path, pathItem]) =>
      Object.entries(pathItem ?? {}).map(([method]) => ({
        path,
        method,
      })),
  )
  return ops
}

export function getPageTreeForOpenAPI({
  filesInDraft,
  docsJson,
  openapiDocument,
}: {
  docsJson: DocsJsonType
  filesInDraft: FilesInDraft
  openapiDocument: OpenAPIV3.Document
}): PageTree.Root {
  const openapiPath = `/api-reference`

  // TODO if docsJson tab for openapi is a relative path, get the json from the filesInDraft, then parse it and use it as openapiDocument, this way user can preview changes to an openapi schema with the cli and the agent
  const operations = getOperations(openapiDocument)

  // Create PageTree.Item items for each operation
  const children: PageTree.Item[] =
    operations
      ?.map(({ path, method }) => {
        const pathItem = openapiDocument.paths?.[path]
        if (!pathItem) return
        const operation = pathItem[method]
        if (!operation) return
        const pageItem: PageTree.Item = {
          type: 'page',
          name: operation.summary ?? pathItem.summary ?? idToTitle(operation.operationId ?? 'unknown'),
          url: `${openapiPath}/${path}/${method}`,
        }

        // Apply attachFile to add badge
        const fileData = {
          data: {
            badge: {
              color: getMethodColor(method),
              content: method,
            },
            title: path,
          } satisfies ProcessorDataFrontmatter,
        }

        return attachFile(pageItem, fileData as any)
      })
      .filter(isTruthy) ?? []

  // Create the root structure
  const tree: PageTree.Root = {
    name: 'API Reference',
    children,
    $id: Math.random().toString(36).slice(2),
  }

  return tree
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
