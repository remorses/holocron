/**
 * Changelog virtual tab provider.
 *
 * Implements VirtualTabProvider to generate a single changelog page from a
 * GitHub repository's releases. Reads the `tab.changelog` field (a full URL
 * such as `https://github.com/owner/repo`), fetches the published releases,
 * and renders one `<Update>` entry per release.
 *
 * The generated page uses `mode: center` so the left navigation sidebar is
 * hidden, and a right-side `<Aside full>` notice explains the page is
 * generated from the GitHub releases page.
 *
 * When `tab.initialContent` is set, the referenced MDX file's content
 * (stripped of frontmatter) is prepended above the Update entries so users
 * can add a custom hero, intro, or `<Above>` section at the top.
 *
 * Tests can point the fetch at a local mock server via the
 * HOLOCRON_CHANGELOG_API_URL environment variable.
 */

import fs from 'node:fs'
import path from 'node:path'
import { remark } from 'remark'
import remarkMdx from 'remark-mdx'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import { toMarkdown } from 'mdast-util-to-markdown'
import { mdxToMarkdown } from 'mdast-util-mdx'
import type { Root } from 'mdast'
import type { ConfigNavGroup } from '../../config.ts'
import type { VirtualTabProvider, VirtualTabResult } from '../virtual-tab-provider.ts'
import { buildVirtualPageMdx } from '../virtual-page-mdx.ts'
import { buildSplicedNodes } from '../remark-inline-imports.ts'
import { logger, formatHolocronWarning } from '../logger.ts'
import { parseChangelogSource } from './parse-source.ts'
import { fetchGitHubReleases, type GitHubRelease } from './github-releases.ts'

/** Try to resolve a page slug to an on-disk MDX/MD file, probing pagesDir
 *  first, then projectRoot. Returns the absolute path or undefined. */
function resolveContentFile(slug: string, pagesDir: string, projectRoot: string): string | undefined {
  // If slug already has an extension, probe it directly
  const hasExt = /\.mdx?$/.test(slug)
  for (const dir of [pagesDir, projectRoot]) {
    if (hasExt) {
      const abs = path.join(dir, slug)
      if (fs.existsSync(abs)) return abs
    } else {
      for (const ext of ['.mdx', '.md']) {
        const abs = path.join(dir, slug + ext)
        if (fs.existsSync(abs)) return abs
      }
    }
  }
  return undefined
}

/** Read an MDX file, parse it, strip frontmatter, rewrite relative URLs
 *  so they resolve correctly from the changelog page's context, and
 *  serialize back to an MDX string. */
function readAndRewriteContent(filePath: string, changelogSlug: string, pagesDir: string): string {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const processor = remark().use(remarkMdx).use(remarkFrontmatter, ['yaml']).use(remarkGfm)
  const mdast = processor.runSync(processor.parse(raw)) as Root

  const importDir = path.dirname(filePath)
  // Compute relative path from the changelog page's directory to the
  // intro file's directory so relative URLs get rewritten correctly.
  const changelogDir = path.dirname(path.join(pagesDir, changelogSlug))
  const relativeDir = path.relative(changelogDir, importDir).replace(/\\/g, '/')
  const relDirNorm = relativeDir === '' ? './' : (relativeDir.startsWith('.') ? relativeDir : './' + relativeDir) + '/'

  const nodes = buildSplicedNodes(mdast, relDirNorm, { importDir, pagesDir })
  return toMarkdown({ type: 'root', children: nodes }, { extensions: [mdxToMarkdown()] }).trim()
}

export const changelogProvider: VirtualTabProvider = {
  name: 'changelog',
  claims: (tab) => !!tab.changelog,

  async generate({ tab, projectRoot, pagesDir }): Promise<VirtualTabResult> {
    const source = parseChangelogSource(tab.changelog!)
    const slug = tab.base ?? 'changelog'
    const title = tab.tab || 'Changelog'

    const releases = await fetchGitHubReleases({
      owner: source.owner,
      repo: source.repo,
      baseUrl: process.env.HOLOCRON_CHANGELOG_API_URL,
    })

    // Resolve optional initialContent MDX file
    let initialContentBody: string | undefined
    if (tab.initialContent) {
      const contentPath = resolveContentFile(tab.initialContent, pagesDir, projectRoot)
      if (contentPath) {
        initialContentBody = readAndRewriteContent(contentPath, slug, pagesDir)
      } else {
        logger.warn(
          formatHolocronWarning(
            `Changelog initialContent "${tab.initialContent}" not found. ` +
            `Looked in "${pagesDir}" and "${projectRoot}".`,
          ),
        )
      }
    }

    const mdx = buildChangelogMdx({
      title,
      releasesUrl: source.releasesUrl,
      releases,
      initialContentBody,
    })

    const groups: ConfigNavGroup[] = [{ group: '', pages: [slug] }]
    return { groups, mdxContent: { [slug]: mdx } }
  },
}

