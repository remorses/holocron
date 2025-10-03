import { loader, MetaData, PageData, PageFile, VirtualFile, PageTreeTransformer } from 'fumadocs-core/source'

import { I18nConfig } from 'fumadocs-core/i18n'
import { PageTree } from 'fumadocs-core/server'

import { DynamicIcon } from './icon'
import { ProcessorDataFrontmatter, StructuredData } from './mdx-heavy'
import { Badge } from '../components/badge'
import { DocsJsonType } from './docs-json'

export interface SourceOptions {
  languages?: string[]
  defaultLanguage?: string
  files: VirtualFile[]
  /**
   * Pass the docsJson configuration for tabs
   */
  docsJson?: DocsJsonType
}

export function getFumadocsSource({
  files,
  languages: locales = [] as string[],
  defaultLanguage: defaultLanguage = 'en',
  docsJson,
}: SourceOptions) {
  const languages = locales
  if (!languages.includes(defaultLanguage)) {
    languages.push(defaultLanguage)
  }

  const transformers: PageTreeTransformer[] = []

  // Add tabs transformer if tabs are configured in docsJson
  if (docsJson?.tabs && docsJson.tabs.length > 0) {
    transformers.push(createTabsTransformer(docsJson.tabs))
  }

  const source = loader<
    {
      pageData: PageData & {
        structuredData: StructuredData
      }
      metaData: MetaData
    },
    I18nConfig
  >({
    source: { files },
    baseUrl: '/', // TODO pass here the customer base path
    i18n: {
      defaultLanguage: defaultLanguage,
      languages,
      hideLocale: 'default-locale',
    },
    pageTree: {
      attachFile,
      transformers,
    },
    icon(icon) {
      if (!icon) return
      return <DynamicIcon icon={icon as any} />
    },
  })


  return source
}

export const attachFile = (node: PageTree.Item, file: PageFile | undefined): PageTree.Item => {
  if (!file) return node
  let data = file.data as ProcessorDataFrontmatter

  const badge = data.badge || {}

  const content = badge.content || ''
  const color = badge.color || 'gray'

  if (content) {
    node.name = (
      <>
        {node.name}{' '}
        <Badge color={color as any} className='ms-auto text-xs text-nowrap'>
          {content}
        </Badge>
      </>
    )
  }

  return node
}

/**
 * Create a transformer to configure tabs programmatically
 */
function createTabsTransformer(tabs: DocsJsonType['tabs']): PageTreeTransformer {
  // Track which folders are configured as tabs
  const tabFolders = new Set<string>()

  if (tabs) {
    tabs.forEach(tab => {
      if ('folder' in tab && tab.folder) {
        const normalized = tab.folder.replace(/^\/+|\/+$/g, '')
        tabFolders.add(normalized)
      }
    })
  }

  return {
    name: 'tabs-transformer',
    folder(node, folderPath, metaPath) {
      if (!tabs || tabs.length === 0) return node

      const normalizedPath = folderPath.replace(/^\/+|\/+$/g, '')

      // Check if this folder matches any tab configuration
      const matchingTab = tabs.find(tab => {
        if ('folder' in tab && tab.folder) {
          const normalizedFolder = tab.folder.replace(/^\/+|\/+$/g, '')
          return normalizedFolder === normalizedPath
        }
        return false
      })

      if (matchingTab && 'folder' in matchingTab) {
        // Mark this folder as a root folder to create a tab
        return {
          ...node,
          root: true,
          name: matchingTab.tab,
          description: matchingTab.description || node.description,
        }
      }

      return node
    },
    root(node) {
      if (!tabs || tabs.length === 0) return node

      // Group all non-tab items into a "Docs" tab
      const tabItems: typeof node.children = []
      const docsItems: typeof node.children = []

      node.children.forEach(child => {
        if (child.type === 'folder' && child.root) {
          // This folder is already marked as a tab
          tabItems.push(child)
        } else {
          // Everything else goes to docs
          docsItems.push(child)
        }
      })

      // Create main docs tab if there are any non-tab items
      if (docsItems.length > 0) {
        const docsTab: typeof node.children[0] = {
          type: 'folder',
          name: 'Docs',
          root: true,
          children: docsItems,
        }

        return {
          ...node,
          children: [docsTab, ...tabItems],
        }
      }

      return {
        ...node,
        children: tabItems,
      }
    },
  }
}
