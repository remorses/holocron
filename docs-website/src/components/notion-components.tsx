import React, { useContext, useMemo } from 'react'
import { Callout } from 'fumadocs-ui/components/callout'
import { SourceContext } from '../lib/source'
import { Link } from 'react-router'
import { DynamicIcon } from '../lib/icon'

type Color =
  | 'gray'
  | 'brown'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'red'
  | 'gray_bg'
  | 'brown_bg'
  | 'orange_bg'
  | 'yellow_bg'
  | 'green_bg'
  | 'blue_bg'
  | 'purple_bg'
  | 'pink_bg'
  | 'red_bg'

function MentionUser({
  url,
  children,
}: {
  url: string
  children?: React.ReactNode
}) {
  return (
    <a
      href={url}
      className='inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 no-underline'
    >
      @{children}
    </a>
  )
}

function MentionPage({
  url,
  icon: _icon,
  children,
}: {
  url?: string
  icon?: string
  children?: React.ReactNode
}) {
  const context = useContext(SourceContext)

  const { icon = _icon, pageUrl } = useMemo(() => {
    const { source, locale } = context || {}
    if (!source) {
      console.warn(`MentionPage: no source available for url ${url}`)
      return { pageUrl: url }
    }

    const pageId = (() => {
      try {
        const urlObj = new URL(url || '', 'http://notion.so')
        const pathWithoutLeadingSlash = urlObj.pathname.replace(/^\//, '')
        const firstSegment = pathWithoutLeadingSlash.split('/')[0]
        return firstSegment || ''
      } catch (e) {
        console.error('MentionPage error getting page id', e)
        return ''
      }
    })()

    if (!pageId) return { pageUrl: url }

    const pages = source.getPages() // TODO pass locale here?
    const page = pages.find((p) => p.data?.notionPageId === pageId)

    if (page) {
      return { pageUrl: page.url, icon: page.data.icon }
    }

    console.warn(`MentionPage: cannot find page for notion id ${pageId}`)
    return { pageUrl: url }
  }, [context?.source, url])

  if (!pageUrl) {
    return (
      <span className='inline-flex items-center gap-1 text-gray-600'>
        {icon && <DynamicIcon icon={icon} className='size-4' />}
        {children}
      </span>
    )
  }

  return (
    <Link
      to={pageUrl}
      className='inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 no-underline'
    >
      {icon && <DynamicIcon icon={icon} className='size-4' />}
      {children}
    </Link>
  )
}

function MentionDatabase({
  url,
  icon,
  children,
}: {
  url: string
  icon?: string
  children?: React.ReactNode
}) {
  return (
    <a
      href={url}
      className='inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 no-underline'
    >
      {icon && <DynamicIcon icon={icon} className='size-4' />}
      {children}
    </a>
  )
}

function MentionDataSource({
  url,
  icon,
  children,
}: {
  url: string
  icon?: string
  children?: React.ReactNode
}) {
  return (
    <a
      href={url}
      className='inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 no-underline'
    >
      {icon && <DynamicIcon icon={icon} className='size-4' />}
      {children}
    </a>
  )
}

function MentionDate({ start, end }: { start: string; end?: string }) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString()
  }

  return (
    <span className='inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm'>
      {formatDate(start)}
      {end && ` → ${formatDate(end)}`}
    </span>
  )
}

function Audio({
  source,
  color,
  children,
}: {
  source: string
  color?: Color
  children?: React.ReactNode
}) {
  return (
    <div className='my-4 p-4 border border-gray-200 rounded-md bg-gray-50'>
      <audio controls className='w-full'>
        <source src={source} />
        Your browser does not support the audio element.
      </audio>
      {children && (
        <div className='mt-2 text-sm text-gray-500 text-center'>{children}</div>
      )}
    </div>
  )
}

