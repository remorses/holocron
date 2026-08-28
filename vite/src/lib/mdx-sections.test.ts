import { describe, expect, test } from 'vitest'

import type { Root } from 'mdast'
import { mdxParse } from 'safe-mdx/parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMdx from 'remark-mdx'
import { remark } from 'remark'
import { buildSections } from './mdx-sections.ts'
import { remarkInlineImports, type InlineImportEntry } from './remark-inline-imports.ts'
import { formatSectionsToMdx } from './test-mdx-util.ts'

function parseAndBuild(mdx: string, options?: Parameters<typeof buildSections>[1]) {
  const root: Root = mdxParse(mdx)
  return buildSections(root, options)
}

function parseInlineAndBuild(pageMdx: string, imports: Map<string, InlineImportEntry>) {
  const processor = remark()
    .use(remarkMdx)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(remarkInlineImports, { resolvedImports: imports })
  const parsed = processor.parse(pageMdx)
  const transformed = processor.runSync(parsed) as Root
  return buildSections(transformed)
}

describe('buildSections', () => {
  test('does not inject page chrome when the right aside is disabled', () => {
    const mdx = `Intro

## Section

Body
`
    expect(formatSectionsToMdx(parseAndBuild(mdx, { includePageChrome: false }))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [CONTENT]
      Intro

      --- SECTION 1 ---

      [CONTENT]
      ## Section

      Body"
    `)
  })

  test('splits on markdown headings', () => {
    const mdx = `Intro

## Section

Body
`
    expect(formatSectionsToMdx(parseAndBuild(mdx))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [CONTENT]
      Intro

      [ASIDE]
      <Aside>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>

      --- SECTION 1 ---

      [CONTENT]
      ## Section

      Body"
    `)
  })

  test('splits on Heading components', () => {
    const mdx = `Intro

<Heading level="2">Section</Heading>

Body
`
    expect(formatSectionsToMdx(parseAndBuild(mdx))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [CONTENT]
      Intro

      [ASIDE]
      <Aside>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>

      --- SECTION 1 ---

      [CONTENT]
      <Heading level="2">
        Section
      </Heading>

      Body"
    `)
  })

  test('splits on JSX native headings', () => {
    const mdx = `Intro

<h2>Section</h2>

Body
`
    expect(formatSectionsToMdx(parseAndBuild(mdx))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [CONTENT]
      Intro

      [ASIDE]
      <Aside>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>

      --- SECTION 1 ---

      [CONTENT]
      <h2>
        Section
      </h2>

      Body"
    `)
  })

  test('injects HolocronAIAssistantWidget as a regular first-section Aside', () => {
    const mdx = `Intro

## Section

Body
`
    expect(formatSectionsToMdx(parseAndBuild(mdx))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [CONTENT]
      Intro

      [ASIDE]
      <Aside>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>

      --- SECTION 1 ---

      [CONTENT]
      ## Section

      Body"
    `)
  })

  test('adds the AI widget beside an authored first-section Aside', () => {
    const mdx = `Intro

<Aside>
My aside
</Aside>

## Section

Body
`
    expect(formatSectionsToMdx(parseAndBuild(mdx))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [CONTENT]
      Intro

      [ASIDE]
      <Aside>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>

      <Aside>
        My aside
      </Aside>

      --- SECTION 1 ---

      [CONTENT]
      ## Section

      Body"
    `)
  })

  test('injects HolocronAIAssistantWidget and handles complex full aside', () => {
    const mdx = `Intro text.

<Aside full>
This is a full aside.
</Aside>

## Part 1

Part 1 content

## Part 2

Part 2 content

<Aside full>
Second full aside.
</Aside>

## Part 3

Part 3 content
`
    expect(formatSectionsToMdx(parseAndBuild(mdx))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [CONTENT]
      Intro text.

      --- SECTION 1 ---

      [CONTENT]
      ## Part 1

      Part 1 content

      --- SECTION 2 ---
      asideRowSpan: 2

      [CONTENT]
      ## Part 2

      Part 2 content

      [SHARED ASIDE]
      <Aside full>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />

        This is a full aside.
      </Aside>

      --- SECTION 3 ---
      asideRowSpan: 1

      [CONTENT]
      ## Part 3

      Part 3 content

      [SHARED ASIDE]
      <Aside full>
        Second full aside.
      </Aside>"
    `)
  })

  test('groups multiple Aside nodes into the same section sidebar', () => {
    const mdx = `Intro

<Aside>
Intro aside
</Aside>

## API Section

Body

<Aside>
Request body
</Aside>

<Aside>
Response body
</Aside>
`
    expect(formatSectionsToMdx(parseAndBuild(mdx))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [CONTENT]
      Intro

      [ASIDE]
      <Aside>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>

      <Aside>
        Intro aside
      </Aside>

      --- SECTION 1 ---

      [CONTENT]
      ## API Section

      Body

      [ASIDE]
      <Aside>
        Request body
      </Aside>

      <Aside>
        Response body
      </Aside>"
    `)
  })

  test('keeps additional Aside nodes inside a shared full Aside range', () => {
    const mdx = `Intro

<Aside>
Intro aside
</Aside>

<Aside full>
Shared aside
</Aside>

## API A

Body A

<Aside>
Request body
</Aside>

## API B

Body B

<Aside>
Response body
</Aside>
`
    expect(formatSectionsToMdx(parseAndBuild(mdx))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [CONTENT]
      Intro

      [ASIDE]
      <Aside>
        Intro aside
      </Aside>

      --- SECTION 1 ---

      [CONTENT]
      ## API A

      Body A

      --- SECTION 2 ---
      asideRowSpan: 2

      [CONTENT]
      ## API B

      Body B

      [SHARED ASIDE]
      <Aside full>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />

        Shared aside
      </Aside>

      <Aside>
        Request body
      </Aside>

      <Aside>
        Response body
      </Aside>"
    `)
  })

  test('page starting with a heading keeps per-section asides scoped (pricing page repro)', () => {
    // Heading-first page with an intro <Aside> + two per-section asides.
    // Each aside must stay in its own section, not collapse into one shared sidebar.
    const mdx = `# Pricing

Holocron is free to start.

<Aside>
<Info>
Subscriptions are per site.
</Info>
</Aside>

## Plans

Plans table.

## What Pro unlocks

### Preview deployments

Every branch gets a preview URL.

<Aside>
<Tip>
Preview deployments are automatic.
</Tip>
</Aside>

## Subscribe

Manage billing from the dashboard.

<Aside>
<Note>
Billing runs on Stripe.
</Note>
</Aside>
`
    expect(formatSectionsToMdx(parseAndBuild(mdx))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [CONTENT]
      # Pricing

      Holocron is free to start.

      [ASIDE]
      <Aside>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>

      <Aside>
        <Info>
          Subscriptions are per site.
        </Info>
      </Aside>

      --- SECTION 1 ---

      [CONTENT]
      ## Plans

      Plans table.

      --- SECTION 2 ---

      [CONTENT]
      ## What Pro unlocks

      --- SECTION 3 ---

      [CONTENT]
      ### Preview deployments

      Every branch gets a preview URL.

      [ASIDE]
      <Aside>
        <Tip>
          Preview deployments are automatic.
        </Tip>
      </Aside>

      --- SECTION 4 ---

      [CONTENT]
      ## Subscribe

      Manage billing from the dashboard.

      [ASIDE]
      <Aside>
        <Note>
          Billing runs on Stripe.
        </Note>
      </Aside>"
    `)
  })

  test('heading-first page with NO intro aside keeps per-section asides in their own sections', () => {
    // First section has no authored aside, later sections do. The AI widget
    // is a regular first-section aside, so later asides stay on their own rows.
    const mdx = `# Pricing

Holocron is free to start.

## Plans

<Aside>
<Info>
Subscriptions are per site.
</Info>
</Aside>

Plans table.

## What Pro unlocks

### Preview deployments

Every branch gets a preview URL.

<Aside>
<Tip>
Preview deployments are automatic.
</Tip>
</Aside>

## Subscribe

Manage billing from the dashboard.

<Aside>
<Note>
Billing runs on Stripe.
</Note>
</Aside>
`
    expect(formatSectionsToMdx(parseAndBuild(mdx))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [CONTENT]
      # Pricing

      Holocron is free to start.

      [ASIDE]
      <Aside>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>

      --- SECTION 1 ---

      [CONTENT]
      ## Plans

      Plans table.

      [ASIDE]
      <Aside>
        <Info>
          Subscriptions are per site.
        </Info>
      </Aside>

      --- SECTION 2 ---

      [CONTENT]
      ## What Pro unlocks

      --- SECTION 3 ---

      [CONTENT]
      ### Preview deployments

      Every branch gets a preview URL.

      [ASIDE]
      <Aside>
        <Tip>
          Preview deployments are automatic.
        </Tip>
      </Aside>

      --- SECTION 4 ---

      [CONTENT]
      ## Subscribe

      Manage billing from the dashboard.

      [ASIDE]
      <Aside>
        <Note>
          Billing runs on Stripe.
        </Note>
      </Aside>"
    `)
  })

  test('heading-only first section keeps later asides with their own sections', () => {
    // h1 then h2 with no body between them. The AI stays with h1, and later
    // asides remain in the sections that contain them.
    const mdx = `# Quickstart

## Install

Install instructions.

## Authenticate

Auth instructions.

<Aside>
<Info>
Run \`egaki login --show\` to see providers.
</Info>
</Aside>

## Generate

Generate instructions.
`
    expect(formatSectionsToMdx(parseAndBuild(mdx))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [CONTENT]
      # Quickstart

      [ASIDE]
      <Aside>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>

      --- SECTION 1 ---

      [CONTENT]
      ## Install

      Install instructions.

      --- SECTION 2 ---

      [CONTENT]
      ## Authenticate

      Auth instructions.

      [ASIDE]
      <Aside>
        <Info>
          Run \`egaki login --show\` to see providers.
        </Info>
      </Aside>

      --- SECTION 3 ---

      [CONTENT]
      ## Generate

      Generate instructions."
    `)
  })

  test('heading-only first section keeps the AI widget in that section', () => {
    const mdx = `# Quickstart

## Install

Install instructions.

## Generate

Generate instructions.
`
    expect(formatSectionsToMdx(parseAndBuild(mdx))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [CONTENT]
      # Quickstart

      [ASIDE]
      <Aside>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>

      --- SECTION 1 ---

      [CONTENT]
      ## Install

      Install instructions.

      --- SECTION 2 ---

      [CONTENT]
      ## Generate

      Generate instructions."
    `)
  })

  test('intro content + sub-headings keeps the AI widget with the intro', () => {
    // Regression test: pages like debugging-workflows.mdx that have intro
    // content (blockquote + paragraph) followed by ### sub-headings but no
    // authored <Aside>. The regular synthetic aside must stay with the intro
    // so the AI widget starts at the top of the sidebar, not section 1.
    const mdx = `> Reproduce failures and fix broken automations.

There are two common debugging scenarios.

### Remote debugging

When a workflow fails remotely, connect directly.

### Local debugging

Reproduce from error logs locally.
`
    expect(formatSectionsToMdx(parseAndBuild(mdx))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [CONTENT]
      > Reproduce failures and fix broken automations.

      There are two common debugging scenarios.

      [ASIDE]
      <Aside>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>

      --- SECTION 1 ---

      [CONTENT]
      ### Remote debugging

      When a workflow fails remotely, connect directly.

      --- SECTION 2 ---

      [CONTENT]
      ### Local debugging

      Reproduce from error logs locally."
    `)
  })

  test('intro with no first-section aside keeps later asides next to their headings', () => {
    // Traforo homepage shape: intro paragraphs, then ## sections each with
    // their own <Aside>. Ask AI stays with the intro; later asides stay on
    // their own section rows instead of merging into it.
    const mdx = `HTTP tunnel via Cloudflare Durable Objects.

## Usage

Expose a local server.

<Aside>
<Tip>
When you pass a command after \`--\`, traforo auto-detects the port.
</Tip>
</Aside>

## Auto Port Detection

Detects the local port from process output.

<Aside>
<Note>
If you also pass \`-p\`, traforo uses that explicit port.
</Note>
</Aside>

## Edge Caching

Responses can be cached at the Cloudflare edge.

<Aside>
<Info>
The \`X-Traforo-Cache\` response header shows HIT, MISS, or BYPASS.
</Info>
</Aside>
`
    expect(formatSectionsToMdx(parseAndBuild(mdx))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [CONTENT]
      HTTP tunnel via Cloudflare Durable Objects.

      [ASIDE]
      <Aside>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>

      --- SECTION 1 ---

      [CONTENT]
      ## Usage

      Expose a local server.

      [ASIDE]
      <Aside>
        <Tip>
          When you pass a command after \`--\`, traforo auto-detects the port.
        </Tip>
      </Aside>

      --- SECTION 2 ---

      [CONTENT]
      ## Auto Port Detection

      Detects the local port from process output.

      [ASIDE]
      <Aside>
        <Note>
          If you also pass \`-p\`, traforo uses that explicit port.
        </Note>
      </Aside>

      --- SECTION 3 ---

      [CONTENT]
      ## Edge Caching

      Responses can be cached at the Cloudflare edge.

      [ASIDE]
      <Aside>
        <Info>
          The \`X-Traforo-Cache\` response header shows HIT, MISS, or BYPASS.
        </Info>
      </Aside>"
    `)
  })

  test('asides inside an imported markdown file stay with their own sections', () => {
    // index.mdx that only renders <Readme />. After inlining, headings from
    // the imported file must still own the asides that sit under them.
    const imports = new Map<string, InlineImportEntry>([
      ['../../README.md', {
        content: `HTTP tunnel via Cloudflare Durable Objects.

## Usage

Expose a local server.

<Aside>
<Tip>
When you pass a command after \`--\`, traforo auto-detects the port.
</Tip>
</Aside>

## Auto Port Detection

Detects the local port from process output.

<Aside>
<Note>
If you also pass \`-p\`, traforo uses that explicit port.
</Note>
</Aside>

## Edge Caching

Responses can be cached at the Cloudflare edge.

<Aside>
<Info>
The \`X-Traforo-Cache\` response header shows HIT, MISS, or BYPASS.
</Info>
</Aside>
`,
        absPath: '/project/README.md',
        relativeDir: '../../',
      }],
    ])

    const pageMdx = `---
title: Traforo
---

import Readme from '../../README.md'

<Readme />
`
    expect(formatSectionsToMdx(parseInlineAndBuild(pageMdx, imports))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [CONTENT]
      HTTP tunnel via Cloudflare Durable Objects.

      [ASIDE]
      <Aside>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>

      --- SECTION 1 ---

      [CONTENT]
      ## Usage

      Expose a local server.

      [ASIDE]
      <Aside>
        <Tip>
          When you pass a command after \`--\`, traforo auto-detects the port.
        </Tip>
      </Aside>

      --- SECTION 2 ---

      [CONTENT]
      ## Auto Port Detection

      Detects the local port from process output.

      [ASIDE]
      <Aside>
        <Note>
          If you also pass \`-p\`, traforo uses that explicit port.
        </Note>
      </Aside>

      --- SECTION 3 ---

      [CONTENT]
      ## Edge Caching

      Responses can be cached at the Cloudflare edge.

      [ASIDE]
      <Aside>
        <Info>
          The \`X-Traforo-Cache\` response header shows HIT, MISS, or BYPASS.
        </Info>
      </Aside>"
    `)
  })

  test('a later authored full aside keeps its range separate from the AI aside', () => {
    const mdx = `Intro

## Part one

Body one.

<Aside full>
<Note>
Shared note.
</Note>
</Aside>

## Part two

Body two.

<Aside>
<Tip>
Collected tip.
</Tip>
</Aside>
`
    expect(formatSectionsToMdx(parseAndBuild(mdx))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [CONTENT]
      Intro

      [ASIDE]
      <Aside>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>

      --- SECTION 1 ---

      [CONTENT]
      ## Part one

      Body one.

      --- SECTION 2 ---
      asideRowSpan: 1

      [CONTENT]
      ## Part two

      Body two.

      [SHARED ASIDE]
      <Aside full>
        <Note>
          Shared note.
        </Note>
      </Aside>

      <Aside>
        <Tip>
          Collected tip.
        </Tip>
      </Aside>"
    `)
  })

  test('handles FullWidth nodes', () => {
    const mdx = `<FullWidth>
This should be full width.
</FullWidth>

## Following Section

Content
`
    expect(formatSectionsToMdx(parseAndBuild(mdx))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [ASIDE]
      <Aside>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>

      --- SECTION 1 ---
      fullWidth: true

      [CONTENT]
      This should be full width.

      --- SECTION 2 ---

      [CONTENT]
      ## Following Section

      Content"
    `)
  })

  test('AI widget behaves like a regular first-section aside', () => {
    const mdx = `Intro

## Usage

Body

<Aside>
<Tip>
Tip
</Tip>
</Aside>
`
    const sections = parseAndBuild(mdx)
    expect(formatSectionsToMdx(sections)).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [CONTENT]
      Intro

      [ASIDE]
      <Aside>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>

      --- SECTION 1 ---

      [CONTENT]
      ## Usage

      Body

      [ASIDE]
      <Aside>
        <Tip>
          Tip
        </Tip>
      </Aside>"
    `)
  })
})
