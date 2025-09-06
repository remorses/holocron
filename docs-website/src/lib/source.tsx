import { loader, MetaData, PageData, PageFile, VirtualFile } from 'fumadocs-core/source'

import { I18nConfig } from 'fumadocs-core/i18n'
import { PageTree } from 'fumadocs-core/server'

import { DynamicIcon } from './icon'
import { ProcessorDataFrontmatter, StructuredData } from './mdx-heavy'
import { Badge } from '../components/badge'

export function getFumadocsSource({
  files,
  languages: locales = [] as string[],
  defaultLanguage: defaultLanguage = 'en',
}: {
  languages?: string[]
  defaultLanguage?: string
  files: VirtualFile[]
}) {
  const languages = locales
  if (!languages.includes(defaultLanguage)) {
    languages.push(defaultLanguage)
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