function File({
  source,
  color,
  children,
}: {
  source: string
  color?: Color
  children?: React.ReactNode
}) {
  const displayText = children || 'Download File'
  return (
    <div className='my-4 p-4 border border-gray-200 rounded-md bg-gray-50'>
      <a
        href={source}
        download
        className='block no-underline text-blue-500 font-medium'
      >
        {displayText}
      </a>
    </div>
  )
}

function Image({
  source,
  color,
  children,
}: {
  source: string
  color?: Color
  children?: React.ReactNode
}) {
  return (
    <figure className='my-4'>
      <img
        src={source}
        alt={typeof children === 'string' ? children : ''}
        className='rounded-lg w-full'
      />
      {children && (
        <figcaption className='mt-2 text-sm text-center text-muted-foreground'>
          {children}
        </figcaption>
      )}
    </figure>
  )
}

function Pdf({
  source,
  color,
  children,
}: {
  source: string
  color?: Color
  children?: React.ReactNode
}) {
  return (
    <div className='my-4 p-4 border border-gray-200 rounded-md bg-gray-50'>
      <a
        href={source}
        target='_blank'
        rel='noopener noreferrer'
        className='flex items-center gap-2 text-blue-600 hover:text-blue-800 no-underline'
      >
        {children || 'View PDF'}
      </a>
    </div>
  )
}

function Video({
  source,
  color,
  children,
}: {
  source: string
  color?: Color
  children?: React.ReactNode
}) {
  return (
    <div className='my-4'>
      <div className='relative pb-[56.25%] h-0 overflow-hidden max-w-full'>
        <iframe
          src={source}
          title={typeof children === 'string' ? children : 'Video'}
          allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
          allowFullScreen
          className='absolute top-0 left-0 w-full h-full border-0'
        />
      </div>
      {children && (
        <div className='text-center text-sm text-gray-500 mt-2'>{children}</div>
      )}
    </div>
  )
}

function Page({
  url,
  color,
  children,
}: {
  url?: string
  color?: Color
  children?: React.ReactNode
}) {
  return (
    <div>
      <MentionPage url={url}>{children}</MentionPage>
    </div>
  )
}

function Database({
  url,
  inline,
  icon,
  color,
  children,
}: {
  url?: string
  inline?: boolean | string
  icon?: string
  color?: Color
  children?: React.ReactNode
}) {
  return (
    <div className='my-4 p-4 border border-border rounded-lg bg-muted'>
      <div className='flex items-center gap-2'>
        {icon && <span>{icon}</span>}
        <span className='font-medium'>{children}</span>
      </div>
      {url && <div className='mt-2 text-xs text-muted-foreground'>{url}</div>}
    </div>
  )
}

function DataSource({
  url,
  children,
}: {
  url: string
  children?: React.ReactNode
}) {
  return (
    <a
      href={url}
      className='block my-2 p-3 border border-border rounded-lg hover:bg-muted no-underline'
    >
      {children}
    </a>
  )
}

function View({ url, children }: { url: string; children?: React.ReactNode }) {
  return (
    <div className='my-4 p-4 border border-border rounded-lg'>
      <div className='text-sm text-muted-foreground'>View: {children}</div>
    </div>
  )
}

function NotionCallout({
  icon,
  color,
  children,
}: {
  icon?: string
  color?: Color
  children?: React.ReactNode
}) {
  return (
    <Callout icon={icon ? <span>{icon}</span> : undefined} className='my-4'>
      {children}
    </Callout>
  )
}

function Columns({ children }: { children?: React.ReactNode }) {
  const childArray = React.Children.toArray(children)
  const cols = childArray.length || 2
  return (
    <div
      className='grid gap-4 my-4'
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  )
}

function Column({ children }: { children?: React.ReactNode }) {
  return <div className='flex flex-col gap-4 p-2 flex-1'>{children}</div>
}

