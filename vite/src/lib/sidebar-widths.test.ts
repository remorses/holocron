import { describe, expect, test } from 'vitest'

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
  const result = normalizeMdx(mdx)
  expect(result).not.toBeInstanceOf(Error)
  if (result instanceof Error) throw result
  const { mdast } = result
  const sections = buildSections(mdast)
  const asideNodes = sections.flatMap((s) => s.asideNodes)
  return computeSidebarWidthFromAsideNodes(asideNodes, visit)
}

describe('computeSidebarWidthFromAsideNodes', () => {
  test('defaults to DEFAULT_SIDEBAR_WIDTH when no asides exist', () => {
    expect(computeFromMdx('# Hello\n\nJust some body text.')).toMatchInlineSnapshot(`230`)
  })

  test('plain Aside with only text stays at default width', () => {
    const mdx = `# Title

<Aside>Some helper text</Aside>
`
    expect(computeFromMdx(mdx)).toMatchInlineSnapshot(`230`)
  })

  test('Aside containing RequestExample bumps width', () => {
    const mdx = `# Endpoint

<RequestExample>
\`\`\`bash
curl https://api.example.com
\`\`\`
</RequestExample>
`
    expect(computeFromMdx(mdx)).toMatchInlineSnapshot(`396`)
  })

  test('ResponseExample also bumps width', () => {
    const mdx = `# Endpoint

<ResponseExample>
\`\`\`json
{ "ok": true }
\`\`\`
</ResponseExample>
`
    expect(computeFromMdx(mdx)).toMatchInlineSnapshot(`396`)
  })

  test('unknown component in aside keeps default width', () => {
    const mdx = `# Title

<Aside>
  <SomeCustomThing />
</Aside>
`
    expect(computeFromMdx(mdx)).toMatchInlineSnapshot(`230`)
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
    expect(computeFromMdx(mdx)).toMatchInlineSnapshot(`396`)
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
    expect(computeFromMdx(mdx)).toMatchInlineSnapshot(`396`)
  })

  test('exports a static widths map for the sidebar components', () => {
    expect(COMPONENT_SIDEBAR_WIDTHS).toMatchInlineSnapshot(`
      {
        "RequestExample": 396,
        "ResponseExample": 396,
      }
    `)
  })
})
