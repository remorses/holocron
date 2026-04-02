/**
 * Holocron page-tree types modeled after Fumadocs' sidebar tree.
 * This is the source of truth for sidebar rendering, active-path lookup, and search.
 */

export type Root = {
  $id: string
  name: string
  children: Node[]
}

export type Node = Item | Separator | Folder

export type Item = {
  $id: string
  type: 'page'
  name: string
  url: string
  external?: boolean
}

export type Separator = {
  $id: string
  type: 'separator'
  name?: string
}

export type Folder = {
  $id: string
  type: 'folder'
  name: string
  defaultOpen?: boolean
  collapsible?: boolean
  index?: Item
  children: Node[]
}
