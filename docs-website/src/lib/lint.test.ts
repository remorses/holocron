import { describe, test, expect } from 'vitest'
import { validateMarkdownLinks, formatErrorWithContext, createFormattedError } from './lint'
import { getProcessor } from './mdx-heavy'

describe('validateMarkdownLinks', () => {
  const processor = getProcessor({ extension: 'md' })

  test('detects invalid internal links', async () => {
    const content = `
# Test Document

Here is a [valid link](/docs/getting-started) and an [invalid link](/docs/non-existent).

Also a [relative link](./relative-path) that doesn't exist.
`
    const tree = processor.parse({ value: content })
    const validSlugs = ['/docs/getting-started', '/docs/installation']

    const errors = await validateMarkdownLinks(tree, {
      validSlugs,
      resolveDir: '/docs',
    })

    expect(errors).toMatchInlineSnapshot(`
          [
            {
              "column": 54,
              "line": 4,
              "reason": "Link to "/docs/non-existent" not found in valid slugs",
              "url": "/docs/non-existent",
            },
            {
              "column": 8,
              "line": 6,
              "reason": "Link to "/docs/relative-path" not found in valid slugs",
              "url": "./relative-path",
            },
          ]
        `)
  })

  test('ignores external URLs', async () => {
    const content = `
# Test Document

External links like [Google](https://google.com) and [GitHub](http://github.com) should be ignored.
`
    const tree = processor.parse({ value: content })
    const validSlugs = ['/docs/getting-started']

    const errors = await validateMarkdownLinks(tree, { validSlugs })

    expect(errors).toMatchInlineSnapshot(`[]`)
  })

  test('ignores mailto links', async () => {
    const content = `
# Test Document

Contact us at [email](mailto:test@example.com).
`
    const tree = processor.parse({ value: content })
    const validSlugs = ['/docs/getting-started']

    const errors = await validateMarkdownLinks(tree, { validSlugs })

    expect(errors).toMatchInlineSnapshot(`[]`)
  })

  test('ignores anchor-only links', async () => {
    const content = `
# Test Document

Jump to [section](#some-section) on this page.
`
    const tree = processor.parse({ value: content })
    const validSlugs = ['/docs/getting-started']

    const errors = await validateMarkdownLinks(tree, { validSlugs })

    expect(errors).toMatchInlineSnapshot(`[]`)
  })

  test('handles links with fragments and query params', async () => {
    const content = `
# Test Document

Link with fragment: [valid with hash](/docs/getting-started#section)
Link with query: [valid with query](/docs/getting-started?tab=1)
Link with both: [valid with both](/docs/getting-started?tab=1#section)

Invalid with fragment: [invalid](/docs/non-existent#section)
`
    const tree = processor.parse({ value: content })
    const validSlugs = ['/docs/getting-started']

    const errors = await validateMarkdownLinks(tree, { validSlugs })

    expect(errors).toMatchInlineSnapshot(`
          [
            {
              "column": 24,
              "line": 8,
              "reason": "Link to "/docs/non-existent" not found in valid slugs",
              "url": "/docs/non-existent#section",
            },
          ]
        `)
  })

  test('validates all valid links correctly', async () => {
    const content = `
# Test Document

- [Home](/)
- [Docs](/docs)
- [Getting Started](/docs/getting-started)
- [Installation](/docs/installation)
- [API Reference](/api/reference)
`
    const tree = processor.parse({ value: content })
    const validSlugs = ['/', '/docs', '/docs/getting-started', '/docs/installation', '/api/reference']

    const errors = await validateMarkdownLinks(tree, { validSlugs })

    expect(errors).toMatchInlineSnapshot(`[]`)
  })

  test('resolves relative paths with resolveDir', async () => {
    const content = `
# Test Document

- [Parent](../)
- [Current](./)
- [Sibling](./sibling)
- [Child](./child/page)
- [Parent sibling](../other)
- [Escape attempt](../../outside)
`
    const tree = processor.parse({ value: content })
    const validSlugs = ['/', '/docs', '/docs/guide', '/docs/guide/sibling', '/docs/guide/child/page', '/docs/other']

    const errors = await validateMarkdownLinks(tree, {
      validSlugs,
      resolveDir: '/docs/guide',
    })

    expect(errors).toMatchInlineSnapshot(`
          [
            {
              "column": 3,
              "line": 9,
              "reason": "Link to "/outside" not found in valid slugs",
              "url": "../../outside",
            },
          ]
        `)
  })

  test('errors on relative paths without resolveDir', async () => {
    const content = `
# Test Document

[Relative link](./relative)
`
    const tree = processor.parse({ value: content })
    const validSlugs = ['/docs/relative']

    const errors = await validateMarkdownLinks(tree, { validSlugs })

    expect(errors).toMatchInlineSnapshot(`
          [
            {
              "column": 1,
              "line": 4,
              "reason": "Cannot resolve relative path "./relative" without resolveDir",
              "url": "./relative",
            },
          ]
        `)
  })
})

