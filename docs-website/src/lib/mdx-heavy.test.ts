import { describe, test, expect } from 'vitest'
import { getTocFromMdast } from './mdx-heavy'
import { remark } from 'remark'
import remarkMdx from 'remark-mdx'

describe('getTocFromMdast', () => {
  test('should extract TOC from markdown with headings', () => {
    const markdown = `
# Main Title

## Section 1

Some content here.

### Subsection 1.1

More content.

## Section 2

Final content.
`

    const ast = remark().use(remarkMdx).parse(markdown)
    const toc = getTocFromMdast(ast)

    expect(toc).toMatchInlineSnapshot(`
      [
        {
          "depth": 1,
          "title": "Main Title",
          "url": "#main-title",
        },
        {
          "depth": 2,
          "title": "Section 1",
          "url": "#section-1",
        },
        {
          "depth": 3,
          "title": "Subsection 1.1",
          "url": "#subsection-11",
        },
        {
          "depth": 2,
          "title": "Section 2",
          "url": "#section-2",
        },
      ]
    `)
  })

  test('should handle empty markdown', () => {
    const markdown = ''

    const ast = remark().use(remarkMdx).parse(markdown)
    const toc = getTocFromMdast(ast)

    expect(toc).toMatchInlineSnapshot(`[]`)
  })

  test('should handle markdown with no headings', () => {
    const markdown = `
This is just regular text without any headings.

Some more text here.
`

    const ast = remark().use(remarkMdx).parse(markdown)
    const toc = getTocFromMdast(ast)

    expect(toc).toMatchInlineSnapshot(`[]`)
  })

  test('should handle markdown with nested headings', () => {
    const markdown = `
# Title

## Section A

### Subsection A.1

#### Deep subsection A.1.1

### Subsection A.2

## Section B

### Subsection B.1
`

    const ast = remark().use(remarkMdx).parse(markdown)
    const toc = getTocFromMdast(ast)

    expect(toc).toMatchInlineSnapshot(`
      [
        {
          "depth": 1,
          "title": "Title",
          "url": "#title",
        },
        {
          "depth": 2,
          "title": "Section A",
          "url": "#section-a",
        },
        {
          "depth": 3,
          "title": "Subsection A.1",
          "url": "#subsection-a1",
        },
        {
          "depth": 4,
          "title": "Deep subsection A.1.1",
          "url": "#deep-subsection-a11",
        },
        {
          "depth": 3,
          "title": "Subsection A.2",
          "url": "#subsection-a2",
        },
        {
          "depth": 2,
          "title": "Section B",
          "url": "#section-b",
        },
        {
          "depth": 3,
          "title": "Subsection B.1",
          "url": "#subsection-b1",
        },
      ]
    `)
  })

  test('should handle markdown with special characters in headings', () => {
    const markdown = `
# Title with **bold** and *italic*

## Section with \`code\`

### Section with [link](https://example.com)
`

    const ast = remark().use(remarkMdx).parse(markdown)
    const toc = getTocFromMdast(ast)

    expect(toc).toMatchInlineSnapshot(`
      [
        {
          "depth": 1,
          "title": "Title with bold and italic",
          "url": "#title-with-bold-and-italic",
        },
        {
          "depth": 2,
          "title": "Section with code",
          "url": "#section-with-code",
        },
        {
          "depth": 3,
          "title": "Section with link",
          "url": "#section-with-link",
        },
      ]
    `)
  })
})
