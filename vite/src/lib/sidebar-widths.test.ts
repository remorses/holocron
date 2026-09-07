import { describe, expect, test } from 'vitest'

import {
  COMPONENT_SIDEBAR_WIDTHS,
  DEFAULT_SIDEBAR_WIDTH,
  buildGridTokenStyle,
  computeSidebarWidthFromAsideNodes,
} from './sidebar-widths.ts'
import { visit } from 'unist-util-visit'
import { buildSections } from './mdx-sections.ts'
import { normalizeMdx } from './normalize-mdx.ts'

// Mirrors the real pipeline in app-factory.tsx: mdx is normalized (which
// wraps RequestExample / ResponseExample in <Aside>), then parsed, then
// split into sections. Feed the resulting aside nodes into the width
// computer so tests exercise exactly the same path as production.
function asideNodesFromMdx(mdx: string) {
  const result = normalizeMdx(mdx)
  expect(result).not.toBeInstanceOf(Error)
  if (result instanceof Error) throw result
  const { mdast } = result
  const sections = buildSections(mdast)
  return sections.flatMap((s) => [
    ...s.asideNodes,
    ...(s.sharedAsideNodes ?? []),
  ])
}

function computeFromMdx(mdx: string): number {
  return computeSidebarWidthFromAsideNodes(asideNodesFromMdx(mdx), visit)
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
    expect(computeFromMdx(mdx)).toMatchInlineSnapshot(`460`)
  })

  test('ResponseExample also bumps width', () => {
    const mdx = `# Endpoint

<ResponseExample>
\`\`\`json
{ "ok": true }
\`\`\`
</ResponseExample>
`
    expect(computeFromMdx(mdx)).toMatchInlineSnapshot(`460`)
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
    expect(computeFromMdx(mdx)).toMatchInlineSnapshot(`460`)
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
    expect(computeFromMdx(mdx)).toMatchInlineSnapshot(`460`)
  })

  test('exports a static widths map for the sidebar components', () => {
    expect(COMPONENT_SIDEBAR_WIDTHS).toMatchInlineSnapshot(`
      {
        "RequestExample": 460,
        "ResponseExample": 460,
      }
    `)
  })
})

describe('Aside width', () => {
  test('Aside width="480px" is accepted and percent values are ignored', () => {
    expect(computeFromMdx(`# Title

<Aside width="480px">
Some helper text
</Aside>
`)).toMatchInlineSnapshot(`480`)
    expect(computeFromMdx(`# Title

<Aside width="50%">
Some helper text
</Aside>
`)).toMatchInlineSnapshot(`230`)
    expect(computeFromMdx(`# Title

<Aside width="480oops">
Some helper text
</Aside>
`)).toMatchInlineSnapshot(`230`)
  })

  test('Aside width={600} sets an explicit sidebar width', () => {
    const mdx = `# Title

<Aside width={600}>
Some helper text
</Aside>
`
    expect(computeFromMdx(mdx)).toMatchInlineSnapshot(`600`)
  })

  test('Aside width={480} with RequestExample keeps the larger 480px width', () => {
    const mdx = `# Endpoint

<Aside width={480}>
<RequestExample>
\`\`\`bash
curl https://api.example.com
\`\`\`
</RequestExample>
</Aside>
`
    expect(computeFromMdx(mdx)).toMatchInlineSnapshot(`480`)
  })
})

describe('buildGridTokenStyle', () => {
  test('default sidebar stays a fixed pixel track', () => {
    expect(buildGridTokenStyle({ sidebarWidth: DEFAULT_SIDEBAR_WIDTH })).toMatchInlineSnapshot(`
      {
        "--grid-content-width": "minmax(0, min(720px, calc(var(--grid-max-width) - var(--grid-nav-width) - var(--grid-sidebar-width) - 2 * var(--grid-gap))))",
        "--grid-gap": "60px",
        "--grid-max-width": "min(calc(100vw - 60px), 1200px)",
        "--grid-nav-width": "230px",
        "--grid-sidebar-width": "230px",
      }
    `)
  })

  test('compact mode still emits the sidebar width token', () => {
    expect(buildGridTokenStyle({
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
      compact: true,
    })['--grid-sidebar-width']).toMatchInlineSnapshot(`"230px"`)
  })
})
