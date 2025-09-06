import { test } from 'vitest'
import dedent from 'dedent'
import { describe, expect } from 'vitest'
import { remark } from 'remark'
import { visit } from 'unist-util-visit'
import { Root } from 'mdast'
import { processMdxInServer } from './mdx.server'

describe('GitHub Blockquotes Plugin', () => {
  test('transforms GitHub-style blockquotes correctly', async () => {
    // Example markdown with GitHub-style blockquotes
    const markdown = dedent`
        # hello

        > [!NOTE]
        > Useful information that users should know, even when skimming content.

        `

    const result = await processMdxInServer({
      markdown,
      githubPath: '',
      extension: 'mdx',
    })
    const data = result.data as { ast: Root }

    // Check the full output
    expect(result).toMatchInlineSnapshot(`
          {
            "data": {
              "ast": {
                "children": [
                  {
                    "attributes": [
                      {
                        "name": "type",
                        "type": "mdxJsxAttribute",
                        "value": "note",
                      },
                    ],
                    "children": [
                      {
                        "children": [
                          {
                            "type": "text",
                            "value": "Useful information that users should know, even when skimming content.",
                          },
                        ],
                        "position": {
                          "end": {
                            "column": 73,
                            "line": 4,
                            "offset": 91,
                          },
                          "start": {
                            "column": 3,
                            "line": 3,
                            "offset": 11,
                          },
                        },
                        "type": "paragraph",
                      },
                    ],
                    "data": undefined,
                    "name": "Callout",
                    "position": {
                      "end": {
                        "column": 73,
                        "line": 4,
                        "offset": 91,
                      },
                      "start": {
                        "column": 1,
                        "line": 3,
                        "offset": 9,
                      },
                    },
                    "type": "mdxJsxFlowElement",
                  },
                ],
                "position": {
                  "end": {
                    "column": 73,
                    "line": 4,
                    "offset": 91,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "type": "root",
              },
              "markdown": "# hello

          > [!NOTE]
          > Useful information that users should know, even when skimming content.",
              "structuredData": {
                "contents": [
                  {
                    "content": "type: note",
                    "heading": "hello",
                  },
                  {
                    "content": "Useful information that users should know, even when skimming content.",
                    "heading": "hello",
                  },
                ],
                "headings": [
                  {
                    "content": "hello",
                    "id": "hello",
                  },
                ],
              },
              "title": "hello",
              "toc": [
                {
                  "depth": 1,
                  "title": "hello",
                  "url": "#hello",
                },
              ],
            },
          }
        `)
  })
})
