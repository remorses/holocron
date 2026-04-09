import { describe, expect, test } from 'vitest'

import type { Root } from 'mdast'

import { buildSections } from './mdx-sections.ts'

describe('buildSections', () => {
  test('splits on markdown headings', () => {
    const root: Root = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', value: 'Intro' }] },
        { type: 'heading', depth: 2, children: [{ type: 'text', value: 'Section' }] },
        { type: 'paragraph', children: [{ type: 'text', value: 'Body' }] },
      ],
    }

    expect(buildSections(root).map((section) => {
      return section.contentNodes.map((node) => {
        if (node.type === 'heading') {
          return { type: node.type, depth: node.depth }
        }
        return { type: node.type }
      })
    })).toMatchInlineSnapshot(`
      [
        [
          {
            "type": "paragraph",
          },
        ],
        [
          {
            "depth": 2,
            "type": "heading",
          },
          {
            "type": "paragraph",
          },
        ],
      ]
    `)
  })

  test('splits on Heading components', () => {
    const root: Root = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', value: 'Intro' }] },
        {
          type: 'mdxJsxFlowElement',
          name: 'Heading',
          attributes: [{ type: 'mdxJsxAttribute', name: 'level', value: '2' }],
          children: [{ type: 'text', value: 'Section' }],
        } as unknown as Root['children'][number],
        { type: 'paragraph', children: [{ type: 'text', value: 'Body' }] },
      ],
    }

    expect(buildSections(root).map((section) => {
      return section.contentNodes.map((node) => {
        return {
          type: node.type,
          ...(node.type === 'mdxJsxFlowElement' ? { name: node.name } : {}),
        }
      })
    })).toMatchInlineSnapshot(`
      [
        [
          {
            "type": "paragraph",
          },
        ],
        [
          {
            "name": "Heading",
            "type": "mdxJsxFlowElement",
          },
          {
            "type": "paragraph",
          },
        ],
      ]
    `)
  })

  test('does not split on JSX native headings', () => {
    const root: Root = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', value: 'Intro' }] },
        {
          type: 'mdxJsxFlowElement',
          name: 'h2',
          attributes: [],
          children: [{ type: 'text', value: 'Section' }],
        } as unknown as Root['children'][number],
        { type: 'paragraph', children: [{ type: 'text', value: 'Body' }] },
      ],
    }

    expect(buildSections(root).map((section) => {
      return section.contentNodes.map((node) => {
        return {
          type: node.type,
          ...(node.type === 'mdxJsxFlowElement' ? { name: node.name } : {}),
        }
      })
    })).toMatchInlineSnapshot(`
      [
        [
          {
            "type": "paragraph",
          },
          {
            "name": "h2",
            "type": "mdxJsxFlowElement",
          },
          {
            "type": "paragraph",
          },
        ],
      ]
    `)
  })

  test('injects HolocronAIAssistantWidget as <Aside full> if no aside exists in the first section', () => {
    const root: Root = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', value: 'Intro' }] },
        { type: 'heading', depth: 2, children: [{ type: 'text', value: 'Section' }] },
        { type: 'paragraph', children: [{ type: 'text', value: 'Body' }] },
      ],
    }

    const sections = buildSections(root)
    expect(sections.map((section) => ({
      asideNodes: section.asideNodes.map(node => ({
        type: node.type,
        ...(node.type === 'mdxJsxFlowElement' ? { 
          name: (node as any).name,
          children: (node as any).children?.map((c: any) => c.name) 
        } : {}),
      })),
      asideRowSpan: section.asideRowSpan
    }))).toMatchInlineSnapshot(`
      [
        {
          "asideNodes": [],
          "asideRowSpan": undefined,
        },
        {
          "asideNodes": [
            {
              "children": [
                "HolocronAIAssistantWidget",
              ],
              "name": "Aside",
              "type": "mdxJsxFlowElement",
            },
          ],
          "asideRowSpan": 2,
        },
      ]
    `)
  })

  test('injects HolocronAIAssistantWidget into existing Aside in the first section', () => {
    const root: Root = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', value: 'Intro' }] },
        {
          type: 'mdxJsxFlowElement',
          name: 'Aside',
          attributes: [],
          children: [{ type: 'paragraph', children: [{ type: 'text', value: 'My aside' }] }],
        } as unknown as Root['children'][number],
        { type: 'heading', depth: 2, children: [{ type: 'text', value: 'Section' }] },
        { type: 'paragraph', children: [{ type: 'text', value: 'Body' }] },
      ],
    }

    const sections = buildSections(root)
    expect(sections.map((section) => ({
      asideNodes: section.asideNodes.map(node => ({
        type: node.type,
        ...(node.type === 'mdxJsxFlowElement' ? { 
          name: (node as any).name,
          children: (node as any).children?.map((c: any) => c.name || c.type) 
        } : {}),
      })),
      asideRowSpan: section.asideRowSpan
    }))).toMatchInlineSnapshot(`
      [
        {
          "asideNodes": [
            {
              "children": [
                "HolocronAIAssistantWidget",
                "paragraph",
              ],
              "name": "Aside",
              "type": "mdxJsxFlowElement",
            },
          ],
          "asideRowSpan": undefined,
        },
        {
          "asideNodes": [],
          "asideRowSpan": undefined,
        },
      ]
    `)
  })
})
