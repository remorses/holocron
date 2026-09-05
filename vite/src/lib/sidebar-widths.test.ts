import { describe, expect, test } from 'vitest'

import {
  COMPONENT_SIDEBAR_WIDTHS,
  DEFAULT_SIDEBAR_WIDTH,
  buildGridTokenStyle,
  computeSidebarLayoutFromAsideNodes,
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

function computeLayoutFromMdx(mdx: string) {
  return computeSidebarLayoutFromAsideNodes(asideNodesFromMdx(mdx), visit)
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

describe('computeSidebarLayoutFromAsideNodes', () => {
  test('plain Aside stays at the default width and does not fill leftover space', () => {
    const mdx = `# Title

<Aside>Some helper text</Aside>
`
    expect(computeLayoutFromMdx(mdx)).toMatchInlineSnapshot(`
      {
        "fillRemaining": false,
        "sidebarWidth": 230,
      }
    `)
  })

  test('Aside wide fills leftover right-column space', () => {
    const mdx = `# Title

<Aside wide>
Some helper text
</Aside>
`
    expect(computeLayoutFromMdx(mdx)).toMatchInlineSnapshot(`
      {
        "fillRemaining": true,
        "sidebarWidth": 230,
      }
    `)
  })

  test('Aside width="480px" is accepted and percent values are ignored', () => {
    expect(computeLayoutFromMdx(`# Title

<Aside width="480px">
Some helper text
</Aside>
`)).toMatchInlineSnapshot(`
      {
        "fillRemaining": false,
        "sidebarWidth": 480,
      }
    `)
    expect(computeLayoutFromMdx(`# Title

<Aside width="50%">
Some helper text
</Aside>
`)).toMatchInlineSnapshot(`
      {
        "fillRemaining": false,
        "sidebarWidth": 230,
      }
    `)
    expect(computeLayoutFromMdx(`# Title

<Aside width="480oops">
Some helper text
</Aside>
`)).toMatchInlineSnapshot(`
      {
        "fillRemaining": false,
        "sidebarWidth": 230,
      }
    `)
  })

  test('Aside width={600} sets an explicit sidebar width', () => {
    const mdx = `# Title

<Aside width={600}>
Some helper text
</Aside>
`
    expect(computeLayoutFromMdx(mdx)).toMatchInlineSnapshot(`
      {
        "fillRemaining": false,
        "sidebarWidth": 600,
      }
    `)
  })

  test('Aside wide width={480} fills leftover space with a 480px minimum', () => {
    const mdx = `# Title

<Aside wide width={480}>
Some helper text
</Aside>
`
    expect(computeLayoutFromMdx(mdx)).toMatchInlineSnapshot(`
      {
        "fillRemaining": true,
        "sidebarWidth": 480,
      }
    `)
  })

  test('Aside wide with RequestExample keeps the 460px minimum', () => {
    const mdx = `# Endpoint

<Aside wide>
<RequestExample>
\`\`\`bash
curl https://api.example.com
\`\`\`
</RequestExample>
</Aside>
`
    expect(computeLayoutFromMdx(mdx)).toMatchInlineSnapshot(`
      {
        "fillRemaining": true,
        "sidebarWidth": 460,
      }
    `)
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

  test('wide aside fills leftover space after the 720px content cap', () => {
    expect(buildGridTokenStyle({
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
      fillRemaining: true,
    })).toMatchInlineSnapshot(`
      {
        "--grid-content-width": "minmax(0, min(720px, calc(var(--grid-max-width) - var(--grid-nav-width) - var(--grid-sidebar-width) - 2 * var(--grid-gap))))",
        "--grid-gap": "60px",
        "--grid-max-width": "calc(100vw - 60px)",
        "--grid-nav-width": "230px",
        "--grid-sidebar-width": "230px",
      }
    `)
  })

  test('compact mode ignores fillRemaining', () => {
    expect(buildGridTokenStyle({
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
      fillRemaining: true,
      compact: true,
    })['--grid-sidebar-width']).toMatchInlineSnapshot(`"230px"`)
  })
})
