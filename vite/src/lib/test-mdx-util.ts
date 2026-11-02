import { stringify, type Root } from 'mdastic'
import { MDX_SYNTAX } from './normalize-mdx.ts'
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
      out += stringify(contentRoot, { syntax: MDX_SYNTAX })
    }
    
    if (s.asideNodes.length > 0) {
      out += `\n[ASIDE]\n`
      const asideRoot: Root = { type: 'root', children: s.asideNodes }
      out += stringify(asideRoot, { syntax: MDX_SYNTAX })
    }

    if (s.sharedAsideNodes && s.sharedAsideNodes.length > 0) {
      out += `\n[SHARED ASIDE]\n`
      const sharedRoot: Root = { type: 'root', children: s.sharedAsideNodes }
      out += stringify(sharedRoot, { syntax: MDX_SYNTAX })
    }
  }
  return out.trim()
}
