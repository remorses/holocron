/**
 * Tree context for the sidebar page tree and its active path.
 */

'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type * as PageTree from '../page-tree/index.ts'
import { searchPath } from '../page-tree/index.ts'

type TreeContextType = {
  root: PageTree.Root
}

const TreeContext = createContext<TreeContextType | null>(null)
const PathContext = createContext<PageTree.Node[]>([])

export function TreeContextProvider({
  tree,
  activeUrl,
  fallbackUrl,
  children,
}: {
  tree: PageTree.Root
  activeUrl: string
  fallbackUrl?: string
  children: ReactNode
}) {
  const path = useMemo(() => {
    return searchPath(tree.children, activeUrl) ?? (fallbackUrl ? searchPath(tree.children, fallbackUrl) : null) ?? []
  }, [activeUrl, fallbackUrl, tree])

  return (
    <TreeContext.Provider value={useMemo(() => ({ root: tree }), [tree])}>
      <PathContext.Provider value={path}>{children}</PathContext.Provider>
    </TreeContext.Provider>
  )
}

export function useTreePath(): PageTree.Node[] {
  return useContext(PathContext)
}

export function useTreeContext(): TreeContextType {
  const context = useContext(TreeContext)
  if (!context) {
    throw new Error('You must wrap the sidebar tree in <TreeContextProvider>.')
  }
  return context
}
