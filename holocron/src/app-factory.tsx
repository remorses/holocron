/**
 * Holocron app factory — creates the Spiceflow app with all routes.
 *
 * Separated from app.tsx so the rendering logic doesn't depend on virtual
 * modules and can be tested independently.
 */

import './styles/globals.css'
import React, { Fragment, type ReactNode } from 'react'
import { Spiceflow, serveStatic } from 'spiceflow'
import { Head } from 'spiceflow/react'
import { publicDir, distDir } from 'spiceflow'
import { SafeMdxRenderer } from 'safe-mdx'
import { mdxParse } from 'safe-mdx/parse'
import type { Root, Heading, RootContent, Image } from 'mdast'
import type { MyRootContent } from 'safe-mdx'
import path from 'node:path'
import {
  EditorialPage,
  Aside,
  FullWidth,
  Hero,
  P,
  A,
  Code,
  Caption,
  CodeBlock,
  SectionHeading,
  ComparisonTable,
  PixelatedImage,
  Bleed,
  List,
  OL,
  Li,
  type TabItem,
  type HeaderLink,
  type HeadingLevel,
  type EditorialSection,
} from './components/markdown.tsx'
import { slugify, extractText } from './components/toc-tree.ts'
import { buildImageManifest } from './lib/image-cache.ts'
import type { HolocronConfig } from './config.ts'
import {
  type Navigation,
  type NavTab,
  type NavPage,
  isNavPage,
  isNavGroup,
  getActiveGroups,
  findPage,
  collectAllPages,
  flattenForSidebar,
} from './navigation.ts'

/* ── Types ───────────────────────────────────────────────────────────── */

type PageLoaders = Record<string, () => Promise<string>>

/* ── MDX section splitting (same logic as website/src/pages/index.tsx) ── */

function isAsideNode(node: RootContent): boolean {
  return node.type === 'mdxJsxFlowElement' && 'name' in node && (node as { name?: string }).name === 'Aside'
}

function isFullWidthNode(node: RootContent): boolean {
  return node.type === 'mdxJsxFlowElement' && 'name' in node && (node as { name?: string }).name === 'FullWidth'
}

function isHeroNode(node: RootContent): boolean {
  return node.type === 'mdxJsxFlowElement' && 'name' in node && (node as { name?: string }).name === 'Hero'
}

type MdastSection = {
  contentNodes: RootContent[]
  asideNodes: RootContent[]
  fullWidth?: boolean
}

function groupBySections(root: Root): MdastSection[] {
  const sections: MdastSection[] = []
  let current: MdastSection = { contentNodes: [], asideNodes: [] }

  for (const node of root.children) {
    if (node.type === 'heading' && (node as Heading).depth === 2) {
      if (current.contentNodes.length > 0 || current.asideNodes.length > 0) {
        sections.push(current)
      }
      current = { contentNodes: [node], asideNodes: [] }
    } else if (isFullWidthNode(node)) {
      if (current.contentNodes.length > 0 || current.asideNodes.length > 0) {
        sections.push(current)
      }
      const children = 'children' in node ? (node as { children: RootContent[] }).children : []
      sections.push({ contentNodes: children, asideNodes: [], fullWidth: true })
      current = { contentNodes: [], asideNodes: [] }
    } else if (isAsideNode(node)) {
      current.asideNodes.push(node)
    } else {
      current.contentNodes.push(node)
    }
  }

  if (current.contentNodes.length > 0 || current.asideNodes.length > 0) {
    sections.push(current)
  }

  return sections
}

/* ── App factory ─────────────────────────────────────────────────────── */

