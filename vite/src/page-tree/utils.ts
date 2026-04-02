/**
 * Holocron page-tree helpers for active-path lookup and search flattening.
 */

import type * as PageTree from './definitions.ts'

export type FlatSidebarSearchItem = {
  id: string
  label: string
  href?: string
  parentId: string | null
}

export function normalizeUrl(urlOrPath: string): string {
  if (urlOrPath.length > 1 && urlOrPath.endsWith('/')) {
    return urlOrPath.slice(0, -1)
  }
  return urlOrPath
}

export function findPath(nodes: PageTree.Node[], matcher: (node: PageTree.Node) => boolean): PageTree.Node[] | null {
  function run(nextNodes: PageTree.Node[]): PageTree.Node[] | undefined {
    let separator: PageTree.Separator | undefined

    for (const node of nextNodes) {
      if (matcher(node)) {
        const items: PageTree.Node[] = []
        if (separator) {
          items.push(separator)
        }
        items.push(node)
        return items
      }

      if (node.type === 'separator') {
        separator = node
        continue
      }

      if (node.type === 'folder') {
        const items = node.index && matcher(node.index) ? [node.index] : run(node.children)
        if (items) {
          items.unshift(node)
          if (separator) {
            items.unshift(separator)
          }
          return items
        }
      }
    }
  }

  return run(nodes) ?? null
}

export function searchPath(nodes: PageTree.Node[], url: string): PageTree.Node[] | null {
  const normalizedUrl = normalizeUrl(url)
  return findPath(nodes, (node) => {
    return node.type === 'page' && normalizeUrl(node.url) === normalizedUrl
  })
}

export function flattenSidebarSearchItems(nodes: PageTree.Node[], parentId: string | null = null): FlatSidebarSearchItem[] {
  const result: FlatSidebarSearchItem[] = []

  for (const node of nodes) {
    if (node.type === 'separator') {
      continue
    }

    if (node.type === 'folder') {
      result.push({
        id: node.$id,
        label: node.name,
        href: node.index?.url,
        parentId,
      })
      result.push(...flattenSidebarSearchItems(node.children, node.$id))
      continue
    }

    result.push({
      id: node.$id,
      label: node.name,
      href: node.url,
      parentId,
    })
  }

  return result
}
