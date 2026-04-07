import { describe, expect, test } from 'vitest'
import { remarkHeadingIds } from './remark-heading-ids.ts'
import { runRemarkPlugin } from './remark-test-utils.ts'

describe('remarkHeadingIds', () => {
  test('parses custom heading ids into idString nodes before transform', () => {
    const result = runRemarkPlugin('## My heading {#custom-id}', remarkHeadingIds)
    const root = result.parsed as any

    expect({
      type: root.children[0].type,
      depth: root.children[0].depth,
      children: root.children[0].children.map((child: any) => ({
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

  test('stores ids on heading data and rewrites to explicit JSX headings', () => {
    const result = runRemarkPlugin('## My heading {#custom-id}', remarkHeadingIds)

    expect(result.markdown).toMatchInlineSnapshot(`
      "<h2 id=\"custom-id\">
        My heading
      </h2>
      "
    `)
  })
})
