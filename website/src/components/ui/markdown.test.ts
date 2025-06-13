import { describe, it, expect } from 'vitest'
import { marked } from 'marked'
import dedent from 'string-dedent'

describe('marked.lexer', () => {
    it('tokenizes a simple markdown string', () => {
        const markdown = dedent(`
            # Heading

            Paragraph text.
        `)
        const tokens = marked.lexer(markdown)
        expect(tokens.map((token) => JSON.stringify(token.raw)))
            .toMatchInlineSnapshot(`
              [
                ""# Heading\\n\\n"",
                ""Paragraph text."",
              ]
            `)
    })

    it('tokenizes lists and links', () => {
        const markdown = dedent(`
          # Here is a list
            - [Link](http://example.com)
            - Item 2

          this is a paragraph later on

          > this is a quote

          a long code block

          \`\`\`
          some code

          and more
          \`\`\`
        `)
        const tokens = marked.lexer(markdown)
        expect(tokens.map((token) => [token.type, JSON.stringify(token.raw)]))
            .toMatchInlineSnapshot(`
              [
                [
                  "heading",
                  ""# Here is a list\\n"",
                ],
                [
                  "list",
                  ""  - [Link](http://example.com)\\n  - Item 2"",
                ],
                [
                  "space",
                  ""\\n\\n"",
                ],
                [
                  "paragraph",
                  ""this is a paragraph later on"",
                ],
                [
                  "space",
                  ""\\n\\n"",
                ],
                [
                  "blockquote",
                  ""> this is a quote"",
                ],
                [
                  "space",
                  ""\\n\\n"",
                ],
                [
                  "paragraph",
                  ""a long code block"",
                ],
                [
                  "space",
                  ""\\n\\n"",
                ],
                [
                  "code",
                  ""\`\`\`\\nsome code\\n\\nand more\\n\`\`\`"",
                ],
              ]
            `)
    })
})
