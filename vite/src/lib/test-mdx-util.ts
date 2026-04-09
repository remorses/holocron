import { gfmToMarkdown } from 'mdast-util-gfm'
import { toMarkdown } from 'mdast-util-to-markdown'
import { mdxToMarkdown } from 'mdast-util-mdx'
import { frontmatterToMarkdown } from 'mdast-util-frontmatter'
import type { Root } from 'mdast'
import type { MdastSection } from './mdx-sections.ts'

export function formatSectionsToMdx(sections: MdastSection[]): string {
  let out = ''
  for (const [i, s] of sections.entries()) {
    out += `\n--- SECTION ${i} ---\n`
    if (s.asideRowSpan !== undefined) {
      out += `asideRowSpan: ${s.asideRowSpan}\n`
    }
    if (s.fullWidth) {
      out += `fullWidth: true\n`
    }
    
    if (s.contentNodes.length > 0) {
      out += `\n[CONTENT]\n`
      const contentRoot: Root = { type: 'root', children: s.contentNodes }
      out += toMarkdown(contentRoot, {
        extensions: [
          gfmToMarkdown(),
          mdxToMarkdown(),
          frontmatterToMarkdown(['yaml']),
        ],
      })
    }
    
    if (s.asideNodes.length > 0) {
      out += `\n[ASIDE]\n`
      const asideRoot: Root = { type: 'root', children: s.asideNodes }
      out += toMarkdown(asideRoot, {
        extensions: [
          gfmToMarkdown(),
          mdxToMarkdown(),
          frontmatterToMarkdown(['yaml']),
        ],
      })
    }
  }
  return out.trim()
}
