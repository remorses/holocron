/**
 * Extra sidebar link-item renderer matching the Fumadocs sidebar file layout.
 */

'use client'

import type { HTMLAttributes, ReactNode } from 'react'
import type * as Base from './base.tsx'

export type SidebarLinkItem =
  | { type: 'item'; text: string; url: string; external?: boolean }
  | { type: 'menu'; text: string; url?: string; external?: boolean; items: SidebarLinkItem[] }
  | { type: 'custom'; children: ReactNode }

type InternalComponents = Pick<
  typeof Base,
  'SidebarFolder' | 'SidebarFolderLink' | 'SidebarFolderContent' | 'SidebarFolderTrigger' | 'SidebarItem'
>

export function createLinkItemRenderer({
  SidebarFolder,
  SidebarFolderContent,
  SidebarFolderLink,
  SidebarFolderTrigger,
  SidebarItem,
}: InternalComponents) {
  return function SidebarLinkItemRenderer({
    item,
    ...props
  }: HTMLAttributes<HTMLElement> & {
    item: SidebarLinkItem
  }) {
    if (item.type === 'custom') {
      return <div {...props}>{item.children}</div>
    }

    if (item.type === 'menu') {
      return (
        <SidebarFolder depth={1} collapsible>
          {item.url ? (
            <SidebarFolderLink href={item.url} external={item.external}>{item.text}</SidebarFolderLink>
          ) : (
            <SidebarFolderTrigger>{item.text}</SidebarFolderTrigger>
          )}
          <SidebarFolderContent>
            {item.items.map((child, index) => {
              return <SidebarLinkItemRenderer key={index} item={child} />
            })}
          </SidebarFolderContent>
        </SidebarFolder>
      )
    }

    return <SidebarItem href={item.url} external={item.external} {...props}>{item.text}</SidebarItem>
  }
}
