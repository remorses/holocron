/**
 * Holocron app factory — creates the Spiceflow app with all routes.
 *
 * Architecture:
 *
 *   .loader('/*')  → per-request minimal data (current page, headings,
 *                    ancestor keys). RSC-flight serialized to both server
 *                    page handler and client components (via useHolocronData).
 *
 *   .page('/*')    → parses MDX, renders sections/hero as server JSX,
 *                    hands them to EditorialPage.
 *
 * Static site data (navigation tree, tabs, header links, search entries)
 * lives in `./data.ts` and is bundled into the client chunk ONCE — never
 * re-shipped through the per-request loader payload.
 *
 * All MDX content and image metadata is pre-processed at build time.
 * Request-time rendering is just: parse mdast → render RSC components.
 * Zero file I/O, zero sharp, zero image-size — works on Cloudflare.
 */

import '@holocron.so/vite/styles/globals.css'
import React, { Fragment, type ReactNode } from 'react'
import { Spiceflow, serveStatic, redirect } from 'spiceflow'
import { Head } from 'spiceflow/react'
import { SafeMdxRenderer } from 'safe-mdx'
import { mdxParse } from 'safe-mdx/parse'
import type { Root, Heading, RootContent, Image } from 'mdast'
import type { MyRootContent } from 'safe-mdx'
import mdxContent from 'virtual:holocron-mdx'
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
  Callout,
  Note,
  Warning,
  Info,
  Tip,
  Check,
  Danger,
  type HeadingLevel,
  type EditorialSection,
} from '@holocron.so/vite/components/markdown'
import { slugify, extractText } from './components/toc-tree.ts'
import { TableOfContentsPanel } from './components/toc-panel.tsx'
import { NotFound } from './components/not-found.tsx'
import {
  findPage,
  collectAllPages,
  type NavHeading,
} from './navigation.ts'
import {
  config,
  navigation,
  firstPage,
  collectAncestorGroupKeys,
  resolveActiveTabHref,
} from './data.ts'
import { registerRedirects } from './lib/redirects.ts'

/* ── MDX section splitting ──────────────────────────────────────────── */

function isAsideNode(node: RootContent): boolean {
  return node.type === 'mdxJsxFlowElement' && 'name' in node && (node as { name?: string }).name === 'Aside'
}

function hasFullProp(node: RootContent): boolean {
  const attrs = (node as { attributes?: Array<{ name: string }> }).attributes
  return attrs?.some((a) => a.name === 'full') ?? false
}

function isFullWidthNode(node: RootContent): boolean {
  return node.type === 'mdxJsxFlowElement' && 'name' in node && (node as { name?: string }).name === 'FullWidth'
}

function isHeroNode(node: RootContent): boolean {
  return node.type === 'mdxJsxFlowElement' && 'name' in node && (node as { name?: string }).name === 'Hero'
}

/** Filter out mdast node types that render to nothing so they don't create
 *  empty grid rows. Frontmatter (`yaml`/`toml`) and link reference definitions
 *  are the main culprits — they appear as top-level children but produce no
 *  visible output. Leaving them in would add an extra empty `slot-main` +
 *  `--section-gap` before the first real section. */
function isInvisibleNode(node: RootContent): boolean {
  const t = (node as { type: string }).type
  return t === 'yaml' || t === 'toml' || t === 'definition'
}

type MdastSection = {
  contentNodes: RootContent[]
  asideNodes: RootContent[]
  /** How many section rows this section's aside spans on desktop.
   *  1 (default) for per-section asides; N for a shared `<Aside full>`
   *  range, where N is the number of sub-sections.
   *
   *  For a shared full aside, the aside is attached to the LAST sub-section
   *  of its range (so on mobile it stacks at the end of the content range).
   *  On desktop the renderer computes the starting grid row from the
   *  section's own index and the span: `start = thisRow - span + 1`. */
  asideRowSpan?: number
  fullWidth?: boolean
}

