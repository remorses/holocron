/**
 * Recursive sidebar tree renderer modeled after Fumadocs' page-tree renderer.
 */

'use client'

import { Fragment, createContext, useContext, useMemo, type FC, type ReactNode } from 'react'
import type * as PageTree from '../../page-tree/index.ts'
import type * as Base from './base.tsx'
import { useTreeContext } from '../../contexts/tree.tsx'
import { isActiveUrl } from '../../utils/urls.ts'

export interface SidebarPageTreeComponents {
  Item: FC<{ item: PageTree.Item }>
  Folder: FC<{ item: PageTree.Folder; children: ReactNode }>
  Separator: FC<{ item: PageTree.Separator }>
}

const RendererContext = createContext<(Partial<SidebarPageTreeComponents> & { currentUrl: string }) | null>(null)

type InternalComponents = Pick<
  typeof Base,
  'SidebarSeparator' | 'SidebarFolder' | 'SidebarFolderLink' | 'SidebarFolderContent' | 'SidebarFolderTrigger' | 'SidebarItem'
>

export function createPageTreeRenderer({
  SidebarFolder,
  SidebarFolderContent,
  SidebarFolderLink,
  SidebarFolderTrigger,
  SidebarSeparator,
  SidebarItem,
}: InternalComponents) {
  function renderList(nodes: PageTree.Node[]) {
    return nodes.map((node) => { return <PageTreeNode key={node.$id} node={node} /> })
  }

  function PageTreeNode({ node }: { node: PageTree.Node }) {
    const { Separator, Item, Folder, currentUrl } = useContext(RendererContext)!

    if (node.type === 'separator') {
      if (Separator) {
        return <Separator item={node} />
      }
      return <SidebarSeparator>{node.name}</SidebarSeparator>
    }

    if (node.type === 'folder') {
      if (Folder) {
        return <Folder item={node}>{renderList(node.children)}</Folder>
      }

      return (
        <SidebarFolder depth={1} collapsible={node.collapsible} defaultOpen={node.defaultOpen}>
          {node.index ? (
            <SidebarFolderLink href={node.index.url} active={isActiveUrl(node.index.url, currentUrl)} external={node.index.external}>
              {node.name}
            </SidebarFolderLink>
          ) : (
            <SidebarFolderTrigger>{node.name}</SidebarFolderTrigger>
          )}
          <SidebarFolderContent>{renderList(node.children)}</SidebarFolderContent>
        </SidebarFolder>
      )
    }

    if (Item) {
      return <Item item={node} />
    }

    return (
      <SidebarItem href={node.url} external={node.external} active={isActiveUrl(node.url, currentUrl)}>
        {node.name}
      </SidebarItem>
    )
  }

  return function SidebarPageTree({ currentUrl, ...components }: Partial<SidebarPageTreeComponents> & { currentUrl: string }) {
    const { root } = useTreeContext()

    return (
      <RendererContext.Provider value={useMemo(() => ({ ...components, currentUrl }), [components, currentUrl])}>
        <Fragment key={root.$id}>{renderList(root.children)}</Fragment>
      </RendererContext.Provider>
    )
  }
}
