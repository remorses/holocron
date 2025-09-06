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
    expect(
      tokens.map((token) => JSON.stringify(token.raw)),
    ).toMatchInlineSnapshot(`
              [
                ""# Heading\\n\\n"",
                ""Paragraph text."",
              ]
            `)
  })

  it('tokenizes mdx JSX blocks', () => {
    const markdown = dedent(`
          # Example MDX

          <Alert type="info">

            <Nested>
              This is an info alert!
              <Child>
                Even more nested.
              </Child>
            </Nested>

          </Alert>

          <Inline/>

          > This is a paragraph <Inline/>
      `)
    const tokens = marked.lexer(markdown)
    expect(
      tokens.map((token) => JSON.stringify(token.raw)),
    ).toMatchInlineSnapshot(`
              [
                ""# Example MDX\\n\\n"",
                ""<Alert type=\\"info\\">\\n\\n"",
                ""  <Nested>\\n    This is an info alert!\\n    <Child>\\n      Even more nested.\\n    </Child>\\n  </Nested>\\n\\n"",
                ""</Alert>\\n\\n"",
                ""<Inline/>\\n\\n"",
                ""> This is a paragraph <Inline/>"",
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
    expect(
      tokens.map((token) => [token.type, JSON.stringify(token.raw)]),
    ).toMatchInlineSnapshot(`
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