function groupBySections(root: Root): MdastSection[] {
  const sections: MdastSection[] = []
  let current: MdastSection = { contentNodes: [], asideNodes: [] }

  for (const node of root.children) {
    // Split on ANY heading depth (#, ##, ###, ####, #####, ######) so every
    // heading gets its own grid row with --section-gap above it. This keeps
    // vertical rhythm uniform regardless of heading hierarchy — headings
    // always stand out with 48px breathing room, and content under a
    // heading flows with the tighter --prose-gap inside each section.
    if (node.type === 'heading') {
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

/**
 * Build sections with support for `<Aside full>`.
 *
 * A full aside spans every sub-section between itself and the next
 * `<Aside full>` (or EOF). Unlike the earlier "merged" approach, we STILL
 * split content at EVERY heading level inside a full-aside range — each
 * sub-section gets its own row in the page grid, separated by `--section-gap`.
 * The shared
 * aside is attached to the first sub-section with `asideRowSpan` set to the
 * number of sub-sections, so on desktop it lives in a CSS grid cell spanning
 * all those rows (`grid-row: N / span M`). Inside that tall cell a
 * `position: sticky` aside can scroll alongside the whole range.
 *
 * Sections BEFORE the first full aside still use normal per-section asides
 * (asideRowSpan = 1).
 */
function buildSections(root: Root): MdastSection[] {
  // Strip invisible nodes (frontmatter, link definitions) from the top level
  // so they don't get swept into a leading empty section by groupBySections.
  const children = root.children.filter((n) => !isInvisibleNode(n))

  // Find indices of all <Aside full> nodes
  const fullAsideIndices: number[] = []
  for (let i = 0; i < children.length; i++) {
    const node = children[i]!
    if (isAsideNode(node) && hasFullProp(node)) {
      fullAsideIndices.push(i)
    }
  }

  // No full asides → split normally (existing behavior)
  if (fullAsideIndices.length === 0) {
    return groupBySections({ type: 'root', children } as Root)
  }

  const sections: MdastSection[] = []
  const firstIdx = fullAsideIndices[0]!

  // Range before first full aside → split normally at ## headings
  if (firstIdx > 0) {
    const before: Root = { type: 'root', children: children.slice(0, firstIdx) }
    sections.push(...groupBySections(before))
  }

  // Each full-aside range: split at ## into sub-sections; first sub-section
  // owns the shared aside with row-span = number of sub-sections.
  for (let r = 0; r < fullAsideIndices.length; r++) {
    const start = fullAsideIndices[r]!
    const end = fullAsideIndices[r + 1] ?? children.length

    const rangeNodes = children.slice(start + 1, end)
    const contentOnly = rangeNodes.filter((n) => !isAsideNode(n) && !isFullWidthNode(n))
    const asideNode = children[start]!

    const contentRoot: Root = { type: 'root', children: contentOnly }
    const subSections = groupBySections(contentRoot)

    if (subSections.length === 0) {
      sections.push({ contentNodes: [], asideNodes: [asideNode], asideRowSpan: 1 })
      continue
    }

    // Attach the shared aside to the LAST sub-section (for clean mobile stacking
    // at the end of its range). Desktop rendering uses asideRowSpan to compute
    // an explicit `grid-row: start / span N` that covers all sub-sections.
    const lastSub = subSections[subSections.length - 1]!
    lastSub.asideNodes = [asideNode]
    lastSub.asideRowSpan = subSections.length
    sections.push(...subSections)
  }

  return sections
}

/* ── MDX render helpers (module-scope, shared across all requests) ──── */

function PixelatedImageWithProps(props: {
  src: string
  alt: string
  width?: number
  height?: number
  placeholder?: string
  className?: string
}) {
  return (
    <PixelatedImage
      src={props.src}
      alt={props.alt}
      width={props.width || 0}
      height={props.height || 0}
      placeholder={props.placeholder}
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
  PixelatedImage: PixelatedImageWithProps,
  Bleed,
  Aside,
  FullWidth,
  Hero,
  Callout,
  Note,
  Warning,
  Info,
  Tip,
  Check,
  Danger,
  // Reads currentHeadings from useHolocronData() when `headings` prop omitted.
  // No more per-page closure binding.
  TableOfContentsPanel,
}

function renderNode(
  node: MyRootContent,
  transform: (node: MyRootContent) => ReactNode,
): ReactNode | undefined {
  if (node.type === 'image') {
    const imgNode = node as Image
    return <PixelatedImageWithProps src={imgNode.url} alt={imgNode.alt || ''} />
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
      <CodeBlock lang={lang} lineHeight={isDiagram ? '1.3' : '1.6'} showLineNumbers={!isDiagram}>
        {codeNode.value}
      </CodeBlock>
    )
  }
  return undefined
}

function RenderNodes({ markdown, nodes }: { markdown: string; nodes: RootContent[] }) {
  const syntheticRoot: Root = { type: 'root', children: nodes }
  return (
    <SafeMdxRenderer
      markdown={markdown}
      mdast={syntheticRoot as MyRootContent}
      components={mdxComponents}
      renderNode={renderNode}
    />
  )
}

/* ── Loader data type ────────────────────────────────────────────────── */

/**
 * Per-request data produced by `.loader('/*')`. Serialized via RSC flight
 * to both the page handler (via `loaderData`) and every client component
 * (via `useHolocronData()` from `@holocron.so/vite/react`).
 *
 * Intentionally MINIMAL — static data (navigation tree, tabs, header
 * links, search entries) lives in `./data.ts` and is bundled into the
 * client chunk once. Only per-request state flows through this payload.
 */
export type HolocronLoaderData = {
  /** Active page href, or `undefined` on 404. */
  currentPageHref: string | undefined
  /** Active page title, or `undefined` on 404. */
  currentPageTitle: string | undefined
  /** Active page description (for meta tag), or `undefined`. */
  currentPageDescription: string | undefined
  /** Flat heading list for the active page — used by TOC scroll tracking. */
  currentHeadings: NavHeading[]
  /** Path-based keys (`\0`-joined) of groups that should start expanded. */
  ancestorGroupKeys: string[]
  /** Href of the tab that contains the active page. */
  activeTabHref: string | undefined
  /** Original requested path when a 404 occurred (includes leading slash). */
  notFoundPath: string | undefined
  /** Fully-composed `<title>` text (includes site name suffix). */
  headTitle: string
  /** Value for `<meta name="robots">`, or `undefined` to omit the tag. */
  headRobots: string | undefined
}

/* ── App factory ─────────────────────────────────────────────────────── */

export function createHolocronApp() {
  let app = new Spiceflow().use(serveStatic({ root: './public' }))

  // Install config-driven redirects as `.use()` middleware. Runs
  // before loader/layout/page — on match, throws a redirect Response
  // that short-circuits the request pipeline. See lib/redirects.ts
  // and MEMORY.md for why middleware + custom matcher instead of
  // spiceflow routes.
  app = registerRedirects(app, config.redirects)

  return app
    .loader('/*', async ({ params, response }): Promise<HolocronLoaderData> => {
      const rawSlug = (params as Record<string, string>)['*'] || ''
      const slug = rawSlug === '' ? 'index' : rawSlug

      const currentPage = findPage(navigation, slug)
      const hasMdx = currentPage ? mdxContent[slug] !== undefined : false

      // Root path with no index page → redirect to first page in navigation
      if (!currentPage && (slug === 'index' || slug === '') && firstPage) {
        throw redirect(firstPage.href)
      }

      // 404 case — either the page isn't in navigation, or its MDX is missing
      if (!currentPage || !hasMdx) {
        response.status = 404
        return {
          currentPageHref: undefined,
          currentPageTitle: undefined,
          currentPageDescription: undefined,
          currentHeadings: [],
          ancestorGroupKeys: firstPage ? collectAncestorGroupKeys(firstPage.href) : [],
          activeTabHref: resolveActiveTabHref(firstPage?.href),
          notFoundPath: '/' + rawSlug,
          headTitle: `Page not found — ${config.name}`,
          headRobots: 'noindex',
        }
      }

      return {
        currentPageHref: currentPage.href,
        currentPageTitle: currentPage.title,
        currentPageDescription: currentPage.description ?? config.description,
        currentHeadings: currentPage.headings,
        ancestorGroupKeys: collectAncestorGroupKeys(currentPage.href),
        activeTabHref: resolveActiveTabHref(currentPage.href),
        notFoundPath: undefined,
        headTitle: `${currentPage.title} — ${config.name}`,
        headRobots: undefined,
      }
    })
    .layout('/*', async ({ children }) => {
      // Favicon: emit a single <link> when only one variant is set (or when
      // both normalize to the same asset), or two with prefers-color-scheme
      // media queries when the user explicitly provided distinct light/dark
      // files.
      const { light: faviconLight, dark: faviconDark } = config.favicon
      const hasBoth =
        Boolean(faviconLight) && Boolean(faviconDark) && faviconLight !== faviconDark
      return (
        <html lang='en'>
          <Head>
            <Head.Meta charSet='utf-8' />
            <Head.Meta name='viewport' content='width=device-width, initial-scale=1' />
            <link rel='preconnect' href='https://fonts.googleapis.com' />
            <link rel='preconnect' href='https://fonts.gstatic.com' crossOrigin='' />
            <link href='https://rsms.me/inter/inter.css' rel='stylesheet' precedence='default' />
            <link
              href='https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&display=swap'
              rel='stylesheet'
              precedence='default'
            />
            {hasBoth ? (
              <>
                <link rel='icon' href={faviconLight} media='(prefers-color-scheme: light)' />
                <link rel='icon' href={faviconDark} media='(prefers-color-scheme: dark)' />
              </>
            ) : (
              (faviconLight || faviconDark) && (
                <link rel='icon' href={faviconLight || faviconDark} />
              )
            )}
            {config.description && (
              <>
                <Head.Meta name='description' content={config.description} />
                <Head.Meta property='og:description' content={config.description} />
              </>
            )}
            <Head.Meta property='og:site_name' content={config.name} />
            <Head.Title>{config.name}</Head.Title>
          </Head>
          <body>{children}</body>
        </html>
      )
    })
    .page('/*', async ({ params, loaderData: rawLoaderData }) => {
      // Spiceflow's page-handler context does not (yet) thread the loader
      // return type into its own `loaderData` slot — only the typed client
      // router exposes it. Cast once here so the rest of the handler is safe.
      const loaderData = rawLoaderData as unknown as HolocronLoaderData

      // 404 branch — render inside the normal shell so the user can navigate
      if (loaderData.notFoundPath) {
        return (
          <>
            <Head>
              <Head.Title>{loaderData.headTitle}</Head.Title>
              {loaderData.headRobots && (
                <Head.Meta name='robots' content={loaderData.headRobots} />
              )}
            </Head>
            <EditorialPage>
              <NotFound
                path={loaderData.notFoundPath}
                homeHref={firstPage?.href || '/'}
              />
            </EditorialPage>
          </>
        )
      }

      // Happy path — parse MDX and render sections + hero as server JSX
      const rawSlug = (params as Record<string, string>)['*'] || ''
      const slug = rawSlug === '' ? 'index' : rawSlug
      const pageMdx = mdxContent[slug]!

      const mdast = mdxParse(pageMdx) as Root
      const heroNodes = mdast.children.filter(isHeroNode)
      const contentChildren = mdast.children.filter((node) => !isHeroNode(node))
      const contentMdast: Root = { type: 'root', children: contentChildren }
      const mdastSections = buildSections(contentMdast)

      const sections: EditorialSection[] = mdastSections.map((section) => {
        const aside =
          section.asideNodes.length > 0 ? (
            <RenderNodes markdown={pageMdx} nodes={section.asideNodes} />
          ) : undefined
        return {
          content: <RenderNodes markdown={pageMdx} nodes={section.contentNodes} />,
          aside,
          fullWidth: section.fullWidth,
          asideRowSpan: section.asideRowSpan,
        }
      })

      const hero =
        heroNodes.length > 0 ? (
          <RenderNodes markdown={pageMdx} nodes={heroNodes} />
        ) : undefined

      return (
        <>
          <Head>
            <Head.Title>{loaderData.headTitle}</Head.Title>
            {loaderData.currentPageDescription && (
              <>
                <Head.Meta name='description' content={loaderData.currentPageDescription} />
                <Head.Meta property='og:description' content={loaderData.currentPageDescription} />
              </>
            )}
          </Head>
          <EditorialPage sections={sections} hero={hero} />
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

/* ── Public type for the client router ───────────────────────────────── */

/**
 * The fully-typed Spiceflow app instance. Use this with `createRouter<App>()`
 * in client code to get typed `useLoaderData`, `href`, and `router` bindings.
 * The actual router module (`./router.ts`) already does this — client
 * components should import from `@holocron.so/vite/react` directly.
 */
export type HolocronApp = ReturnType<typeof createHolocronApp>