export function createHolocronApp({
  config,
  navigation,
  pageLoaders,
}: {
  config: HolocronConfig
  navigation: Navigation
  pageLoaders: PageLoaders
}) {
  const cacheDir = path.resolve(distDir, '.cache/images')

  // Build tab items: navigation tabs + anchors (all normalized, no unions)
  const navTabItems: TabItem[] = navigation
    .filter((t) => {
      return t.tab !== ''
    })
    .map((t) => {
      const firstPage = findFirstPageInTab(t)
      return {
        label: t.tab,
        href: firstPage?.href || '/',
      }
    })
  const anchorItems: TabItem[] = config.navigation.anchors.map((a) => {
    return { label: a.anchor, href: a.href }
  })
  const tabItems: TabItem[] = [...navTabItems, ...anchorItems]

  // navbar.links → header links (top-right, in logo bar)
  const headerLinks: HeaderLink[] = config.navbar.links.map((link) => {
    return { href: link.href, label: link.label }
  })

  // Logo — already normalized to { light, dark }
  const logoSrc = config.logo.light || undefined

  return new Spiceflow()
    .use(serveStatic({ root: './public' }))
    .layout('/*', async ({ children }) => {
      return (
        <html lang='en'>
          <Head>
            <Head.Meta charSet='utf-8' />
            <Head.Meta name='viewport' content='width=device-width, initial-scale=1' />
            <link rel='preconnect' href='https://fonts.googleapis.com' />
            <link rel='preconnect' href='https://fonts.gstatic.com' crossOrigin='' />
            <link href='https://rsms.me/inter/inter.css' rel='stylesheet' />
            <link
              href='https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&display=swap'
              rel='stylesheet'
            />
            {config.favicon.light && <link rel='icon' href={config.favicon.light} />}
            <Head.Title>{config.name}</Head.Title>
          </Head>
          <body>{children}</body>
        </html>
      )
    })
    .page('/*', async ({ params }) => {
      const rawSlug = (params as Record<string, string>)['*'] || 'index'
      const slug = rawSlug === '' ? 'index' : rawSlug

      const pageData = findPage(navigation, slug)
      if (!pageData) {
        return <div>Page not found: {slug}</div>
      }

      const mdxContent = await loadMdxContent(pageLoaders, slug)
      if (!mdxContent) {
        return <div>MDX content not found for: {slug}</div>
      }

      const mdast = mdxParse(mdxContent) as Root

      const imageManifest = await buildImageManifest({
        mdast,
        publicDir,
        cacheDir,
      })

      // Extract hero nodes
      const heroNodes = mdast.children.filter(isHeroNode)
      const contentChildren = mdast.children.filter((node) => {
        return !isHeroNode(node)
      })
      const contentMdast: Root = { type: 'root', children: contentChildren }

      // Sidebar items for current tab
      const activeGroups = getActiveGroups(navigation, pageData.href)
      const tocItems = flattenForSidebar(activeGroups)

      // Split into sections
      const mdastSections = groupBySections(contentMdast)

      // Image component with placeholder injection
      function PixelatedImageWithPlaceholder(props: {
        src: string
        alt: string
        width?: number
        height?: number
        className?: string
      }) {
        const data = imageManifest[props.src]
        return (
          <PixelatedImage
            src={props.src}
            alt={props.alt}
            width={data?.width ?? (props.width || 0)}
            height={data?.height ?? (props.height || 0)}
            placeholder={data?.placeholder}
            className={props.className || ''}
          />
        )
      }

      const mdxComponents = {
        p: P,
        a: A,
        code: Code,
        ul: List,
        ol: OL,
        li: Li,
        Caption,
        ComparisonTable,
        PixelatedImage: PixelatedImageWithPlaceholder,
        Bleed,
        Aside,
        FullWidth,
        Hero,
      }

      function renderNode(node: MyRootContent, transform: (node: MyRootContent) => ReactNode): ReactNode | undefined {
        if (node.type === 'image') {
          const imgNode = node as Image
          return <PixelatedImageWithPlaceholder src={imgNode.url} alt={imgNode.alt || ''} />
        }
        if (node.type === 'heading') {
          const heading = node as Heading
          const text = extractText(heading.children)
          const id = slugify(text)
          const level = Math.min(heading.depth - 1, 3) as HeadingLevel
          return (
            <SectionHeading key={id} id={id} level={level}>
              {heading.children.map((child, i) => {
                return <Fragment key={i}>{transform(child as MyRootContent)}</Fragment>
              })}
            </SectionHeading>
          )
        }
        if (node.type === 'code') {
          const codeNode = node as { lang?: string; value: string }
          const lang = codeNode.lang || 'bash'
          const isDiagram = lang === 'diagram'
          return (
            <CodeBlock lang={lang} lineHeight={isDiagram ? '1.3' : '1.85'} showLineNumbers={!isDiagram}>
              {codeNode.value}
            </CodeBlock>
          )
        }
        return undefined
      }

      function RenderNodes({ nodes }: { nodes: RootContent[] }) {
        const syntheticRoot: Root = { type: 'root', children: nodes }
        return (
          <SafeMdxRenderer
            markdown={mdxContent}
            mdast={syntheticRoot as MyRootContent}
            components={mdxComponents}
            renderNode={renderNode}
          />
        )
      }

      const sections: EditorialSection[] = mdastSections.map((section) => {
        const aside = section.asideNodes.length > 0 ? <RenderNodes nodes={section.asideNodes} /> : undefined
        return {
          content: <RenderNodes nodes={section.contentNodes} />,
          aside,
          fullWidth: section.fullWidth,
        }
      })

      const heroContent = heroNodes.length > 0 ? <RenderNodes nodes={heroNodes} /> : undefined

      // Determine active tab href
      const activeTabHref = tabItems.find((t) => {
        return pageData.href.startsWith(t.href) && t.href !== '/'
      })?.href || tabItems[0]?.href

      return (
        <>
          <Head>
            <Head.Title>{`${pageData.title} — ${config.name}`}</Head.Title>
            {pageData.description && <Head.Meta name='description' content={pageData.description} />}
          </Head>
          <EditorialPage
            toc={tocItems}
            logo={logoSrc}
            tabs={tabItems}
            activeTab={activeTabHref}
            headerLinks={headerLinks}
            sections={sections}
            hero={heroContent}
          />
        </>
      )
    })
    .get('/api/search', async ({ request }) => {
      const url = new URL(request.url)
      const query = url.searchParams.get('q') || ''

      const allPages = collectAllPages(navigation)
      const results = allPages
        .flatMap((page) => {
          return [
            { title: page.title, href: page.href, type: 'page' as const },
            ...page.headings.map((h) => {
              return {
                title: h.text,
                href: `${page.href}#${h.slug}`,
                type: 'heading' as const,
              }
            }),
          ]
        })
        .filter((item) => {
          return item.title.toLowerCase().includes(query.toLowerCase())
        })
        .slice(0, 20)

      return new Response(JSON.stringify(results), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 's-maxage=300, stale-while-revalidate=86400',
        },
      })
    })
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

async function loadMdxContent(loaders: PageLoaders, slug: string): Promise<string | undefined> {
  for (const ext of ['.mdx', '.md']) {
    const key = `/pages/${slug}${ext}`
    if (loaders[key]) {
      return loaders[key]()
    }
  }
  return undefined
}

function findFirstPageInTab(tab: NavTab): NavPage | undefined {
  for (const group of tab.groups) {
    for (const entry of group.pages) {
      if (isNavPage(entry)) {
        return entry
      }
      if (isNavGroup(entry)) {
        const found = findFirstPageInTab({ tab: '', groups: [entry] })
        if (found) {
          return found
        }
      }
    }
  }
  return undefined
}
