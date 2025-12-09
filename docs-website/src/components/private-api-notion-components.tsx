import React, { useContext, useMemo } from 'react'
import { SourceContext } from '../lib/source'
import { Link } from 'react-router'
import { DynamicIcon } from '../lib/icon'
import type { NotionPageLinkProps } from './component-types'

function PageLink({ href, icon, inline, children }: NotionPageLinkProps) {
  const context = useContext(SourceContext)

  const { resolvedIcon, pageUrl } = useMemo(() => {
    const { source } = context || {}
    if (!source) {
      console.warn(`PageLink: no source available for href ${href}`)
      return { pageUrl: href, resolvedIcon: icon }
    }

    const pageId = (() => {
      try {
        const urlObj = new URL(href || '', 'http://notion.so')
        const pathWithoutLeadingSlash = urlObj.pathname.replace(/^\//, '')
        const firstSegment = pathWithoutLeadingSlash.split('/')[0]
        return firstSegment || ''
      } catch {
        console.error('PageLink error getting page id from href', href)
        return ''
      }
    })()

    if (!pageId) return { pageUrl: href, resolvedIcon: icon }

    const pages = source.getPages()
    const page = pages.find((p) => p.data?.notionPageId === pageId)

    if (page) {
      return { pageUrl: page.url, resolvedIcon: page.data.icon || icon }
    }

    console.warn(`PageLink: cannot find page for notion id ${pageId}`)
    return { pageUrl: href, resolvedIcon: icon }
  }, [context?.source, href, icon])

  const content = (
    <>
      {resolvedIcon && <DynamicIcon icon={resolvedIcon} className='size-4' />}
      {children}
    </>
  )

  if (!pageUrl) {
    return (
      <span className={inline ? 'inline-flex items-center gap-1 text-gray-600' : 'flex items-center gap-1 text-gray-600'}>
        {content}
      </span>
    )
  }

  if (inline) {
    return (
      <Link
        to={pageUrl}
        className='inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 no-underline'
      >
        {content}
      </Link>
    )
  }

  return (
    <div className='my-2'>
      <Link
        to={pageUrl}
        className='flex items-center gap-1 text-blue-600 hover:text-blue-800 no-underline'
      >
        {content}
      </Link>
    </div>
  )
}

export const privateApiNotionComponents = {
  PageLink,
}

export type { NotionPageLinkProps } from './component-types'