function TableOfContents({ color }: { color?: Color }) {
  return (
    <div className='my-4 p-4 border border-border rounded-lg bg-muted'>
      <div className='text-sm font-medium'>Table of Contents</div>
    </div>
  )
}

function SyncedBlock({
  url,
  children,
}: {
  url?: string
  children?: React.ReactNode
}) {
  return (
    <div className='my-4 p-4 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950'>
      {children}
    </div>
  )
}

function SyncedBlockReference({
  url,
  children,
}: {
  url: string
  children?: React.ReactNode
}) {
  return (
    <div className='my-4 p-4 border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-950'>
      {children}
    </div>
  )
}

function Unknown({ url, alt }: { url: string; alt: string }) {
  return (
    <div className='my-4 p-4 border border-border rounded-lg bg-muted'>
      <div className='text-sm text-muted-foreground'>
        Unknown block type: {alt}
      </div>
    </div>
  )
}

function MeetingNotes({ children }: { children?: React.ReactNode }) {
  return (
    <div className='my-4 p-4 border border-border rounded-lg'>
      <div className='text-lg font-medium mb-4'>Meeting Notes</div>
      {children}
    </div>
  )
}

function Summary({ children }: { children?: React.ReactNode }) {
  return (
    <div className='my-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg'>
      <div className='text-sm font-medium mb-2'>Summary</div>
      {children}
    </div>
  )
}

function Notes({ children }: { children?: React.ReactNode }) {
  return (
    <div className='my-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg'>
      <div className='text-sm font-medium mb-2'>Notes</div>
      {children}
    </div>
  )
}

function Transcript({ children }: { children?: React.ReactNode }) {
  return (
    <div className='my-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg'>
      <div className='text-sm font-medium mb-2'>Transcript</div>
      {children}
    </div>
  )
}

function NotionTable({
  'fit-page-width': fitPageWidth,
  'header-row': headerRow,
  'header-column': headerColumn,
  children,
}: {
  'fit-page-width'?: boolean | string
  'header-row'?: boolean | string
  'header-column'?: boolean | string
  children?: React.ReactNode
}) {
  return <table>{children}</table>
}

function Colgroup({ children }: { children?: React.ReactNode }) {
  return <colgroup>{children}</colgroup>
}

function Col({ color, width }: { color?: Color; width?: string }) {
  return <col style={width ? { width } : undefined} />
}

function Tr({
  color,
  children,
}: {
  color?: Color
  children?: React.ReactNode
}) {
  return <tr>{children}</tr>
}

function Td({
  color,
  children,
}: {
  color?: Color
  children?: React.ReactNode
}) {
  return <td>{children}</td>
}

function Span({
  color,
  underline,
  children,
}: {
  color?: Color
  underline?: boolean | string
  children?: React.ReactNode
}) {
  const isUnderlined = underline === true || underline === 'true'
  return (
    <span className={isUnderlined ? 'underline' : undefined}>{children}</span>
  )
}

function Br() {
  return <br />
}

export const notionComponents = {
  'mention-user': MentionUser,
  'mention-page': MentionPage,
  'mention-database': MentionPage,
  'mention-data-source': MentionPage,
  'mention-date': MentionDate,
  audio: Audio,
  file: File,
  image: Image,
  pdf: Pdf,
  video: Video,
  page: MentionPage,
  database: MentionPage,
  'data-source': DataSource,
  view: View,
  callout: NotionCallout,
  columns: Columns,
  column: Column,
  table_of_contents: TableOfContents,
  synced_block: SyncedBlock,
  // TODO the notion-mdx code should fetch the associated block with fetch and replace synced block with the actual content
  synced_block_reference: SyncedBlockReference,
  unknown: Unknown,
  'meeting-notes': MeetingNotes,
  summary: Summary,
  notes: Notes,
  transcript: Transcript,
  table: NotionTable,
  colgroup: Colgroup,
  col: Col,
  tr: Tr,
  td: Td,
  span: Span,
  br: Br,
}
