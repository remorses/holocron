import { describe, test, expect } from 'vitest'
import { getProcessor, ProcessorData } from './mdx-heavy'
import { groupBy } from './utils'

describe('structuredData', () => {
    test('structuredData processes MDX with various node types', async () => {
        const processor = getProcessor({
            extension: 'mdx',
            highlighter: undefined,
            onMissingLanguage: undefined,
        })

        // Test basic MDX with frontmatter, headings, and text
        const basicMdx = `---
title: "Test Document"
description: "A test document"
---

## Main Title

This is a paragraph with **bold** and *italic* text.

> quote

## Section Heading

Another paragraph here.

### Subsection

- List item 1
- List item 2
- List item 3

1. Numbered item 1
2. Numbered item 2

\`\`\`javascript
const hello = "world";
console.log(hello);
\`\`\`

### subsection 2

> This is a blockquote

inside subsection 2, this is a paragraph with a [Link text](https://example.com)

this is another paragraph in the same subsection 2

| Column 1 | Column 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |


<Cards>
  <Card title="Card 1" href="https://example.com/1">
    This is the first card.
  </Card>
  <Card title="Card 2" href="https://example.com/2">
    This is the second card, with a [link](https://example.com/2) inside.
  </Card>
  <Card title="Card 3">
    This card does not have an href, but does have some **bold** text.
  </Card>
</Cards>

<InlineTag>something</InlineTag>

`

        const result = await processor.process(basicMdx)
        const data: ProcessorData = result.data as any
        const grouped = Object.entries(
            groupBy(data?.structuredData.contents, (x) => x.heading || ''),
        )
            .map(([k, v]) => {
                return (
                    '## ' +
                    k +
                    '\n\n' +
                    v.flatMap((item) => [item.content]).join('\n---\n')
                )
            })
            .join('\n\n----------\n\n')
        expect(grouped).toMatchInlineSnapshot(`
          "## main-title

          This is a paragraph with bold and italic text.
          ---
          quote

          ----------

          ## section-heading

          Another paragraph here.

          ----------

          ## subsection

          List item 1List item 2List item 3
          ---
          Numbered item 1Numbered item 2
          ---
          const hello = "world";
          console.log(hello);

          ----------

          ## subsection-2

          This is a blockquote
          ---
          inside subsection 2, this is a paragraph with a Link text
          ---
          this is another paragraph in the same subsection 2
          ---
          Column 1Column 2Cell 1Cell 2Cell 3Cell 4
          ---
          href: https://example.com/1
          ---
          This is the first card.
          ---
          href: https://example.com/2
          ---
          This is the second card, with a link inside.
          ---
          This card does not have an href, but does have some bold text.
          ---
          something"
        `)
    })

    test('processes MDX with admonitions and code tabs', async () => {
        const processor = getProcessor({
            extension: 'mdx',
            highlighter: undefined,
            onMissingLanguage: undefined,
        })

        const admonitionMdx = `---
title: "Advanced Features"
---

# Advanced MDX Features

:::note
This is a note admonition.
:::

:::warning
This is a warning admonition.
:::

:::tip
This is a tip admonition with **formatted** text.
:::

<CodeTab>
<Tab value="js" label="JavaScript">
\`\`\`javascript
const example = "JavaScript code";
\`\`\`
</Tab>
<Tab value="ts" label="TypeScript">
\`\`\`typescript
const example: string = "TypeScript code";
\`\`\`
</Tab>
</CodeTab>

<Steps>
<Step>
First step in the process
</Step>
<Step>
Second step with code:
\`\`\`bash
npm install package
\`\`\`
</Step>
</Steps>
`

        const result = await processor.process(admonitionMdx)
        expect(result.data).toMatchInlineSnapshot(`
          {
            "ast": {
              "children": [
                {
                  "position": {
                    "end": {
                      "column": 4,
                      "line": 3,
                      "offset": 34,
                    },
                    "start": {
                      "column": 1,
                      "line": 1,
                      "offset": 0,
                    },
                  },
                  "type": "yaml",
                  "value": "title: "Advanced Features"",
                },
                {
                  "children": [
                    {
                      "position": {
                        "end": {
                          "column": 4,
                          "line": 9,
                          "offset": 99,
                        },
                        "start": {
                          "column": 1,
                          "line": 7,
                          "offset": 61,
                        },
                      },
                      "type": "text",
                      "value": ":::note
          This is a note admonition.
          :::",
                    },
                  ],
                  "position": {
                    "end": {
                      "column": 4,
                      "line": 9,
                      "offset": 99,
                    },
                    "start": {
                      "column": 1,
                      "line": 7,
                      "offset": 61,
                    },
                  },
                  "type": "paragraph",
                },
                {
                  "children": [
                    {
                      "position": {
                        "end": {
                          "column": 4,
                          "line": 13,
                          "offset": 145,
                        },
                        "start": {
                          "column": 1,
                          "line": 11,
                          "offset": 101,
                        },
                      },
                      "type": "text",
                      "value": ":::warning
          This is a warning admonition.
          :::",
                    },
                  ],
                  "position": {
                    "end": {
                      "column": 4,
                      "line": 13,
                      "offset": 145,
                    },
                    "start": {
                      "column": 1,
                      "line": 11,
                      "offset": 101,
                    },
                  },
                  "type": "paragraph",
                },
                {
                  "children": [
                    {
                      "position": {
                        "end": {
                          "column": 31,
                          "line": 16,
                          "offset": 184,
                        },
                        "start": {
                          "column": 1,
                          "line": 15,
                          "offset": 147,
                        },
                      },
                      "type": "text",
                      "value": ":::tip
          This is a tip admonition with ",
                    },
                    {
                      "children": [
                        {
                          "position": {
                            "end": {
                              "column": 42,
                              "line": 16,
                              "offset": 195,
                            },
                            "start": {
                              "column": 33,
                              "line": 16,
                              "offset": 186,
                            },
                          },
                          "type": "text",
                          "value": "formatted",
                        },
                      ],
                      "position": {
                        "end": {
                          "column": 44,
                          "line": 16,
                          "offset": 197,
                        },
                        "start": {
                          "column": 31,
                          "line": 16,
                          "offset": 184,
                        },
                      },
                      "type": "strong",
                    },
                    {
                      "position": {
                        "end": {
                          "column": 4,
                          "line": 17,
                          "offset": 207,
                        },
                        "start": {
                          "column": 44,
                          "line": 16,
                          "offset": 197,
                        },
                      },
                      "type": "text",
                      "value": " text.
          :::",
                    },
                  ],
                  "position": {
                    "end": {
                      "column": 4,
                      "line": 17,
                      "offset": 207,
                    },
                    "start": {
                      "column": 1,
                      "line": 15,
                      "offset": 147,
                    },
                  },
                  "type": "paragraph",
                },
                {
                  "attributes": [],
                  "children": [
                    {
                      "attributes": [
                        {
                          "name": "value",
                          "position": {
                            "end": {
                              "column": 16,
                              "line": 20,
                              "offset": 234,
                            },
                            "start": {
                              "column": 6,
                              "line": 20,
                              "offset": 224,
                            },
                          },
                          "type": "mdxJsxAttribute",
                          "value": "js",
                        },
                        {
                          "name": "label",
                          "position": {
                            "end": {
                              "column": 35,
                              "line": 20,
                              "offset": 253,
                            },
                            "start": {
                              "column": 17,
                              "line": 20,
                              "offset": 235,
                            },
                          },
                          "type": "mdxJsxAttribute",
                          "value": "JavaScript",
                        },
                      ],
                      "children": [
                        {
                          "data": {
                            "hProperties": {},
                            "html": "<pre class="shiki shiki-themes github-light github-dark" style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> example</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583"> =</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> "JavaScript code"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">;</span></span></code></pre>",
                          },
                          "lang": "javascript",
                          "meta": null,
                          "position": {
                            "end": {
                              "column": 4,
                              "line": 23,
                              "offset": 307,
                            },
                            "start": {
                              "column": 1,
                              "line": 21,
                              "offset": 255,
                            },
                          },
                          "type": "code",
                          "value": "const example = "JavaScript code";",
                        },
                      ],
                      "name": "Tab",
                      "position": {
                        "end": {
                          "column": 7,
                          "line": 24,
                          "offset": 314,
                        },
                        "start": {
                          "column": 1,
                          "line": 20,
                          "offset": 219,
                        },
                      },
                      "type": "mdxJsxFlowElement",
                    },
                    {
                      "attributes": [
                        {
                          "name": "value",
                          "position": {
                            "end": {
                              "column": 16,
                              "line": 25,
                              "offset": 330,
                            },
                            "start": {
                              "column": 6,
                              "line": 25,
                              "offset": 320,
                            },
                          },
                          "type": "mdxJsxAttribute",
                          "value": "ts",
                        },
                        {
                          "name": "label",
                          "position": {
                            "end": {
                              "column": 35,
                              "line": 25,
                              "offset": 349,
                            },
                            "start": {
                              "column": 17,
                              "line": 25,
                              "offset": 331,
                            },
                          },
                          "type": "mdxJsxAttribute",
                          "value": "TypeScript",
                        },
                      ],
                      "children": [
                        {
                          "data": {
                            "hProperties": {},
                            "html": "<pre class="shiki shiki-themes github-light github-dark" style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> example</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">:</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> string</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583"> =</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> "TypeScript code"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">;</span></span></code></pre>",
                          },
                          "lang": "typescript",
                          "meta": null,
                          "position": {
                            "end": {
                              "column": 4,
                              "line": 28,
                              "offset": 411,
                            },
                            "start": {
                              "column": 1,
                              "line": 26,
                              "offset": 351,
                            },
                          },
                          "type": "code",
                          "value": "const example: string = "TypeScript code";",
                        },
                      ],
                      "name": "Tab",
                      "position": {
                        "end": {
                          "column": 7,
                          "line": 29,
                          "offset": 418,
                        },
                        "start": {
                          "column": 1,
                          "line": 25,
                          "offset": 315,
                        },
                      },
                      "type": "mdxJsxFlowElement",
                    },
                  ],
                  "name": "CodeTab",
                  "position": {
                    "end": {
                      "column": 11,
                      "line": 30,
                      "offset": 429,
                    },
                    "start": {
                      "column": 1,
                      "line": 19,
                      "offset": 209,
                    },
                  },
                  "type": "mdxJsxFlowElement",
                },
                {
                  "attributes": [],
                  "children": [
                    {
                      "attributes": [],
                      "children": [
                        {
                          "children": [
                            {
                              "position": {
                                "end": {
                                  "column": 26,
                                  "line": 34,
                                  "offset": 471,
                                },
                                "start": {
                                  "column": 1,
                                  "line": 34,
                                  "offset": 446,
                                },
                              },
                              "type": "text",
                              "value": "First step in the process",
                            },
                          ],
                          "position": {
                            "end": {
                              "column": 26,
                              "line": 34,
                              "offset": 471,
                            },
                            "start": {
                              "column": 1,
                              "line": 34,
                              "offset": 446,
                            },
                          },
                          "type": "paragraph",
                        },
                      ],
                      "name": "Step",
                      "position": {
                        "end": {
                          "column": 8,
                          "line": 35,
                          "offset": 479,
                        },
                        "start": {
                          "column": 1,
                          "line": 33,
                          "offset": 439,
                        },
                      },
                      "type": "mdxJsxFlowElement",
                    },
                    {
                      "attributes": [],
                      "children": [
                        {
                          "children": [
                            {
                              "position": {
                                "end": {
                                  "column": 23,
                                  "line": 37,
                                  "offset": 509,
                                },
                                "start": {
                                  "column": 1,
                                  "line": 37,
                                  "offset": 487,
                                },
                              },
                              "type": "text",
                              "value": "Second step with code:",
                            },
                          ],
                          "position": {
                            "end": {
                              "column": 23,
                              "line": 37,
                              "offset": 509,
                            },
                            "start": {
                              "column": 1,
                              "line": 37,
                              "offset": 487,
                            },
                          },
                          "type": "paragraph",
                        },
                        {
                          "data": {
                            "hProperties": {},
                            "html": "<pre class="shiki shiki-themes github-light github-dark" style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e" tabindex="0"><code><span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">npm</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> install</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> package</span></span></code></pre>",
                          },
                          "lang": "bash",
                          "meta": null,
                          "position": {
                            "end": {
                              "column": 4,
                              "line": 40,
                              "offset": 541,
                            },
                            "start": {
                              "column": 1,
                              "line": 38,
                              "offset": 510,
                            },
                          },
                          "type": "code",
                          "value": "npm install package",
                        },
                      ],
                      "name": "Step",
                      "position": {
                        "end": {
                          "column": 8,
                          "line": 41,
                          "offset": 549,
                        },
                        "start": {
                          "column": 1,
                          "line": 36,
                          "offset": 480,
                        },
                      },
                      "type": "mdxJsxFlowElement",
                    },
                  ],
                  "name": "Steps",
                  "position": {
                    "end": {
                      "column": 9,
                      "line": 42,
                      "offset": 558,
                    },
                    "start": {
                      "column": 1,
                      "line": 32,
                      "offset": 431,
                    },
                  },
                  "type": "mdxJsxFlowElement",
                },
              ],
              "position": {
                "end": {
                  "column": 1,
                  "line": 43,
                  "offset": 559,
                },
                "start": {
                  "column": 1,
                  "line": 1,
                  "offset": 0,
                },
              },
              "type": "root",
            },
            "frontmatter": {
              "title": "Advanced Features",
            },
            "structuredData": {
              "contents": [
                {
                  "content": ":::note
          This is a note admonition.
          :::",
                  "heading": "",
                  "line": 7,
                },
                {
                  "content": ":::warning
          This is a warning admonition.
          :::",
                  "heading": "",
                  "line": 11,
                },
                {
                  "content": ":::tip
          This is a tip admonition with formatted text.
          :::",
                  "heading": "",
                  "line": 15,
                },
                {
                  "content": "const example = "JavaScript code";",
                  "heading": "",
                  "line": 21,
                },
                {
                  "content": "const example: string = "TypeScript code";",
                  "heading": "",
                  "line": 26,
                },
                {
                  "content": "First step in the process",
                  "heading": "",
                  "line": 34,
                },
                {
                  "content": "Second step with code:",
                  "heading": "",
                  "line": 37,
                },
                {
                  "content": "npm install package",
                  "heading": "",
                  "line": 38,
                },
              ],
              "headings": [],
            },
            "title": "Advanced MDX Features",
            "toc": [
              {
                "depth": 1,
                "title": "Advanced MDX Features",
                "url": "#advanced-mdx-features",
              },
            ],
          }
        `)
    })

    test('processes markdown file extension', async () => {
        const processor = getProcessor({
            extension: 'md',
            highlighter: undefined,
            onMissingLanguage: undefined,
        })

        const markdownContent = `---
title: "Markdown Document"
---

# Markdown Title

This is regular markdown content.

## Code Block

\`\`\`python
def hello():
    print("Hello, World!")
\`\`\`

### Lists and Links

- Item one
- Item two with [link](https://example.com)

> Blockquote in markdown
`

        const result = await processor.process(markdownContent)
        expect(result.data).toMatchInlineSnapshot(`
          {
            "ast": {
              "children": [
                {
                  "position": {
                    "end": {
                      "column": 4,
                      "line": 3,
                      "offset": 34,
                    },
                    "start": {
                      "column": 1,
                      "line": 1,
                      "offset": 0,
                    },
                  },
                  "type": "yaml",
                  "value": "title: "Markdown Document"",
                },
                {
                  "children": [
                    {
                      "position": {
                        "end": {
                          "column": 34,
                          "line": 7,
                          "offset": 87,
                        },
                        "start": {
                          "column": 1,
                          "line": 7,
                          "offset": 54,
                        },
                      },
                      "type": "text",
                      "value": "This is regular markdown content.",
                    },
                  ],
                  "position": {
                    "end": {
                      "column": 34,
                      "line": 7,
                      "offset": 87,
                    },
                    "start": {
                      "column": 1,
                      "line": 7,
                      "offset": 54,
                    },
                  },
                  "type": "paragraph",
                },
                {
                  "children": [
                    {
                      "position": {
                        "end": {
                          "column": 14,
                          "line": 9,
                          "offset": 102,
                        },
                        "start": {
                          "column": 4,
                          "line": 9,
                          "offset": 92,
                        },
                      },
                      "type": "text",
                      "value": "Code Block",
                    },
                  ],
                  "data": {
                    "hProperties": {
                      "id": "code-block",
                    },
                  },
                  "depth": 2,
                  "position": {
                    "end": {
                      "column": 14,
                      "line": 9,
                      "offset": 102,
                    },
                    "start": {
                      "column": 1,
                      "line": 9,
                      "offset": 89,
                    },
                  },
                  "type": "heading",
                },
                {
                  "data": {
                    "hProperties": {},
                    "html": "<pre class="shiki shiki-themes github-light github-dark" style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">def</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0"> hello</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">():</span></span>
          <span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF">    print</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">"Hello, World!"</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">)</span></span></code></pre>",
                  },
                  "lang": "python",
                  "meta": null,
                  "position": {
                    "end": {
                      "column": 4,
                      "line": 14,
                      "offset": 157,
                    },
                    "start": {
                      "column": 1,
                      "line": 11,
                      "offset": 104,
                    },
                  },
                  "type": "code",
                  "value": "def hello():
              print("Hello, World!")",
                },
                {
                  "children": [
                    {
                      "position": {
                        "end": {
                          "column": 20,
                          "line": 16,
                          "offset": 178,
                        },
                        "start": {
                          "column": 5,
                          "line": 16,
                          "offset": 163,
                        },
                      },
                      "type": "text",
                      "value": "Lists and Links",
                    },
                  ],
                  "data": {
                    "hProperties": {
                      "id": "lists-and-links",
                    },
                  },
                  "depth": 3,
                  "position": {
                    "end": {
                      "column": 20,
                      "line": 16,
                      "offset": 178,
                    },
                    "start": {
                      "column": 1,
                      "line": 16,
                      "offset": 159,
                    },
                  },
                  "type": "heading",
                },
                {
                  "children": [
                    {
                      "checked": null,
                      "children": [
                        {
                          "children": [
                            {
                              "position": {
                                "end": {
                                  "column": 11,
                                  "line": 18,
                                  "offset": 190,
                                },
                                "start": {
                                  "column": 3,
                                  "line": 18,
                                  "offset": 182,
                                },
                              },
                              "type": "text",
                              "value": "Item one",
                            },
                          ],
                          "position": {
                            "end": {
                              "column": 11,
                              "line": 18,
                              "offset": 190,
                            },
                            "start": {
                              "column": 3,
                              "line": 18,
                              "offset": 182,
                            },
                          },
                          "type": "paragraph",
                        },
                      ],
                      "position": {
                        "end": {
                          "column": 11,
                          "line": 18,
                          "offset": 190,
                        },
                        "start": {
                          "column": 1,
                          "line": 18,
                          "offset": 180,
                        },
                      },
                      "spread": false,
                      "type": "listItem",
                    },
                    {
                      "checked": null,
                      "children": [
                        {
                          "children": [
                            {
                              "position": {
                                "end": {
                                  "column": 17,
                                  "line": 19,
                                  "offset": 207,
                                },
                                "start": {
                                  "column": 3,
                                  "line": 19,
                                  "offset": 193,
                                },
                              },
                              "type": "text",
                              "value": "Item two with ",
                            },
                            {
                              "children": [
                                {
                                  "position": {
                                    "end": {
                                      "column": 22,
                                      "line": 19,
                                      "offset": 212,
                                    },
                                    "start": {
                                      "column": 18,
                                      "line": 19,
                                      "offset": 208,
                                    },
                                  },
                                  "type": "text",
                                  "value": "link",
                                },
                              ],
                              "position": {
                                "end": {
                                  "column": 44,
                                  "line": 19,
                                  "offset": 234,
                                },
                                "start": {
                                  "column": 17,
                                  "line": 19,
                                  "offset": 207,
                                },
                              },
                              "title": null,
                              "type": "link",
                              "url": "https://example.com",
                            },
                          ],
                          "position": {
                            "end": {
                              "column": 44,
                              "line": 19,
                              "offset": 234,
                            },
                            "start": {
                              "column": 3,
                              "line": 19,
                              "offset": 193,
                            },
                          },
                          "type": "paragraph",
                        },
                      ],
                      "position": {
                        "end": {
                          "column": 44,
                          "line": 19,
                          "offset": 234,
                        },
                        "start": {
                          "column": 1,
                          "line": 19,
                          "offset": 191,
                        },
                      },
                      "spread": false,
                      "type": "listItem",
                    },
                  ],
                  "ordered": false,
                  "position": {
                    "end": {
                      "column": 44,
                      "line": 19,
                      "offset": 234,
                    },
                    "start": {
                      "column": 1,
                      "line": 18,
                      "offset": 180,
                    },
                  },
                  "spread": false,
                  "start": null,
                  "type": "list",
                },
                {
                  "children": [
                    {
                      "children": [
                        {
                          "position": {
                            "end": {
                              "column": 25,
                              "line": 21,
                              "offset": 260,
                            },
                            "start": {
                              "column": 3,
                              "line": 21,
                              "offset": 238,
                            },
                          },
                          "type": "text",
                          "value": "Blockquote in markdown",
                        },
                      ],
                      "position": {
                        "end": {
                          "column": 25,
                          "line": 21,
                          "offset": 260,
                        },
                        "start": {
                          "column": 3,
                          "line": 21,
                          "offset": 238,
                        },
                      },
                      "type": "paragraph",
                    },
                  ],
                  "position": {
                    "end": {
                      "column": 25,
                      "line": 21,
                      "offset": 260,
                    },
                    "start": {
                      "column": 1,
                      "line": 21,
                      "offset": 236,
                    },
                  },
                  "type": "blockquote",
                },
              ],
              "position": {
                "end": {
                  "column": 1,
                  "line": 22,
                  "offset": 261,
                },
                "start": {
                  "column": 1,
                  "line": 1,
                  "offset": 0,
                },
              },
              "type": "root",
            },
            "frontmatter": {
              "title": "Markdown Document",
            },
            "structuredData": {
              "contents": [
                {
                  "content": "This is regular markdown content.",
                  "heading": "",
                  "line": 7,
                },
                {
                  "content": "def hello():
              print("Hello, World!")",
                  "heading": "code-block",
                  "line": 11,
                },
                {
                  "content": "Item oneItem two with link",
                  "heading": "lists-and-links",
                  "line": 18,
                },
                {
                  "content": "Blockquote in markdown",
                  "heading": "lists-and-links",
                  "line": 21,
                },
              ],
              "headings": [
                {
                  "content": "Code Block",
                  "id": "code-block",
                  "line": 9,
                },
                {
                  "content": "Lists and Links",
                  "id": "lists-and-links",
                  "line": 16,
                },
              ],
            },
            "title": "Markdown Title",
            "toc": [
              {
                "depth": 1,
                "title": "Markdown Title",
                "url": "#markdown-title",
              },
              {
                "depth": 2,
                "title": "Code Block",
                "url": "#code-block",
              },
              {
                "depth": 3,
                "title": "Lists and Links",
                "url": "#lists-and-links",
              },
            ],
          }
        `)
    })

    test('processes MDX with install blocks and mermaid', async () => {
        const processor = getProcessor({
            extension: 'mdx',
            highlighter: undefined,
            onMissingLanguage: undefined,
        })

        const complexMdx = `---
title: "Complex Features"
badge:
  content: "New"
  color: "blue"
---

# Complex MDX Document

<InstallTabs items={["npm", "yarn", "pnpm"]}>
<Tab value="npm">
\`\`\`bash
npm install fumadocs-core
\`\`\`
</Tab>
<Tab value="yarn">
\`\`\`bash
yarn add fumadocs-core
\`\`\`
</Tab>
<Tab value="pnpm">
\`\`\`bash
pnpm add fumadocs-core
\`\`\`
</Tab>
</InstallTabs>

## Mermaid Diagram

\`\`\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
\`\`\`

## Code with Highlighting

\`\`\`typescript {1,3-5}
const config = {
  theme: 'dark',
  features: [
    'syntax-highlighting',
    'line-numbers'
  ]
}
\`\`\`

### Accordion

<Accordion>
<AccordionItem title="What is this?">
This is an accordion item with content.
</AccordionItem>
</Accordion>
`

        const result = await processor.process(complexMdx)
        expect(result.data).toMatchInlineSnapshot(`
          {
            "ast": {
              "children": [
                {
                  "position": {
                    "end": {
                      "column": 4,
                      "line": 6,
                      "offset": 73,
                    },
                    "start": {
                      "column": 1,
                      "line": 1,
                      "offset": 0,
                    },
                  },
                  "type": "yaml",
                  "value": "title: "Complex Features"
          badge:
            content: "New"
            color: "blue"",
                },
                {
                  "attributes": [
                    {
                      "name": "items",
                      "position": {
                        "end": {
                          "column": 45,
                          "line": 10,
                          "offset": 143,
                        },
                        "start": {
                          "column": 14,
                          "line": 10,
                          "offset": 112,
                        },
                      },
                      "type": "mdxJsxAttribute",
                      "value": {
                        "data": {
                          "estree": {
                            "body": [
                              {
                                "end": 142,
                                "expression": Node {
                                  "elements": [
                                    Node {
                                      "end": 125,
                                      "loc": {
                                        "end": {
                                          "column": 26,
                                          "line": 10,
                                          "offset": 125,
                                        },
                                        "start": {
                                          "column": 21,
                                          "line": 10,
                                          "offset": 120,
                                        },
                                      },
                                      "range": [
                                        120,
                                        125,
                                      ],
                                      "raw": ""npm"",
                                      "start": 120,
                                      "type": "Literal",
                                      "value": "npm",
                                    },
                                    Node {
                                      "end": 133,
                                      "loc": {
                                        "end": {
                                          "column": 34,
                                          "line": 10,
                                          "offset": 133,
                                        },
                                        "start": {
                                          "column": 28,
                                          "line": 10,
                                          "offset": 127,
                                        },
                                      },
                                      "range": [
                                        127,
                                        133,
                                      ],
                                      "raw": ""yarn"",
                                      "start": 127,
                                      "type": "Literal",
                                      "value": "yarn",
                                    },
                                    Node {
                                      "end": 141,
                                      "loc": {
                                        "end": {
                                          "column": 42,
                                          "line": 10,
                                          "offset": 141,
                                        },
                                        "start": {
                                          "column": 36,
                                          "line": 10,
                                          "offset": 135,
                                        },
                                      },
                                      "range": [
                                        135,
                                        141,
                                      ],
                                      "raw": ""pnpm"",
                                      "start": 135,
                                      "type": "Literal",
                                      "value": "pnpm",
                                    },
                                  ],
                                  "end": 142,
                                  "loc": {
                                    "end": {
                                      "column": 43,
                                      "line": 10,
                                      "offset": 142,
                                    },
                                    "start": {
                                      "column": 20,
                                      "line": 10,
                                      "offset": 119,
                                    },
                                  },
                                  "range": [
                                    119,
                                    142,
                                  ],
                                  "start": 119,
                                  "type": "ArrayExpression",
                                },
                                "loc": {
                                  "end": {
                                    "column": 43,
                                    "line": 10,
                                    "offset": 142,
                                  },
                                  "start": {
                                    "column": 20,
                                    "line": 10,
                                    "offset": 119,
                                  },
                                },
                                "range": [
                                  119,
                                  142,
                                ],
                                "start": 119,
                                "type": "ExpressionStatement",
                              },
                            ],
                            "comments": [],
                            "end": 142,
                            "loc": {
                              "end": {
                                "column": 43,
                                "line": 10,
                                "offset": 142,
                              },
                              "start": {
                                "column": 20,
                                "line": 10,
                                "offset": 119,
                              },
                            },
                            "range": [
                              119,
                              142,
                            ],
                            "sourceType": "module",
                            "start": 119,
                            "type": "Program",
                          },
                        },
                        "type": "mdxJsxAttributeValueExpression",
                        "value": "["npm", "yarn", "pnpm"]",
                      },
                    },
                  ],
                  "children": [
                    {
                      "attributes": [
                        {
                          "name": "value",
                          "position": {
                            "end": {
                              "column": 17,
                              "line": 11,
                              "offset": 161,
                            },
                            "start": {
                              "column": 6,
                              "line": 11,
                              "offset": 150,
                            },
                          },
                          "type": "mdxJsxAttribute",
                          "value": "npm",
                        },
                      ],
                      "children": [
                        {
                          "data": {
                            "hProperties": {},
                            "html": "<pre class="shiki shiki-themes github-light github-dark" style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e" tabindex="0"><code><span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">npm</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> install</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> fumadocs-core</span></span></code></pre>",
                          },
                          "lang": "bash",
                          "meta": null,
                          "position": {
                            "end": {
                              "column": 4,
                              "line": 14,
                              "offset": 200,
                            },
                            "start": {
                              "column": 1,
                              "line": 12,
                              "offset": 163,
                            },
                          },
                          "type": "code",
                          "value": "npm install fumadocs-core",
                        },
                      ],
                      "name": "Tab",
                      "position": {
                        "end": {
                          "column": 7,
                          "line": 15,
                          "offset": 207,
                        },
                        "start": {
                          "column": 1,
                          "line": 11,
                          "offset": 145,
                        },
                      },
                      "type": "mdxJsxFlowElement",
                    },
                    {
                      "attributes": [
                        {
                          "name": "value",
                          "position": {
                            "end": {
                              "column": 18,
                              "line": 16,
                              "offset": 225,
                            },
                            "start": {
                              "column": 6,
                              "line": 16,
                              "offset": 213,
                            },
                          },
                          "type": "mdxJsxAttribute",
                          "value": "yarn",
                        },
                      ],
                      "children": [
                        {
                          "data": {
                            "hProperties": {},
                            "html": "<pre class="shiki shiki-themes github-light github-dark" style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e" tabindex="0"><code><span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">yarn</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> add</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> fumadocs-core</span></span></code></pre>",
                          },
                          "lang": "bash",
                          "meta": null,
                          "position": {
                            "end": {
                              "column": 4,
                              "line": 19,
                              "offset": 261,
                            },
                            "start": {
                              "column": 1,
                              "line": 17,
                              "offset": 227,
                            },
                          },
                          "type": "code",
                          "value": "yarn add fumadocs-core",
                        },
                      ],
                      "name": "Tab",
                      "position": {
                        "end": {
                          "column": 7,
                          "line": 20,
                          "offset": 268,
                        },
                        "start": {
                          "column": 1,
                          "line": 16,
                          "offset": 208,
                        },
                      },
                      "type": "mdxJsxFlowElement",
                    },
                    {
                      "attributes": [
                        {
                          "name": "value",
                          "position": {
                            "end": {
                              "column": 18,
                              "line": 21,
                              "offset": 286,
                            },
                            "start": {
                              "column": 6,
                              "line": 21,
                              "offset": 274,
                            },
                          },
                          "type": "mdxJsxAttribute",
                          "value": "pnpm",
                        },
                      ],
                      "children": [
                        {
                          "data": {
                            "hProperties": {},
                            "html": "<pre class="shiki shiki-themes github-light github-dark" style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e" tabindex="0"><code><span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0">pnpm</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> add</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF"> fumadocs-core</span></span></code></pre>",
                          },
                          "lang": "bash",
                          "meta": null,
                          "position": {
                            "end": {
                              "column": 4,
                              "line": 24,
                              "offset": 322,
                            },
                            "start": {
                              "column": 1,
                              "line": 22,
                              "offset": 288,
                            },
                          },
                          "type": "code",
                          "value": "pnpm add fumadocs-core",
                        },
                      ],
                      "name": "Tab",
                      "position": {
                        "end": {
                          "column": 7,
                          "line": 25,
                          "offset": 329,
                        },
                        "start": {
                          "column": 1,
                          "line": 21,
                          "offset": 269,
                        },
                      },
                      "type": "mdxJsxFlowElement",
                    },
                  ],
                  "name": "InstallTabs",
                  "position": {
                    "end": {
                      "column": 15,
                      "line": 26,
                      "offset": 344,
                    },
                    "start": {
                      "column": 1,
                      "line": 10,
                      "offset": 99,
                    },
                  },
                  "type": "mdxJsxFlowElement",
                },
                {
                  "children": [
                    {
                      "position": {
                        "end": {
                          "column": 19,
                          "line": 28,
                          "offset": 364,
                        },
                        "start": {
                          "column": 4,
                          "line": 28,
                          "offset": 349,
                        },
                      },
                      "type": "text",
                      "value": "Mermaid Diagram",
                    },
                  ],
                  "data": {
                    "hProperties": {
                      "id": "mermaid-diagram",
                    },
                  },
                  "depth": 2,
                  "position": {
                    "end": {
                      "column": 19,
                      "line": 28,
                      "offset": 364,
                    },
                    "start": {
                      "column": 1,
                      "line": 28,
                      "offset": 346,
                    },
                  },
                  "type": "heading",
                },
                {
                  "attributes": [
                    {
                      "name": "chart",
                      "type": "mdxJsxAttribute",
                      "value": "graph TD
              A[Start] --> B{Decision}
              B -->|Yes| C[Action 1]
              B -->|No| D[Action 2]",
                    },
                  ],
                  "children": [],
                  "name": "Mermaid",
                  "type": "mdxJsxFlowElement",
                },
                {
                  "children": [
                    {
                      "position": {
                        "end": {
                          "column": 26,
                          "line": 37,
                          "offset": 498,
                        },
                        "start": {
                          "column": 4,
                          "line": 37,
                          "offset": 476,
                        },
                      },
                      "type": "text",
                      "value": "Code with Highlighting",
                    },
                  ],
                  "data": {
                    "hProperties": {
                      "id": "code-with-highlighting",
                    },
                  },
                  "depth": 2,
                  "position": {
                    "end": {
                      "column": 26,
                      "line": 37,
                      "offset": 498,
                    },
                    "start": {
                      "column": 1,
                      "line": 37,
                      "offset": 473,
                    },
                  },
                  "type": "heading",
                },
                {
                  "data": {
                    "hProperties": {
                      "title": "{1,3-5}",
                    },
                    "html": "<pre class="shiki shiki-themes github-light github-dark" style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e" tabindex="0" title="{1,3-5}"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> config</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583"> =</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8"> {</span></span>
          <span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">  theme: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">'dark'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
          <span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">  features: [</span></span>
          <span class="line"><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">    'syntax-highlighting'</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">,</span></span>
          <span class="line"><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF">    'line-numbers'</span></span>
          <span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">  ]</span></span>
          <span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">}</span></span></code></pre>",
                  },
                  "lang": "typescript",
                  "meta": "{1,3-5}",
                  "position": {
                    "end": {
                      "column": 4,
                      "line": 47,
                      "offset": 625,
                    },
                    "start": {
                      "column": 1,
                      "line": 39,
                      "offset": 500,
                    },
                  },
                  "type": "code",
                  "value": "const config = {
            theme: 'dark',
            features: [
              'syntax-highlighting',
              'line-numbers'
            ]
          }",
                },
                {
                  "children": [
                    {
                      "position": {
                        "end": {
                          "column": 14,
                          "line": 49,
                          "offset": 640,
                        },
                        "start": {
                          "column": 5,
                          "line": 49,
                          "offset": 631,
                        },
                      },
                      "type": "text",
                      "value": "Accordion",
                    },
                  ],
                  "data": {
                    "hProperties": {
                      "id": "accordion",
                    },
                  },
                  "depth": 3,
                  "position": {
                    "end": {
                      "column": 14,
                      "line": 49,
                      "offset": 640,
                    },
                    "start": {
                      "column": 1,
                      "line": 49,
                      "offset": 627,
                    },
                  },
                  "type": "heading",
                },
                {
                  "attributes": [],
                  "children": [
                    {
                      "attributes": [],
                      "children": [
                        {
                          "attributes": [
                            {
                              "name": "title",
                              "position": {
                                "end": {
                                  "column": 37,
                                  "line": 52,
                                  "offset": 690,
                                },
                                "start": {
                                  "column": 16,
                                  "line": 52,
                                  "offset": 669,
                                },
                              },
                              "type": "mdxJsxAttribute",
                              "value": "What is this?",
                            },
                          ],
                          "children": [
                            {
                              "children": [
                                {
                                  "position": {
                                    "end": {
                                      "column": 40,
                                      "line": 53,
                                      "offset": 731,
                                    },
                                    "start": {
                                      "column": 1,
                                      "line": 53,
                                      "offset": 692,
                                    },
                                  },
                                  "type": "text",
                                  "value": "This is an accordion item with content.",
                                },
                              ],
                              "position": {
                                "end": {
                                  "column": 40,
                                  "line": 53,
                                  "offset": 731,
                                },
                                "start": {
                                  "column": 1,
                                  "line": 53,
                                  "offset": 692,
                                },
                              },
                              "type": "paragraph",
                            },
                          ],
                          "name": "AccordionItem",
                          "position": {
                            "end": {
                              "column": 17,
                              "line": 54,
                              "offset": 748,
                            },
                            "start": {
                              "column": 1,
                              "line": 52,
                              "offset": 654,
                            },
                          },
                          "type": "mdxJsxFlowElement",
                        },
                      ],
                      "name": "Accordion",
                      "position": {
                        "end": {
                          "column": 13,
                          "line": 55,
                          "offset": 761,
                        },
                        "start": {
                          "column": 1,
                          "line": 51,
                          "offset": 642,
                        },
                      },
                      "type": "mdxJsxFlowElement",
                    },
                  ],
                  "name": "AccordionGroup",
                  "type": "mdxJsxFlowElement",
                },
              ],
              "position": {
                "end": {
                  "column": 1,
                  "line": 56,
                  "offset": 762,
                },
                "start": {
                  "column": 1,
                  "line": 1,
                  "offset": 0,
                },
              },
              "type": "root",
            },
            "frontmatter": {
              "badge": {
                "color": "blue",
                "content": "New",
              },
              "title": "Complex Features",
            },
            "structuredData": {
              "contents": [
                {
                  "content": "items: ["npm", "yarn", "pnpm"]",
                  "heading": "",
                  "line": 10,
                },
                {
                  "content": "npm install fumadocs-core",
                  "heading": "",
                  "line": 12,
                },
                {
                  "content": "yarn add fumadocs-core",
                  "heading": "",
                  "line": 17,
                },
                {
                  "content": "pnpm add fumadocs-core",
                  "heading": "",
                  "line": 22,
                },
                {
                  "content": "chart: graph TD
              A[Start] --> B{Decision}
              B -->|Yes| C[Action 1]
              B -->|No| D[Action 2]",
                  "heading": "mermaid-diagram",
                  "line": undefined,
                },
                {
                  "content": "const config = {
            theme: 'dark',
            features: [
              'syntax-highlighting',
              'line-numbers'
            ]
          }",
                  "heading": "code-with-highlighting",
                  "line": 39,
                },
                {
                  "content": "title: What is this?",
                  "heading": "accordion",
                  "line": 52,
                },
                {
                  "content": "This is an accordion item with content.",
                  "heading": "accordion",
                  "line": 53,
                },
              ],
              "headings": [
                {
                  "content": "Mermaid Diagram",
                  "id": "mermaid-diagram",
                  "line": 28,
                },
                {
                  "content": "Code with Highlighting",
                  "id": "code-with-highlighting",
                  "line": 37,
                },
                {
                  "content": "Accordion",
                  "id": "accordion",
                  "line": 49,
                },
              ],
            },
            "title": "Complex MDX Document",
            "toc": [
              {
                "depth": 1,
                "title": "Complex MDX Document",
                "url": "#complex-mdx-document",
              },
              {
                "depth": 2,
                "title": "Mermaid Diagram",
                "url": "#mermaid-diagram",
              },
              {
                "depth": 2,
                "title": "Code with Highlighting",
                "url": "#code-with-highlighting",
              },
              {
                "depth": 3,
                "title": "Accordion",
                "url": "#accordion",
              },
            ],
          }
        `)
    })

    test('processes empty MDX document', async () => {
        const processor = getProcessor({
            extension: 'mdx',
            highlighter: undefined,
            onMissingLanguage: undefined,
        })

        const emptyMdx = `---
title: "Empty Document"
---`

        const result = await processor.process(emptyMdx)
        expect(result.data).toMatchInlineSnapshot(`
          {
            "ast": {
              "children": [
                {
                  "position": {
                    "end": {
                      "column": 4,
                      "line": 3,
                      "offset": 31,
                    },
                    "start": {
                      "column": 1,
                      "line": 1,
                      "offset": 0,
                    },
                  },
                  "type": "yaml",
                  "value": "title: "Empty Document"",
                },
              ],
              "position": {
                "end": {
                  "column": 4,
                  "line": 3,
                  "offset": 31,
                },
                "start": {
                  "column": 1,
                  "line": 1,
                  "offset": 0,
                },
              },
              "type": "root",
            },
            "frontmatter": {
              "title": "Empty Document",
            },
            "structuredData": {
              "contents": [],
              "headings": [],
            },
            "title": "Empty Document",
            "toc": [],
          }
        `)
    })

    test('processes MDX without frontmatter', async () => {
        const processor = getProcessor({
            extension: 'mdx',
            highlighter: undefined,
            onMissingLanguage: undefined,
        })

        const noFrontmatterMdx = `# Document Without Frontmatter

This document has no frontmatter but should still be processed correctly.

## Features

- Still has headings
- Still has lists
- Still has **formatting**

\`\`\`javascript
// And code blocks
const test = true;
\`\`\`
`

        const result = await processor.process(noFrontmatterMdx)
        expect(result.data).toMatchInlineSnapshot(`
          {
            "ast": {
              "children": [
                {
                  "children": [
                    {
                      "position": {
                        "end": {
                          "column": 74,
                          "line": 3,
                          "offset": 105,
                        },
                        "start": {
                          "column": 1,
                          "line": 3,
                          "offset": 32,
                        },
                      },
                      "type": "text",
                      "value": "This document has no frontmatter but should still be processed correctly.",
                    },
                  ],
                  "position": {
                    "end": {
                      "column": 74,
                      "line": 3,
                      "offset": 105,
                    },
                    "start": {
                      "column": 1,
                      "line": 3,
                      "offset": 32,
                    },
                  },
                  "type": "paragraph",
                },
                {
                  "children": [
                    {
                      "position": {
                        "end": {
                          "column": 12,
                          "line": 5,
                          "offset": 118,
                        },
                        "start": {
                          "column": 4,
                          "line": 5,
                          "offset": 110,
                        },
                      },
                      "type": "text",
                      "value": "Features",
                    },
                  ],
                  "data": {
                    "hProperties": {
                      "id": "features",
                    },
                  },
                  "depth": 2,
                  "position": {
                    "end": {
                      "column": 12,
                      "line": 5,
                      "offset": 118,
                    },
                    "start": {
                      "column": 1,
                      "line": 5,
                      "offset": 107,
                    },
                  },
                  "type": "heading",
                },
                {
                  "children": [
                    {
                      "checked": null,
                      "children": [
                        {
                          "children": [
                            {
                              "position": {
                                "end": {
                                  "column": 21,
                                  "line": 7,
                                  "offset": 140,
                                },
                                "start": {
                                  "column": 3,
                                  "line": 7,
                                  "offset": 122,
                                },
                              },
                              "type": "text",
                              "value": "Still has headings",
                            },
                          ],
                          "position": {
                            "end": {
                              "column": 21,
                              "line": 7,
                              "offset": 140,
                            },
                            "start": {
                              "column": 3,
                              "line": 7,
                              "offset": 122,
                            },
                          },
                          "type": "paragraph",
                        },
                      ],
                      "position": {
                        "end": {
                          "column": 21,
                          "line": 7,
                          "offset": 140,
                        },
                        "start": {
                          "column": 1,
                          "line": 7,
                          "offset": 120,
                        },
                      },
                      "spread": false,
                      "type": "listItem",
                    },
                    {
                      "checked": null,
                      "children": [
                        {
                          "children": [
                            {
                              "position": {
                                "end": {
                                  "column": 18,
                                  "line": 8,
                                  "offset": 158,
                                },
                                "start": {
                                  "column": 3,
                                  "line": 8,
                                  "offset": 143,
                                },
                              },
                              "type": "text",
                              "value": "Still has lists",
                            },
                          ],
                          "position": {
                            "end": {
                              "column": 18,
                              "line": 8,
                              "offset": 158,
                            },
                            "start": {
                              "column": 3,
                              "line": 8,
                              "offset": 143,
                            },
                          },
                          "type": "paragraph",
                        },
                      ],
                      "position": {
                        "end": {
                          "column": 18,
                          "line": 8,
                          "offset": 158,
                        },
                        "start": {
                          "column": 1,
                          "line": 8,
                          "offset": 141,
                        },
                      },
                      "spread": false,
                      "type": "listItem",
                    },
                    {
                      "checked": null,
                      "children": [
                        {
                          "children": [
                            {
                              "position": {
                                "end": {
                                  "column": 13,
                                  "line": 9,
                                  "offset": 171,
                                },
                                "start": {
                                  "column": 3,
                                  "line": 9,
                                  "offset": 161,
                                },
                              },
                              "type": "text",
                              "value": "Still has ",
                            },
                            {
                              "children": [
                                {
                                  "position": {
                                    "end": {
                                      "column": 25,
                                      "line": 9,
                                      "offset": 183,
                                    },
                                    "start": {
                                      "column": 15,
                                      "line": 9,
                                      "offset": 173,
                                    },
                                  },
                                  "type": "text",
                                  "value": "formatting",
                                },
                              ],
                              "position": {
                                "end": {
                                  "column": 27,
                                  "line": 9,
                                  "offset": 185,
                                },
                                "start": {
                                  "column": 13,
                                  "line": 9,
                                  "offset": 171,
                                },
                              },
                              "type": "strong",
                            },
                          ],
                          "position": {
                            "end": {
                              "column": 27,
                              "line": 9,
                              "offset": 185,
                            },
                            "start": {
                              "column": 3,
                              "line": 9,
                              "offset": 161,
                            },
                          },
                          "type": "paragraph",
                        },
                      ],
                      "position": {
                        "end": {
                          "column": 27,
                          "line": 9,
                          "offset": 185,
                        },
                        "start": {
                          "column": 1,
                          "line": 9,
                          "offset": 159,
                        },
                      },
                      "spread": false,
                      "type": "listItem",
                    },
                  ],
                  "ordered": false,
                  "position": {
                    "end": {
                      "column": 27,
                      "line": 9,
                      "offset": 185,
                    },
                    "start": {
                      "column": 1,
                      "line": 7,
                      "offset": 120,
                    },
                  },
                  "spread": false,
                  "start": null,
                  "type": "list",
                },
                {
                  "data": {
                    "hProperties": {},
                    "html": "<pre class="shiki shiki-themes github-light github-dark" style="--shiki-light:#24292e;--shiki-dark:#e1e4e8;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D">// And code blocks</span></span>
          <span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> test</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583"> =</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF"> true</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8">;</span></span></code></pre>",
                  },
                  "lang": "javascript",
                  "meta": null,
                  "position": {
                    "end": {
                      "column": 4,
                      "line": 14,
                      "offset": 242,
                    },
                    "start": {
                      "column": 1,
                      "line": 11,
                      "offset": 187,
                    },
                  },
                  "type": "code",
                  "value": "// And code blocks
          const test = true;",
                },
              ],
              "position": {
                "end": {
                  "column": 1,
                  "line": 15,
                  "offset": 243,
                },
                "start": {
                  "column": 1,
                  "line": 1,
                  "offset": 0,
                },
              },
              "type": "root",
            },
            "frontmatter": {
              "title": "Document Without Frontmatter",
            },
            "structuredData": {
              "contents": [
                {
                  "content": "This document has no frontmatter but should still be processed correctly.",
                  "heading": "",
                  "line": 3,
                },
                {
                  "content": "Still has headingsStill has listsStill has formatting",
                  "heading": "features",
                  "line": 7,
                },
                {
                  "content": "// And code blocks
          const test = true;",
                  "heading": "features",
                  "line": 11,
                },
              ],
              "headings": [
                {
                  "content": "Features",
                  "id": "features",
                  "line": 5,
                },
              ],
            },
            "title": "Document Without Frontmatter",
            "toc": [
              {
                "depth": 1,
                "title": "Document Without Frontmatter",
                "url": "#document-without-frontmatter",
              },
              {
                "depth": 2,
                "title": "Features",
                "url": "#features",
              },
            ],
          }
        `)
    })
})
