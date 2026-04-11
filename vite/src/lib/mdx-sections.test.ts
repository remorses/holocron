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
      </Aside>"
    `)
  })

  test('does not split on JSX native headings', () => {
    const mdx = `Intro

<h2>Section</h2>

Body
`
    expect(formatSectionsToMdx(parseAndBuild(mdx))).toMatchInlineSnapshot(`
      "--- SECTION 0 ---
      asideRowSpan: 1

      [CONTENT]
      Intro

      <h2>
        Section
      </h2>

      Body

      [ASIDE]
      <Aside full>
        <HolocronAIAssistantWidget />
      </Aside>"
    `)
  })

  test('injects HolocronAIAssistantWidget as <Aside full> if no aside exists in the first section', () => {
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
      </Aside>"
    `)
  })
})
