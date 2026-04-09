import { describe, expect, test } from 'vitest'

import { remarkHeadings } from './remark-headings.ts'
import { runRemarkPlugin } from './remark-test-utils.ts'

describe('remarkHeadings', () => {
  test('parses custom heading ids into idString nodes before transform', () => {
    const result = runRemarkPlugin('## My heading {#custom-id}', remarkHeadings)
    const root = result.parsed as {
      children: Array<{ type: string; depth?: number; children?: Array<{ type: string; value?: string }> }>
    }

    expect({
      type: root.children[0]?.type,
      depth: root.children[0]?.depth,
      children: root.children[0]?.children?.map((child) => ({
        type: child.type,
        value: child.value,
      })),
    }).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "type": "text",
            "value": "My heading ",
          },
          {
            "type": "idString",
            "value": "custom-id",
          },
        ],
        "depth": 2,
        "type": "heading",
      }
    `)
  })

  test('rewrites markdown headings to Heading components', () => {
    const result = runRemarkPlugin('## My heading {#custom-id}', remarkHeadings)

    expect(result.markdown).toMatchInlineSnapshot(`
      "<Heading level={2} id=\"custom-id\">
        My heading
      </Heading>
      "
    `)
  })

  test('rewrites native JSX headings to Heading components', () => {
    const result = runRemarkPlugin('<h3 noAnchor>My heading</h3>', remarkHeadings)

    expect(result.markdown).toMatchInlineSnapshot(`
      "<Heading level={3} id=\"my-heading\" noAnchor>
        My heading
      </Heading>
      "
    `)
  })
})
