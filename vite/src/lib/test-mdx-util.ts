import { gfmToMarkdown } from 'mdast-util-gfm'
import { toMarkdown } from 'mdast-util-to-markdown'
import { mdxToMarkdown } from 'mdast-util-mdx'
import { frontmatterToMarkdown } from 'mdast-util-frontmatter'
import type { MdastSection } from './mdx-sections.ts'

export function formatSectionsToMdx(sections: MdastSection[]): string {
  let out = ''
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]
    out += `\n--- SECTION ${i} ---\n`
    if (s.asideRowSpan !== undefined) {
      out += `asideRowSpan: ${s.asideRowSpan}\n`
    }
    if (s.fullWidth) {
      out += `fullWidth: true\n`
    }
    
    if (s.contentNodes.length > 0) {
      out += `\n[CONTENT]\n`
      out += toMarkdown({ type: 'root', children: s.contentNodes } as any, {
        extensions: [
          gfmToMarkdown(),
          mdxToMarkdown(),
          frontmatterToMarkdown(['yaml']),
        ],
      })
    }
    
    if (s.asideNodes.length > 0) {
      out += `\n[ASIDE]\n`
      out += toMarkdown({ type: 'root', children: s.asideNodes } as any, {
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