describe('formatErrorWithContext', () => {
  test('formats error with context lines', () => {
    const content = `Line 1
Line 2
Line 3 with error here
Line 4
Line 5`

    const error = new Error('Something went wrong') as any
    error.line = 3
    error.column = 14

    const formatted = formatErrorWithContext(error, content, 'Test Error')

    expect(formatted).toMatchInlineSnapshot(`
          "Test Error at line 3, column 14:
          Something went wrong

          Error Context:
            1 | Line 1
            2 | Line 2
            3 | Line 3 with error here
                            ^
            4 | Line 4
            5 | Line 5
          "
        `)
  })

  test('formats error at beginning of file', () => {
    const content = `First line with error
Second line
Third line`

    const error = new Error('Invalid syntax') as any
    error.line = 1
    error.column = 7

    const formatted = formatErrorWithContext(error, content, 'Syntax Error')

    expect(formatted).toMatchInlineSnapshot(`
          "Syntax Error at line 1, column 7:
          Invalid syntax

          Error Context:
            1 | First line with error
                     ^
            2 | Second line
            3 | Third line
          "
        `)
  })

  test('formats error at end of file', () => {
    const content = `Line 1
Line 2
Line 3
Line 4
Last line with error`

    const error = new Error('Unexpected end') as any
    error.line = 5
    error.column = 11

    const formatted = formatErrorWithContext(error, content)

    expect(formatted).toMatchInlineSnapshot(`
          "Error at line 5, column 11:
          Unexpected end

          Error Context:
            1 | Line 1
            2 | Line 2
            3 | Line 3
            4 | Line 4
            5 | Last line with error
                         ^
          "
        `)
  })

  test('handles error with position object', () => {
    const content = `Some content
Error line here
More content`

    const error = new Error('Position error') as any
    error.position = {
      start: {
        line: 2,
        column: 7,
      },
    }

    const formatted = formatErrorWithContext(error, content, 'MDX Error')

    expect(formatted).toMatchInlineSnapshot(`
          "MDX Error at line 2, column 7:
          Position error

          Error Context:
            1 | Some content
            2 | Error line here
                     ^
            3 | More content
          "
        `)
  })
})

describe('createFormattedError', () => {
  test('creates error with formatted message', () => {
    const content = `Line 1
Line 2 with error
Line 3`

    const error = new Error('Original error') as any
    error.line = 2
    error.column = 8
    error.reason = 'Invalid token'

    const formattedError = createFormattedError(
      error,
      content,
      'Parse Error',
      'Please fix the syntax error and try again.',
    )

    expect(formattedError.line).toBe(2)
    expect(formattedError.column).toBe(8)
    expect(formattedError.reason).toBe('Invalid token')
    expect(formattedError.message).toMatchInlineSnapshot(`
          "Parse Error at line 2, column 8:
          Invalid token

          Error Context:
            1 | Line 1
            2 | Line 2 with error
                      ^
            3 | Line 3

          Please fix the syntax error and try again."
        `)
  })

  test('formats link validation errors', () => {
    const content = `# Documentation

Here is a [broken link](/docs/missing) in the text.

And another [invalid link](../escape) that goes outside.`

    const linkError = new Error('Found 2 invalid links in the markdown') as any
    linkError.line = 3
    linkError.column = 11
    linkError.reason = 'Line 3: "/docs/missing" - Link not found\nLine 5: "../escape" - Path escapes root'

    const formatted = formatErrorWithContext(linkError, content, 'Link Validation Error')

    expect(formatted).toMatchInlineSnapshot(`
      "Link Validation Error at line 3, column 11:
      Line 3: "/docs/missing" - Link not found
      Line 5: "../escape" - Path escapes root

      Error Context:
        1 | # Documentation
        2 | 
        3 | Here is a [broken link](/docs/missing) in the text.
                     ^
        4 | 
        5 | And another [invalid link](../escape) that goes outside.
      "
    `)
  })

  test('formats MDX parsing errors', () => {
    const content = `---
title: Test Page
---

# Header

<Component prop={invalid syntax} />

Some more content here`

    const mdxError = new Error('Unexpected token') as any
    mdxError.line = 7
    mdxError.column = 26
    mdxError.reason = 'Expected "}" but found "syntax"'

    const formatted = formatErrorWithContext(mdxError, content, 'MDX Compilation Error')

    expect(formatted).toMatchInlineSnapshot(`
      "MDX Compilation Error at line 7, column 26:
      Expected "}" but found "syntax"

      Error Context:
        2 | title: Test Page
        3 | ---
        4 | 
        5 | # Header
        6 | 
        7 | <Component prop={invalid syntax} />
                                    ^
        8 | 
        9 | Some more content here
      "
    `)
  })

  test('formats JSON syntax errors', () => {
    const content = `{
  "name": "test",
  "version": "1.0.0",
  "invalid": true,
}`

    const jsonError = new Error('Unexpected token } in JSON at position 52') as any
    jsonError.line = 5
    jsonError.column = 1

    const formatted = formatErrorWithContext(jsonError, content, 'JSON Parse Error')

    expect(formatted).toMatchInlineSnapshot(`
          "JSON Parse Error at line 5, column 1:
          Unexpected token } in JSON at position 52

          Error Context:
            1 | {
            2 |   "name": "test",
            3 |   "version": "1.0.0",
            4 |   "invalid": true,
            5 | }
               ^
          "
        `)
  })

  test('handles very long content with error in middle', () => {
    const lines: string[] = []
    for (let i = 1; i <= 20; i++) {
      lines.push(`Line ${i}`)
    }
    const content = lines.join('\n')

    const error = new Error('Error in the middle') as any
    error.line = 10
    error.column = 3

    const formatted = formatErrorWithContext(error, content, 'Test Error')

    // Should show 5 lines before and after
    expect(formatted).toMatchInlineSnapshot(`
          "Test Error at line 10, column 3:
          Error in the middle

          Error Context:
            5 | Line 5
            6 | Line 6
            7 | Line 7
            8 | Line 8
            9 | Line 9
           10 | Line 10
                 ^
           11 | Line 11
           12 | Line 12
           13 | Line 13
           14 | Line 14
           15 | Line 15
          "
        `)
  })
})
