import { describe, expect, test } from 'vitest'
import { mdxParse } from 'safe-mdx/parse'
import type { Root } from 'mdast'

import {
  COMPONENT_SIDEBAR_WIDTHS,
  DEFAULT_SIDEBAR_WIDTH,
  computeSidebarWidthFromAsideNodes,
} from './sidebar-widths.ts'
import { visit } from 'unist-util-visit'
import { buildSections } from './mdx-sections.ts'
import { normalizeMdx } from './mintlify/normalize-mdx.ts'

// Mirrors the real pipeline in app-factory.tsx: mdx is normalized (which
// wraps RequestExample / ResponseExample in <Aside>), then parsed, then
// split into sections. Feed the resulting aside nodes into the width
// computer so tests exercise exactly the same path as production.
function computeFromMdx(mdx: string): number {
  const normalized = normalizeMdx(mdx)
  const root: Root = mdxParse(normalized)
  const sections = buildSections(root)
  const asideNodes = sections.flatMap((s) => s.asideNodes)
  return computeSidebarWidthFromAsideNodes(asideNodes, visit)
}

describe('computeSidebarWidthFromAsideNodes', () => {
  test('defaults to DEFAULT_SIDEBAR_WIDTH when no asides exist', () => {
    expect(computeFromMdx('# Hello\n\nJust some body text.')).toBe(
      DEFAULT_SIDEBAR_WIDTH,
    )
  })

  test('plain Aside with only text stays at default width', () => {
    const mdx = `# Title

<Aside>Some helper text</Aside>
`
    expect(computeFromMdx(mdx)).toBe(DEFAULT_SIDEBAR_WIDTH)
  })

  test('Aside containing RequestExample bumps width to 440', () => {
    const mdx = `# Endpoint

<RequestExample>
\`\`\`bash
curl https://api.example.com
\`\`\`
</RequestExample>
`
    expect(computeFromMdx(mdx)).toBe(440)
  })

  test('ResponseExample also bumps width to 440', () => {
    const mdx = `# Endpoint

<ResponseExample>
\`\`\`json
{ "ok": true }
\`\`\`
</ResponseExample>
`
    expect(computeFromMdx(mdx)).toBe(440)
  })

  test('unknown component in aside keeps default width', () => {
    const mdx = `# Title

<Aside>
  <SomeCustomThing />
</Aside>
`
    expect(computeFromMdx(mdx)).toBe(DEFAULT_SIDEBAR_WIDTH)
  })

  test('multiple asides take the max', () => {
    const mdx = `# A

<Aside>plain</Aside>

## B

<RequestExample>
\`\`\`bash
curl
\`\`\`
</RequestExample>
`
    expect(computeFromMdx(mdx)).toBe(440)
  })

  test('deeply nested RequestExample is still detected', () => {
    const mdx = `# Title

<Aside full>
  <div>
    <RequestExample>
    \`\`\`bash
    curl
    \`\`\`
    </RequestExample>
  </div>
</Aside>
`
    expect(computeFromMdx(mdx)).toBe(440)
  })

  test('exports a static widths map for the sidebar components', () => {
    expect(COMPONENT_SIDEBAR_WIDTHS).toMatchInlineSnapshot(`
      {
        "RequestExample": 440,
        "ResponseExample": 440,
      }
    `)
  })
})
