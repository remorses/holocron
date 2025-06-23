import { test, describe, expect } from 'vitest'
import { remark } from 'remark'
import remarkMdx from 'remark-mdx'
import { markRemarkAstAdditions } from './diff'
import type { Root } from 'mdast'

const processor = remark().use(remarkMdx)

function parseMarkdown(markdown: string): Root {
    return processor.parse(markdown)
}

function parseWithPositions(markdown: string): Root {
    return processor.parse(markdown)
}

describe('markRemarkAstAdditions', () => {
    test('detects no changes when trees are identical', () => {
        const old = parseWithPositions('# Hello\n\nWorld')
        const new_ = parseWithPositions('# Hello\n\nWorld')
        
        markRemarkAstAdditions(old, new_)
        
        expect(new_).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "position": {
                      "end": {
                        "column": 8,
                        "line": 1,
                        "offset": 7,
                      },
                      "start": {
                        "column": 3,
                        "line": 1,
                        "offset": 2,
                      },
                    },
                    "type": "text",
                    "value": "Hello",
                  },
                ],
                "depth": 1,
                "position": {
                  "end": {
                    "column": 8,
                    "line": 1,
                    "offset": 7,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "type": "heading",
              },
              {
                "children": [
                  {
                    "position": {
                      "end": {
                        "column": 6,
                        "line": 3,
                        "offset": 14,
                      },
                      "start": {
                        "column": 1,
                        "line": 3,
                        "offset": 9,
                      },
                    },
                    "type": "text",
                    "value": "World",
                  },
                ],
                "position": {
                  "end": {
                    "column": 6,
                    "line": 3,
                    "offset": 14,
                  },
                  "start": {
                    "column": 1,
                    "line": 3,
                    "offset": 9,
                  },
                },
                "type": "paragraph",
              },
            ],
            "position": {
              "end": {
                "column": 6,
                "line": 3,
                "offset": 14,
              },
              "start": {
                "column": 1,
                "line": 1,
                "offset": 0,
              },
            },
            "type": "root",
          }
        `)
    })

    test('detects text content changes with inline diff', () => {
        const old = parseWithPositions('Hello world')
        const new_ = parseWithPositions('Hello universe')
        
        markRemarkAstAdditions(old, new_)
        
        expect(new_).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "data": {
                          "hProperties": {
                            "data-added": true,
                          },
                        },
                        "type": "text",
                        "value": "Hello ",
                      },
                      {
                        "data": {
                          "hProperties": {
                            "data-added": true,
                          },
                        },
                        "type": "text",
                        "value": "universe",
                      },
                    ],
                    "data": {
                      "hProperties": {
                        "data-added": true,
                      },
                    },
                    "position": {
                      "end": {
                        "column": 15,
                        "line": 1,
                        "offset": 14,
                      },
                      "start": {
                        "column": 1,
                        "line": 1,
                        "offset": 0,
                      },
                    },
                    "type": "paragraph",
                    "value": undefined,
                  },
                ],
                "data": {
                  "hProperties": {
                    "data-added": true,
                  },
                },
                "position": {
                  "end": {
                    "column": 15,
                    "line": 1,
                    "offset": 14,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "type": "paragraph",
              },
            ],
            "position": {
              "end": {
                "column": 15,
                "line": 1,
                "offset": 14,
              },
              "start": {
                "column": 1,
                "line": 1,
                "offset": 0,
              },
            },
            "type": "root",
          }
        `)
    })

    test('detects heading level changes', () => {
        const old = parseWithPositions('# Title')
        const new_ = parseWithPositions('## Title')
        
        markRemarkAstAdditions(old, new_)
        
        expect(new_).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "data": {
                      "hProperties": {
                        "data-added": true,
                      },
                    },
                    "position": {
                      "end": {
                        "column": 9,
                        "line": 1,
                        "offset": 8,
                      },
                      "start": {
                        "column": 4,
                        "line": 1,
                        "offset": 3,
                      },
                    },
                    "type": "text",
                    "value": "Title",
                  },
                ],
                "data": {
                  "hProperties": {
                    "data-added": true,
                  },
                },
                "depth": 2,
                "position": {
                  "end": {
                    "column": 9,
                    "line": 1,
                    "offset": 8,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "type": "heading",
              },
            ],
            "position": {
              "end": {
                "column": 9,
                "line": 1,
                "offset": 8,
              },
              "start": {
                "column": 1,
                "line": 1,
                "offset": 0,
              },
            },
            "type": "root",
          }
        `)
    })

    test('detects new paragraphs', () => {
        const old = parseWithPositions('First paragraph')
        const new_ = parseWithPositions('First paragraph\n\nSecond paragraph')
        
        markRemarkAstAdditions(old, new_)
        
        expect(new_).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "position": {
                      "end": {
                        "column": 16,
                        "line": 1,
                        "offset": 15,
                      },
                      "start": {
                        "column": 1,
                        "line": 1,
                        "offset": 0,
                      },
                    },
                    "type": "text",
                    "value": "First paragraph",
                  },
                ],
                "position": {
                  "end": {
                    "column": 16,
                    "line": 1,
                    "offset": 15,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "type": "paragraph",
              },
              {
                "children": [
                  {
                    "data": {
                      "hProperties": {
                        "data-added": true,
                      },
                    },
                    "position": {
                      "end": {
                        "column": 17,
                        "line": 3,
                        "offset": 33,
                      },
                      "start": {
                        "column": 1,
                        "line": 3,
                        "offset": 17,
                      },
                    },
                    "type": "text",
                    "value": "Second paragraph",
                  },
                ],
                "data": {
                  "hProperties": {
                    "data-added": true,
                  },
                },
                "position": {
                  "end": {
                    "column": 17,
                    "line": 3,
                    "offset": 33,
                  },
                  "start": {
                    "column": 1,
                    "line": 3,
                    "offset": 17,
                  },
                },
                "type": "paragraph",
              },
            ],
            "position": {
              "end": {
                "column": 17,
                "line": 3,
                "offset": 33,
              },
              "start": {
                "column": 1,
                "line": 1,
                "offset": 0,
              },
            },
            "type": "root",
          }
        `)
    })

    test('detects link URL changes', () => {
        const old = parseWithPositions('[Link](https://old.com)')
        const new_ = parseWithPositions('[Link](https://new.com)')
        
        markRemarkAstAdditions(old, new_)
        
        expect(new_).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "position": {
                          "end": {
                            "column": 6,
                            "line": 1,
                            "offset": 5,
                          },
                          "start": {
                            "column": 2,
                            "line": 1,
                            "offset": 1,
                          },
                        },
                        "type": "text",
                        "value": "Link",
                      },
                    ],
                    "position": {
                      "end": {
                        "column": 24,
                        "line": 1,
                        "offset": 23,
                      },
                      "start": {
                        "column": 1,
                        "line": 1,
                        "offset": 0,
                      },
                    },
                    "title": null,
                    "type": "link",
                    "url": "https://old.com",
                  },
                ],
                "position": {
                  "end": {
                    "column": 24,
                    "line": 1,
                    "offset": 23,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "type": "paragraph",
              },
            ],
            "position": {
              "end": {
                "column": 24,
                "line": 1,
                "offset": 23,
              },
              "start": {
                "column": 1,
                "line": 1,
                "offset": 0,
              },
            },
            "type": "root",
          }
        `)
    })

    test('detects link title changes', () => {
        const old = parseWithPositions('[Link](https://example.com "Old Title")')
        const new_ = parseWithPositions('[Link](https://example.com "New Title")')
        
        markRemarkAstAdditions(old, new_)
        
        expect(new_).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "position": {
                          "end": {
                            "column": 6,
                            "line": 1,
                            "offset": 5,
                          },
                          "start": {
                            "column": 2,
                            "line": 1,
                            "offset": 1,
                          },
                        },
                        "type": "text",
                        "value": "Link",
                      },
                    ],
                    "position": {
                      "end": {
                        "column": 40,
                        "line": 1,
                        "offset": 39,
                      },
                      "start": {
                        "column": 1,
                        "line": 1,
                        "offset": 0,
                      },
                    },
                    "title": "Old Title",
                    "type": "link",
                    "url": "https://example.com",
                  },
                ],
                "position": {
                  "end": {
                    "column": 40,
                    "line": 1,
                    "offset": 39,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "type": "paragraph",
              },
            ],
            "position": {
              "end": {
                "column": 40,
                "line": 1,
                "offset": 39,
              },
              "start": {
                "column": 1,
                "line": 1,
                "offset": 0,
              },
            },
            "type": "root",
          }
        `)
    })

    test('detects list type changes', () => {
        const old = parseWithPositions('- Item 1\n- Item 2')
        const new_ = parseWithPositions('1. Item 1\n2. Item 2')
        
        markRemarkAstAdditions(old, new_)
        
        expect(new_).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "checked": null,
                    "children": [
                      {
                        "children": [
                          {
                            "data": {
                              "hProperties": {
                                "data-added": true,
                              },
                            },
                            "position": {
                              "end": {
                                "column": 10,
                                "line": 1,
                                "offset": 9,
                              },
                              "start": {
                                "column": 4,
                                "line": 1,
                                "offset": 3,
                              },
                            },
                            "type": "text",
                            "value": "Item 1",
                          },
                        ],
                        "data": {
                          "hProperties": {
                            "data-added": true,
                          },
                        },
                        "position": {
                          "end": {
                            "column": 10,
                            "line": 1,
                            "offset": 9,
                          },
                          "start": {
                            "column": 4,
                            "line": 1,
                            "offset": 3,
                          },
                        },
                        "type": "paragraph",
                      },
                    ],
                    "position": {
                      "end": {
                        "column": 10,
                        "line": 1,
                        "offset": 9,
                      },
                      "start": {
                        "column": 1,
                        "line": 1,
                        "offset": 0,
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
                            "data": {
                              "hProperties": {
                                "data-added": true,
                              },
                            },
                            "position": {
                              "end": {
                                "column": 10,
                                "line": 2,
                                "offset": 19,
                              },
                              "start": {
                                "column": 4,
                                "line": 2,
                                "offset": 13,
                              },
                            },
                            "type": "text",
                            "value": "Item 2",
                          },
                        ],
                        "data": {
                          "hProperties": {
                            "data-added": true,
                          },
                        },
                        "position": {
                          "end": {
                            "column": 10,
                            "line": 2,
                            "offset": 19,
                          },
                          "start": {
                            "column": 4,
                            "line": 2,
                            "offset": 13,
                          },
                        },
                        "type": "paragraph",
                      },
                    ],
                    "position": {
                      "end": {
                        "column": 10,
                        "line": 2,
                        "offset": 19,
                      },
                      "start": {
                        "column": 1,
                        "line": 2,
                        "offset": 10,
                      },
                    },
                    "spread": false,
                    "type": "listItem",
                  },
                ],
                "data": {
                  "hProperties": {
                    "data-added": true,
                  },
                },
                "ordered": true,
                "position": {
                  "end": {
                    "column": 10,
                    "line": 2,
                    "offset": 19,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "spread": false,
                "start": 1,
                "type": "list",
              },
            ],
            "position": {
              "end": {
                "column": 10,
                "line": 2,
                "offset": 19,
              },
              "start": {
                "column": 1,
                "line": 1,
                "offset": 0,
              },
            },
            "type": "root",
          }
        `)
    })

    test('detects code block language changes', () => {
        const old = parseWithPositions('```js\nconsole.log("hello")\n```')
        const new_ = parseWithPositions('```ts\nconsole.log("hello")\n```')
        
        markRemarkAstAdditions(old, new_)
        
        expect(new_).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "data": {
                  "hProperties": {
                    "data-added": true,
                  },
                },
                "lang": "ts",
                "meta": null,
                "position": {
                  "end": {
                    "column": 4,
                    "line": 3,
                    "offset": 30,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "type": "code",
                "value": "console.log("hello")",
              },
            ],
            "position": {
              "end": {
                "column": 4,
                "line": 3,
                "offset": 30,
              },
              "start": {
                "column": 1,
                "line": 1,
                "offset": 0,
              },
            },
            "type": "root",
          }
        `)
    })

    test('detects image changes', () => {
        const old = parseWithPositions('![Alt](old.jpg)')
        const new_ = parseWithPositions('![New Alt](new.jpg)')
        
        markRemarkAstAdditions(old, new_)
        
        expect(new_).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "alt": "Alt",
                    "position": {
                      "end": {
                        "column": 16,
                        "line": 1,
                        "offset": 15,
                      },
                      "start": {
                        "column": 1,
                        "line": 1,
                        "offset": 0,
                      },
                    },
                    "title": null,
                    "type": "image",
                    "url": "old.jpg",
                  },
                ],
                "position": {
                  "end": {
                    "column": 16,
                    "line": 1,
                    "offset": 15,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "type": "paragraph",
              },
            ],
            "position": {
              "end": {
                "column": 20,
                "line": 1,
                "offset": 19,
              },
              "start": {
                "column": 1,
                "line": 1,
                "offset": 0,
              },
            },
            "type": "root",
          }
        `)
    })

    test('detects emphasis changes', () => {
        const old = parseWithPositions('*italic*')
        const new_ = parseWithPositions('**bold**')
        
        markRemarkAstAdditions(old, new_)
        
        expect(new_).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "position": {
                          "end": {
                            "column": 8,
                            "line": 1,
                            "offset": 7,
                          },
                          "start": {
                            "column": 2,
                            "line": 1,
                            "offset": 1,
                          },
                        },
                        "type": "text",
                        "value": "italic",
                      },
                    ],
                    "position": {
                      "end": {
                        "column": 9,
                        "line": 1,
                        "offset": 8,
                      },
                      "start": {
                        "column": 1,
                        "line": 1,
                        "offset": 0,
                      },
                    },
                    "type": "emphasis",
                  },
                ],
                "position": {
                  "end": {
                    "column": 9,
                    "line": 1,
                    "offset": 8,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "type": "paragraph",
              },
            ],
            "position": {
              "end": {
                "column": 9,
                "line": 1,
                "offset": 8,
              },
              "start": {
                "column": 1,
                "line": 1,
                "offset": 0,
              },
            },
            "type": "root",
          }
        `)
    })

    test('detects MDX component name changes', () => {
        const old = parseWithPositions('<Card title="Hello" />')
        const new_ = parseWithPositions('<Alert title="Hello" />')
        
        markRemarkAstAdditions(old, new_)
        
        expect(new_).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "attributes": [
                  {
                    "name": "title",
                    "position": {
                      "end": {
                        "column": 21,
                        "line": 1,
                        "offset": 20,
                      },
                      "start": {
                        "column": 8,
                        "line": 1,
                        "offset": 7,
                      },
                    },
                    "type": "mdxJsxAttribute",
                    "value": "Hello",
                  },
                ],
                "children": [],
                "data": {
                  "hProperties": {
                    "data-added": true,
                  },
                },
                "name": "Alert",
                "position": {
                  "end": {
                    "column": 24,
                    "line": 1,
                    "offset": 23,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "type": "mdxJsxFlowElement",
              },
            ],
            "position": {
              "end": {
                "column": 24,
                "line": 1,
                "offset": 23,
              },
              "start": {
                "column": 1,
                "line": 1,
                "offset": 0,
              },
            },
            "type": "root",
          }
        `)
    })

    test('detects MDX component attribute changes', () => {
        const old = parseWithPositions('<Card title="Old" />')
        const new_ = parseWithPositions('<Card title="New" />')
        
        markRemarkAstAdditions(old, new_)
        
        expect(new_).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "attributes": [
                  {
                    "name": "title",
                    "position": {
                      "end": {
                        "column": 18,
                        "line": 1,
                        "offset": 17,
                      },
                      "start": {
                        "column": 7,
                        "line": 1,
                        "offset": 6,
                      },
                    },
                    "type": "mdxJsxAttribute",
                    "value": "New",
                  },
                ],
                "children": [],
                "data": {
                  "hProperties": {
                    "data-added": true,
                  },
                },
                "name": "Card",
                "position": {
                  "end": {
                    "column": 21,
                    "line": 1,
                    "offset": 20,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "type": "mdxJsxFlowElement",
              },
            ],
            "position": {
              "end": {
                "column": 21,
                "line": 1,
                "offset": 20,
              },
              "start": {
                "column": 1,
                "line": 1,
                "offset": 0,
              },
            },
            "type": "root",
          }
        `)
    })

    test('detects table structure changes', () => {
        const old = parseWithPositions('| A | B |\n|---|---|\n| 1 | 2 |')
        const new_ = parseWithPositions('| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |')
        
        markRemarkAstAdditions(old, new_)
        
        expect(new_).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "data": {
                          "hProperties": {
                            "data-added": true,
                          },
                        },
                        "type": "text",
                        "value": "| A | B |",
                      },
                      {
                        "data": {
                          "hProperties": {
                            "data-added": true,
                          },
                        },
                        "type": "text",
                        "value": " C |
          |---",
                      },
                      {
                        "data": {
                          "hProperties": {
                            "data-added": true,
                          },
                        },
                        "type": "text",
                        "value": "|---|---|
          | 1 | 2 |",
                      },
                      {
                        "data": {
                          "hProperties": {
                            "data-added": true,
                          },
                        },
                        "type": "text",
                        "value": " 3 |",
                      },
                    ],
                    "data": {
                      "hProperties": {
                        "data-added": true,
                      },
                    },
                    "position": {
                      "end": {
                        "column": 14,
                        "line": 3,
                        "offset": 41,
                      },
                      "start": {
                        "column": 1,
                        "line": 1,
                        "offset": 0,
                      },
                    },
                    "type": "paragraph",
                    "value": undefined,
                  },
                ],
                "data": {
                  "hProperties": {
                    "data-added": true,
                  },
                },
                "position": {
                  "end": {
                    "column": 14,
                    "line": 3,
                    "offset": 41,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "type": "paragraph",
              },
            ],
            "position": {
              "end": {
                "column": 14,
                "line": 3,
                "offset": 41,
              },
              "start": {
                "column": 1,
                "line": 1,
                "offset": 0,
              },
            },
            "type": "root",
          }
        `)
    })

    test('preserves React identity for unchanged nodes', () => {
        const old = parseWithPositions('# Unchanged\n\nSame text\n\n## Also unchanged')
        const new_ = parseWithPositions('# Unchanged\n\nSame text\n\n## Also unchanged\n\nNew paragraph')
        
        // Store references to original nodes
        const oldHeading = old.children[0]
        const oldParagraph = old.children[1]
        const oldSecondHeading = old.children[2]
        
        markRemarkAstAdditions(old, new_)
        
        // Check that unchanged nodes preserve identity
        expect(new_.children[0]).toBe(oldHeading)
        expect(new_.children[1]).toBe(oldParagraph)
        expect(new_.children[2]).toBe(oldSecondHeading)
        
        // Check that new node is different
        expect(new_.children[3]).not.toBe(undefined)
        
        expect({
            unchangedNodesPreserved: new_.children[0] === oldHeading && new_.children[1] === oldParagraph && new_.children[2] === oldSecondHeading,
            newNodeAdded: new_.children.length === 4
        }).toMatchInlineSnapshot(`
          {
            "newNodeAdded": true,
            "unchangedNodesPreserved": true,
          }
        `)
    })

    test('handles complex nested changes', () => {
        const old = parseWithPositions(`
