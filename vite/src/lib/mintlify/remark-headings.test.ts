import { describe, expect, test } from 'vitest'

import { remarkHeadings } from './remark-headings.ts'
import { runRemarkPlugin } from './remark-test-utils.ts'

describe('remarkHeadings', () => {
  test('parses custom heading ids into idString nodes before transform', () => {
    const result = runRemarkPlugin('## My heading {#custom-id}', remarkHeadings)
    const firstChild = result.parsed.children[0]

    expect({
      type: firstChild?.type,
      depth: firstChild?.type === 'heading' ? firstChild.depth : undefined,
      children: firstChild?.type === 'heading'
        ? firstChild.children.map((child) => ({
          type: child.type,
          value: Reflect.get(child, 'value'),
        }))
        : undefined,
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

  test('preserves native JSX headings and injects ids when missing', () => {
    const result = runRemarkPlugin('<h3 noAnchor className="hero">My heading</h3>', remarkHeadings)

    expect(result.markdown).toMatchInlineSnapshot(`
      "<h3 noAnchor className=\"hero\" id=\"my-heading\">My heading</h3>
      "
    `)
  })
})