/** Build the single changelog MDX page from the fetched releases. */
function buildChangelogMdx({
  title,
  releasesUrl,
  releases,
  initialContentBody,
}: {
  title: string
  releasesUrl: string
  releases: GitHubRelease[] | null
  initialContentBody?: string
}): string {
  // Right-column notice explaining the page is auto-generated.
  const aside = [
    '<Note>',
    '',
    `This changelog is generated automatically from the [GitHub releases](${releasesUrl}) page.`,
    '',
    '</Note>',
  ].join('\n')

  const bodyParts: string[] = []

  // Prepend custom initial content above the Update entries
  if (initialContentBody) {
    bodyParts.push(initialContentBody)
  }

  if (releases === null) {
    bodyParts.push(
      [
        '<Warning>',
        '',
        `Could not load releases from [GitHub](${releasesUrl}). This is usually a transient`,
        'network or rate-limit issue. The changelog will appear once the releases can be fetched again.',
        '',
        '</Warning>',
      ].join('\n'),
    )
  } else if (releases.length === 0) {
    bodyParts.push(`No releases have been published yet. See the [releases page](${releasesUrl}).`)
  } else {
    bodyParts.push(releases.map(renderRelease).join('\n\n'))
  }

  return buildVirtualPageMdx({
    frontmatter: {
      title,
      description: `Release notes for ${title}.`,
      mode: 'center',
    },
    aside,
    body: bodyParts.join('\n\n'),
  })
}

/** Render one release as an `<Update>` block whose children are the release
 *  body markdown. The release name renders as an H2 heading inside the block.
 *
 *  The left rail pill shows the release DATE (not the version). The version
 *  (tag_name) is the H2 heading and the stable anchor `id`, so anchors stay
 *  unique even when two releases share a date.
 *
 *  GitHub release notes are Markdown, NOT MDX. Tags, names, and bodies may
 *  contain `"`, `<`, `{`, `}`, or even `</Update>`-looking text that would
 *  break the generated MDX or escape the wrapper. JSX attributes are emitted
 *  as `={JSON.stringify(value)}` expressions, and the heading + body have
 *  their MDX-significant characters escaped outside code regions. */
function renderRelease(release: GitHubRelease): string {
  // The pill shows the date; fall back to the version when no date is set.
  const dateLabel = formatDate(release.publishedAt) ?? release.tagName
  const label = jsxAttr(dateLabel)
  const id = jsxAttr(release.tagName)
  // Escape MDX-significant chars in the heading text (`<`, `{`, `}`).
  const heading = (release.name?.trim() || release.tagName).replace(/[<{}]/g, (ch) => `\\${ch}`)

  // The body is GitHub-flavored markdown. Blank lines around it ensure the
  // MDX parser treats the children as block content rather than inline.
  const bodyMd = escapeMdxMarkdown((release.body ?? '').trim())

  return [
    `<Update id=${id} label=${label}>`,
    '',
    `## ${heading}`,
    ...(bodyMd ? ['', bodyMd] : []),
    '',
    '</Update>',
  ].join('\n')
}

/** Render a string as a JSX attribute value expression (`={"..."}`). Using a
 *  JSON-encoded expression instead of a quoted literal makes any character —
 *  quotes, braces, angle brackets — safe inside the attribute. */
function jsxAttr(value: string): string {
  return `{${JSON.stringify(value)}}`
}

/** Escape MDX-significant characters in a Markdown body while preserving code.
 *
 *  MDX treats `<` as JSX and `{` as an expression everywhere EXCEPT inside
 *  code (fenced blocks and inline spans), where they are literal. So we escape
 *  `<`, `{`, `}` only outside code regions; escaping inside code would corrupt
 *  the rendered source. Fenced blocks are tracked by their ``` / ~~~ fences;
 *  inline code spans are tracked by matching backtick runs within a line. */
function escapeMdxMarkdown(md: string): string {
  if (!md) return md
  const lines = md.split('\n')
  let fence: string | null = null
  return lines
    .map((line) => {
      const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/)
      if (fenceMatch) {
        const fenceChar = fenceMatch[2]!.charAt(0) // ` or ~
        if (fence === null) {
          fence = fenceChar // opening fence: remember the fence char
          return line // opening fence line is left as-is
        }
        if (fenceChar === fence) {
          fence = null
          return line // closing fence line is left as-is
        }
      }
      if (fence !== null) return line // inside a fenced code block: literal
      return escapeOutsideInlineCode(line)
    })
    .join('\n')
}

/** Escape `<`, `{`, `}` in the non-code segments of one line. Inline code
 *  spans (delimited by matching backtick runs) are left untouched. */
function escapeOutsideInlineCode(line: string): string {
  let result = ''
  let i = 0
  while (i < line.length) {
    const ch = line[i]!
    if (ch === '`') {
      // Consume the backtick run, then everything up to a matching run.
      const runStart = i
      while (i < line.length && line[i] === '`') i++
      const ticks = line.slice(runStart, i)
      const closeIdx = line.indexOf(ticks, i)
      if (closeIdx === -1) {
        // Unterminated code span: treat the backticks as literal text and
        // keep escaping the remainder.
        result += ticks
        continue
      }
      result += ticks + line.slice(i, closeIdx) + ticks
      i = closeIdx + ticks.length
      continue
    }
    result += ch === '<' || ch === '{' || ch === '}' ? `\\${ch}` : ch
    i++
  }
  return result
}

/** Format an ISO timestamp as a short human date (e.g. "Jan 5, 2026"). */
function formatDate(iso: string | null): string | undefined {
  if (!iso) return undefined
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return undefined
  return new Date(ms).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
