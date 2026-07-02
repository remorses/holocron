import { describe, expect, test } from 'vitest'

import type { Root } from 'mdast'
import { mdxParse } from 'safe-mdx/parse'
import { buildSections } from './mdx-sections.ts'
import { formatSectionsToMdx } from './test-mdx-util.ts'

function parseAndBuild(mdx: string) {
  const root: Root = mdxParse(mdx)
  return buildSections(root)
}

describe('buildSections', () => {
  test('splits on markdown headings', () => {
    const mdx = `Intro

## Section

Body
`
    expect(formatSectionsToMdx(parseAndBuild(mdx))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [CONTENT]
      Intro

      --- SECTION 1 ---
      asideRowSpan: 2

      [CONTENT]
      ## Section

      Body

      [ASIDE]
      <Aside full>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>"
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

      --- SECTION 1 ---
      asideRowSpan: 2

      [CONTENT]
      <Heading level="2">
        Section
      </Heading>

      Body

      [ASIDE]
      <Aside full>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>"
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

      --- SECTION 1 ---
      asideRowSpan: 2

      [CONTENT]
      <h2>
        Section
      </h2>

      Body

      [ASIDE]
      <Aside full>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>"
    `)
  })

  test('injects HolocronAIAssistantWidget as full Aside when no aside exists anywhere', () => {
    const mdx = `Intro

## Section

Body
`
    expect(formatSectionsToMdx(parseAndBuild(mdx))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---

      [CONTENT]
      Intro

      --- SECTION 1 ---
      asideRowSpan: 2

      [CONTENT]
      ## Section

      Body

      [ASIDE]
      <Aside full>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>"
    `)
  })

  test('injects HolocronAIAssistantWidget into existing Aside in the first section', () => {
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

      [ASIDE]
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

      [ASIDE]
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
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />

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

      [ASIDE]
      <Aside full>
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
    // Each aside must stay in its own section, not collapse into one shared
    // <Aside full> pinned at the top.
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

  test('heading-first page with NO intro aside absorbs per-section asides into full aside', () => {
    // The synthetic AI aside is always <Aside full>, so per-section asides
    // within the range are absorbed into the shared aside.
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

      --- SECTION 1 ---

      [CONTENT]
      Holocron is free to start.

      --- SECTION 2 ---

      [CONTENT]
      ## Plans

      Plans table.

      --- SECTION 3 ---

      [CONTENT]
      ## What Pro unlocks

      --- SECTION 4 ---

      [CONTENT]
      ### Preview deployments

      Every branch gets a preview URL.

      --- SECTION 5 ---
      asideRowSpan: 5

      [CONTENT]
      ## Subscribe

      Manage billing from the dashboard.

      [ASIDE]
      <Aside full>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>

      <Aside>
        <Info>
          Subscriptions are per site.
        </Info>
      </Aside>

      <Aside>
        <Tip>
          Preview deployments are automatic.
        </Tip>
      </Aside>

      <Aside>
        <Note>
          Billing runs on Stripe.
        </Note>
      </Aside>"
    `)
  })

  test('heading-only first section uses full aside spanning all sections', () => {
    // When h1 is immediately followed by h2 (no body between them), the
    // synthetic AI aside is <Aside full> spanning the whole page.
    // Per-section asides are absorbed into the shared aside.
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

      --- SECTION 1 ---

      [CONTENT]
      ## Install

      Install instructions.

      --- SECTION 2 ---

      [CONTENT]
      ## Authenticate

      Auth instructions.

      --- SECTION 3 ---
      asideRowSpan: 3

      [CONTENT]
      ## Generate

      Generate instructions.

      [ASIDE]
      <Aside full>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>

      <Aside>
        <Info>
          Run \`egaki login --show\` to see providers.
        </Info>
      </Aside>"
    `)
  })

  test('heading-only first section with no asides anywhere spans all sections', () => {
    // When no per-section asides exist, the AI widget is <Aside full>.
    // The full-aside range starts after section 0 (heading-only), so the
    // aside spans sections 1-2 (the full-aside range). Section 0 is before
    // the range and stays empty — no row inflation.
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

      --- SECTION 1 ---

      [CONTENT]
      ## Install

      Install instructions.

      --- SECTION 2 ---
      asideRowSpan: 2

      [CONTENT]
      ## Generate

      Generate instructions.

      [ASIDE]
      <Aside full>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
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
      asideRowSpan: 1

      [CONTENT]
      ## Following Section

      Content

      [ASIDE]
      <Aside full>
        <HolocronAIAssistantWidget />

        <HolocronPageNavRow />
      </Aside>"
    `)
  })
})
