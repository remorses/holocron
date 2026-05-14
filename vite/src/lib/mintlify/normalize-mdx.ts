import { frontmatterToMarkdown } from 'mdast-util-frontmatter'
import { gfmToMarkdown } from 'mdast-util-gfm'
import { mdxToMarkdown } from 'mdast-util-mdx'
import { toMarkdown } from 'mdast-util-to-markdown'
import type { Root } from 'mdast'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMdx from 'remark-mdx'
import { remark } from 'remark'
import { remarkMarkAndUnravel } from 'safe-mdx/parse'
import { remarkCodeGroup } from './remark-code-group.ts'
import { remarkDetailsToggle } from './remark-details-toggle.ts'
import { remarkGithubCallouts } from './remark-github-callouts.ts'
import { remarkHeadings } from './remark-headings.ts'
import { remarkMermaidCode } from './remark-mermaid.ts'
import { remarkSidebarComponents } from './remark-sidebar-components.ts'
import { remarkSingleAccordionItems } from './remark-single-accordion.ts'
import { HolocronMdxParseError, extractParseErrorInfo } from '../logger.ts'

export type NormalizedMdx = {
  /** Serialized MDX string after all remark transforms */
  content: string
  /** The normalized mdast tree — reuse instead of re-parsing content */
  mdast: Root
}

/**
 * Parse MDX content and run all remark transform plugins.
 * Returns HolocronMdxParseError on syntax errors instead of throwing.
 * @param source - optional file path or slug for error messages (e.g. "/getting-started")
 */
export function normalizeMdx(content: string, source?: string): HolocronMdxParseError | NormalizedMdx {
  const processor = remark()
    .use(remarkMdx)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(remarkHeadings as never)
    .use(remarkCodeGroup)
    .use(remarkDetailsToggle)
    .use(remarkGithubCallouts)
    .use(remarkMermaidCode)
    .use(remarkSingleAccordionItems)
    .use(remarkSidebarComponents)

  // Remark's parse() and runSync() throw VFileMessage on syntax errors.
  // Convert at the boundary to a returned error value.
  const parseResult = trySync(() => processor.parse(content), content, source)
  if (parseResult instanceof Error) return parseResult

  const runResult = trySync(() => processor.runSync(parseResult) as Root, content, source)
  if (runResult instanceof Error) return runResult

  const mdast = runResult

  // Serialize BEFORE unravel — mdxToMarkdown corrupts phrasing children
  // of flow elements by inserting blank lines between them, which creates
  // spurious paragraphs on re-parse. Keeping text elements inline in the
  // serialized output preserves the original paragraph structure.
  const serialized = toMarkdown(mdast, {
    extensions: [
      gfmToMarkdown(),
      mdxToMarkdown(),
      frontmatterToMarkdown(['yaml']),
    ],
  })

  // Apply unravel AFTER serialization — promotes lone text elements in
  // paragraphs to flow elements so the mdast tree has the correct block
  // structure for heading extraction, section splitting, etc.
  remarkMarkAndUnravel()(mdast)

  return { content: serialized, mdast }
}

/** Sync boundary: catch thrown errors from remark and convert to HolocronMdxParseError. */
function trySync<T>(fn: () => T, mdxSource: string, source?: string): HolocronMdxParseError | T {
  try {
    return fn()
  } catch (err) {
    if (err instanceof HolocronMdxParseError) return err
    const { line, column, reason } = extractParseErrorInfo(err)
    return new HolocronMdxParseError({ reason, line, column, source, mdxSource })
  }
}