# Title

This is a paragraph with [old link](https://old.com).

- List item 1
- List item 2

\`\`\`js
const old = "code"
\`\`\`
        `)
        
        const new_ = parseWithPositions(`
# Title

This is a paragraph with [new link](https://new.com) and **bold text**.

- List item 1
- List item 2
- List item 3

\`\`\`ts
const new = "code"
\`\`\`
        `)
        
        markRemarkAstAdditions(old, new_)
        
        expect(new_).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "position": {
                      "end": {
                        "column": 8,
                        "line": 2,
                        "offset": 8,
                      },
                      "start": {
                        "column": 3,
                        "line": 2,
                        "offset": 3,
                      },
                    },
                    "type": "text",
                    "value": "Title",
                  },
                ],
                "depth": 1,
                "position": {
                  "end": {
                    "column": 8,
                    "line": 2,
                    "offset": 8,
                  },
                  "start": {
                    "column": 1,
                    "line": 2,
                    "offset": 1,
                  },
                },
                "type": "heading",
              },
              {
                "children": [
                  {
                    "position": {
                      "end": {
                        "column": 26,
                        "line": 4,
                        "offset": 35,
                      },
                      "start": {
                        "column": 1,
                        "line": 4,
                        "offset": 10,
                      },
                    },
                    "type": "text",
                    "value": "This is a paragraph with ",
                  },
                  {
                    "children": [
                      {
                        "children": [
                          {
                            "data": {
                              "hProperties": {
                                "data-added": true,
                              },
                            },
                            "type": "text",
                            "value": "new",
                          },
                          {
                            "data": {
                              "hProperties": {
                                "data-added": true,
                              },
                            },
                            "type": "text",
                            "value": " link",
                          },
                        ],
                        "data": {
                          "hProperties": {
                            "data-added": true,
                          },
                        },
                        "position": {
                          "end": {
                            "column": 35,
                            "line": 4,
                            "offset": 44,
                          },
                          "start": {
                            "column": 27,
                            "line": 4,
                            "offset": 36,
                          },
                        },
                        "type": "paragraph",
                        "value": undefined,
                      },
                    ],
                    "data": {
                      "hProperties": {
                        "data-added": true,
                      },
                    },
                    "position": {
                      "end": {
                        "column": 53,
                        "line": 4,
                        "offset": 62,
                      },
                      "start": {
                        "column": 26,
                        "line": 4,
                        "offset": 35,
                      },
                    },
                    "title": null,
                    "type": "link",
                    "url": "https://new.com",
                  },
                  {
                    "children": [
                      {
                        "data": {
                          "hProperties": {
                            "data-added": true,
                          },
                        },
                        "type": "text",
                        "value": " and ",
                      },
                    ],
                    "data": {
                      "hProperties": {
                        "data-added": true,
                      },
                    },
                    "position": {
                      "end": {
                        "column": 58,
                        "line": 4,
                        "offset": 67,
                      },
                      "start": {
                        "column": 53,
                        "line": 4,
                        "offset": 62,
                      },
                    },
                    "type": "paragraph",
                    "value": undefined,
                  },
                  {
                    "children": [
                      {
                        "data": {
                          "hProperties": {
                            "data-added": true,
                          },
                        },
                        "position": {
                          "end": {
                            "column": 69,
                            "line": 4,
                            "offset": 78,
                          },
                          "start": {
                            "column": 60,
                            "line": 4,
                            "offset": 69,
                          },
                        },
                        "type": "text",
                        "value": "bold text",
                      },
                    ],
                    "data": {
                      "hProperties": {
                        "data-added": true,
                      },
                    },
                    "position": {
                      "end": {
                        "column": 71,
                        "line": 4,
                        "offset": 80,
                      },
                      "start": {
                        "column": 58,
                        "line": 4,
                        "offset": 67,
                      },
                    },
                    "type": "strong",
                  },
                  {
                    "data": {
                      "hProperties": {
                        "data-added": true,
                      },
                    },
                    "position": {
                      "end": {
                        "column": 72,
                        "line": 4,
                        "offset": 81,
                      },
                      "start": {
                        "column": 71,
                        "line": 4,
                        "offset": 80,
                      },
                    },
                    "type": "text",
                    "value": ".",
                  },
                ],
                "data": {
                  "hProperties": {
                    "data-added": true,
                  },
                },
                "position": {
                  "end": {
                    "column": 72,
                    "line": 4,
                    "offset": 81,
                  },
                  "start": {
                    "column": 1,
                    "line": 4,
                    "offset": 10,
                  },
                },
                "type": "paragraph",
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
                                "column": 14,
                                "line": 6,
                                "offset": 78,
                              },
                              "start": {
                                "column": 3,
                                "line": 6,
                                "offset": 67,
                              },
                            },
                            "type": "text",
                            "value": "List item 1",
                          },
                        ],
                        "position": {
                          "end": {
                            "column": 14,
                            "line": 6,
                            "offset": 78,
                          },
                          "start": {
                            "column": 3,
                            "line": 6,
                            "offset": 67,
                          },
                        },
                        "type": "paragraph",
                      },
                    ],
                    "position": {
                      "end": {
                        "column": 14,
                        "line": 6,
                        "offset": 78,
                      },
                      "start": {
                        "column": 1,
                        "line": 6,
                        "offset": 65,
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
                                "column": 14,
                                "line": 7,
                                "offset": 92,
                              },
                              "start": {
                                "column": 3,
                                "line": 7,
                                "offset": 81,
                              },
                            },
                            "type": "text",
                            "value": "List item 2",
                          },
                        ],
                        "position": {
                          "end": {
                            "column": 14,
                            "line": 7,
                            "offset": 92,
                          },
                          "start": {
                            "column": 3,
                            "line": 7,
                            "offset": 81,
                          },
                        },
                        "type": "paragraph",
                      },
                    ],
                    "position": {
                      "end": {
                        "column": 14,
                        "line": 7,
                        "offset": 92,
                      },
                      "start": {
                        "column": 1,
                        "line": 7,
                        "offset": 79,
                      },
                    },
                    "spread": false,
                    "type": "listItem",
                  },
                ],
                "ordered": false,
                "position": {
                  "end": {
                    "column": 14,
                    "line": 7,
                    "offset": 92,
                  },
                  "start": {
                    "column": 1,
                    "line": 6,
                    "offset": 65,
                  },
                },
                "spread": false,
                "start": null,
                "type": "list",
              },
              {
                "data": {
                  "hProperties": {
                    "data-added": true,
                  },
                },
                "lang": "ts",
                "meta": null,
                "position": {
                  "end": {
                    "column": 4,
                    "line": 12,
                    "offset": 154,
                  },
                  "start": {
                    "column": 1,
                    "line": 10,
                    "offset": 126,
                  },
                },
                "type": "code",
                "value": "const new = "code"",
              },
            ],
            "position": {
              "end": {
                "column": 9,
                "line": 13,
                "offset": 163,
              },
              "start": {
                "column": 1,
                "line": 1,
                "offset": 0,
              },
            },
            "type": "root",
          }
        `)
    })

    test('handles blockquote changes', () => {
        const old = parseWithPositions('> Old quote')
        const new_ = parseWithPositions('> New quote')
        
        markRemarkAstAdditions(old, new_)
        
        expect(new_).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "position": {
                          "end": {
                            "column": 12,
                            "line": 1,
                            "offset": 11,
                          },
                          "start": {
                            "column": 3,
                            "line": 1,
                            "offset": 2,
                          },
                        },
                        "type": "text",
                        "value": "Old quote",
                      },
                    ],
                    "position": {
                      "end": {
                        "column": 12,
                        "line": 1,
                        "offset": 11,
                      },
                      "start": {
                        "column": 3,
                        "line": 1,
                        "offset": 2,
                      },
                    },
                    "type": "paragraph",
                  },
                ],
                "position": {
                  "end": {
                    "column": 12,
                    "line": 1,
                    "offset": 11,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "type": "blockquote",
              },
            ],
            "position": {
              "end": {
                "column": 12,
                "line": 1,
                "offset": 11,
              },
              "start": {
                "column": 1,
                "line": 1,
                "offset": 0,
              },
            },
            "type": "root",
          }
        `)
    })

    test('handles inline code changes', () => {
        const old = parseWithPositions('Use `oldFunction()` here')
        const new_ = parseWithPositions('Use `newFunction()` here')
        
        markRemarkAstAdditions(old, new_)
        
        expect(new_).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "position": {
                      "end": {
                        "column": 5,
                        "line": 1,
                        "offset": 4,
                      },
                      "start": {
                        "column": 1,
                        "line": 1,
                        "offset": 0,
                      },
                    },
                    "type": "text",
                    "value": "Use ",
                  },
                  {
                    "position": {
                      "end": {
                        "column": 20,
                        "line": 1,
                        "offset": 19,
                      },
                      "start": {
                        "column": 5,
                        "line": 1,
                        "offset": 4,
                      },
                    },
                    "type": "inlineCode",
                    "value": "oldFunction()",
                  },
                  {
                    "position": {
                      "end": {
                        "column": 25,
                        "line": 1,
                        "offset": 24,
                      },
                      "start": {
                        "column": 20,
                        "line": 1,
                        "offset": 19,
                      },
                    },
                    "type": "text",
                    "value": " here",
                  },
                ],
                "position": {
                  "end": {
                    "column": 25,
                    "line": 1,
                    "offset": 24,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "type": "paragraph",
              },
            ],
            "position": {
              "end": {
                "column": 25,
                "line": 1,
                "offset": 24,
              },
              "start": {
                "column": 1,
                "line": 1,
                "offset": 0,
              },
            },
            "type": "root",
          }
        `)
    })

    test('handles thematic break additions', () => {
        const old = parseWithPositions('Paragraph one\n\nParagraph two')
        const new_ = parseWithPositions('Paragraph one\n\n---\n\nParagraph two')
        
        markRemarkAstAdditions(old, new_)
        
        expect(new_).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "position": {
                      "end": {
                        "column": 14,
                        "line": 1,
                        "offset": 13,
                      },
                      "start": {
                        "column": 1,
                        "line": 1,
                        "offset": 0,
                      },
                    },
                    "type": "text",
                    "value": "Paragraph one",
                  },
                ],
                "position": {
                  "end": {
                    "column": 14,
                    "line": 1,
                    "offset": 13,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "type": "paragraph",
              },
              {
                "data": {
                  "hProperties": {
                    "data-added": true,
                  },
                },
                "position": {
                  "end": {
                    "column": 4,
                    "line": 3,
                    "offset": 18,
                  },
                  "start": {
                    "column": 1,
                    "line": 3,
                    "offset": 15,
                  },
                },
                "type": "thematicBreak",
              },
              {
                "children": [
                  {
                    "data": {
                      "hProperties": {
                        "data-added": true,
                      },
                    },
                    "position": {
                      "end": {
                        "column": 14,
                        "line": 5,
                        "offset": 33,
                      },
                      "start": {
                        "column": 1,
                        "line": 5,
                        "offset": 20,
                      },
                    },
                    "type": "text",
                    "value": "Paragraph two",
                  },
                ],
                "data": {
                  "hProperties": {
                    "data-added": true,
                  },
                },
                "position": {
                  "end": {
                    "column": 14,
                    "line": 5,
                    "offset": 33,
                  },
                  "start": {
                    "column": 1,
                    "line": 5,
                    "offset": 20,
                  },
                },
                "type": "paragraph",
              },
            ],
            "position": {
              "end": {
                "column": 14,
                "line": 5,
                "offset": 33,
              },
              "start": {
                "column": 1,
                "line": 1,
                "offset": 0,
              },
            },
            "type": "root",
          }
        `)
    })

    test('handles list item checkbox changes', () => {
        const old = parseWithPositions('- [ ] Unchecked\n- [x] Checked')
        const new_ = parseWithPositions('- [x] Checked\n- [ ] Unchecked')
        
        markRemarkAstAdditions(old, new_)
        
        expect(new_).toMatchInlineSnapshot(`
          {
            "children": [
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
                                "column": 16,
                                "line": 1,
                                "offset": 15,
                              },
                              "start": {
                                "column": 3,
                                "line": 1,
                                "offset": 2,
                              },
                            },
                            "type": "text",
                            "value": "[ ] Unchecked",
                          },
                        ],
                        "position": {
                          "end": {
                            "column": 16,
                            "line": 1,
                            "offset": 15,
                          },
                          "start": {
                            "column": 3,
                            "line": 1,
                            "offset": 2,
                          },
                        },
                        "type": "paragraph",
                      },
                    ],
                    "position": {
                      "end": {
                        "column": 16,
                        "line": 1,
                        "offset": 15,
                      },
                      "start": {
                        "column": 1,
                        "line": 1,
                        "offset": 0,
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
                                "column": 14,
                                "line": 2,
                                "offset": 29,
                              },
                              "start": {
                                "column": 3,
                                "line": 2,
                                "offset": 18,
                              },
                            },
                            "type": "text",
                            "value": "[x] Checked",
                          },
                        ],
                        "position": {
                          "end": {
                            "column": 14,
                            "line": 2,
                            "offset": 29,
                          },
                          "start": {
                            "column": 3,
                            "line": 2,
                            "offset": 18,
                          },
                        },
                        "type": "paragraph",
                      },
                    ],
                    "position": {
                      "end": {
                        "column": 14,
                        "line": 2,
                        "offset": 29,
                      },
                      "start": {
                        "column": 1,
                        "line": 2,
                        "offset": 16,
                      },
                    },
                    "spread": false,
                    "type": "listItem",
                  },
                ],
                "ordered": false,
                "position": {
                  "end": {
                    "column": 14,
                    "line": 2,
                    "offset": 29,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "spread": false,
                "start": null,
                "type": "list",
              },
            ],
            "position": {
              "end": {
                "column": 16,
                "line": 2,
                "offset": 29,
              },
              "start": {
                "column": 1,
                "line": 1,
                "offset": 0,
              },
            },
            "type": "root",
          }
        `)
    })

    test('handles partial text changes with highlighting', () => {
        const old = parseWithPositions('The quick brown fox jumps')
        const new_ = parseWithPositions('The quick red fox leaps')
        
        markRemarkAstAdditions(old, new_)
        
        expect(new_).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "data": {
                          "hProperties": {
                            "data-added": true,
                          },
                        },
                        "type": "text",
                        "value": "The quick ",
                      },
                      {
                        "data": {
                          "hProperties": {
                            "data-added": true,
                          },
                        },
                        "type": "text",
                        "value": "red",
                      },
                      {
                        "data": {
                          "hProperties": {
                            "data-added": true,
                          },
                        },
                        "type": "text",
                        "value": " fox ",
                      },
                      {
                        "data": {
                          "hProperties": {
                            "data-added": true,
                          },
                        },
                        "type": "text",
                        "value": "lea",
                      },
                      {
                        "data": {
                          "hProperties": {
                            "data-added": true,
                          },
                        },
                        "type": "text",
                        "value": "ps",
                      },
                    ],
                    "data": {
                      "hProperties": {
                        "data-added": true,
                      },
                    },
                    "position": {
                      "end": {
                        "column": 24,
                        "line": 1,
                        "offset": 23,
                      },
                      "start": {
                        "column": 1,
                        "line": 1,
                        "offset": 0,
                      },
                    },
                    "type": "paragraph",
                    "value": undefined,
                  },
                ],
                "data": {
                  "hProperties": {
                    "data-added": true,
                  },
                },
                "position": {
                  "end": {
                    "column": 24,
                    "line": 1,
                    "offset": 23,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "type": "paragraph",
              },
            ],
            "position": {
              "end": {
                "column": 24,
                "line": 1,
                "offset": 23,
              },
              "start": {
                "column": 1,
                "line": 1,
                "offset": 0,
              },
            },
            "type": "root",
          }
        `)
    })

    test('handles MDX expression changes', () => {
        const old = parseWithPositions('{oldVariable}')
        const new_ = parseWithPositions('{newVariable}')
        
        markRemarkAstAdditions(old, new_)
        
        expect(new_).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "data": {
                  "estree": {
                    "body": [
                      {
                        "end": 12,
                        "expression": Node {
                          "end": 12,
                          "loc": {
                            "end": {
                              "column": 12,
                              "line": 1,
                              "offset": 12,
                            },
                            "start": {
                              "column": 1,
                              "line": 1,
                              "offset": 1,
                            },
                          },
                          "name": "newVariable",
                          "range": [
                            1,
                            12,
                          ],
                          "start": 1,
                          "type": "Identifier",
                        },
                        "loc": {
                          "end": {
                            "column": 12,
                            "line": 1,
                            "offset": 12,
                          },
                          "start": {
                            "column": 1,
                            "line": 1,
                            "offset": 1,
                          },
                        },
                        "range": [
                          1,
                          12,
                        ],
                        "start": 1,
                        "type": "ExpressionStatement",
                      },
                    ],
                    "comments": [],
                    "end": 12,
                    "loc": {
                      "end": {
                        "column": 12,
                        "line": 1,
                        "offset": 12,
                      },
                      "start": {
                        "column": 1,
                        "line": 1,
                        "offset": 1,
                      },
                    },
                    "range": [
                      1,
                      12,
                    ],
                    "sourceType": "module",
                    "start": 1,
                    "type": "Program",
                  },
                  "hProperties": {
                    "data-added": true,
                  },
                },
                "position": {
                  "end": {
                    "column": 14,
                    "line": 1,
                    "offset": 13,
                  },
                  "start": {
                    "column": 1,
                    "line": 1,
                    "offset": 0,
                  },
                },
                "type": "mdxFlowExpression",
                "value": "newVariable",
              },
            ],
            "position": {
              "end": {
                "column": 14,
                "line": 1,
                "offset": 13,
              },
              "start": {
                "column": 1,
                "line": 1,
                "offset": 0,
              },
            },
            "type": "root",
          }
        `)
    })
})