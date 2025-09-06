import { describe, test, expect } from 'vitest'
import { cleanMarkdownContent } from './markdown-cleaner.js'

describe('cleanMarkdownContent', () => {
  test('basic markdown elements', () => {
    const markdown = `# Heading 1
## Heading 2

This is a paragraph with **bold** and *italic* text.

- List item 1
- List item 2
  - Nested item

1. Numbered item
2. Another item`

    const result = cleanMarkdownContent(markdown)
    expect(result).toMatchInlineSnapshot(`
      "Heading 1
      Heading 2
      This is a paragraph with  bold  and  italic  text.
      - List item 1
      - List item 2
        - Nested item
      1. Numbered item
      2. Another item"
    `)
  })

  test('code blocks and inline code', () => {
    const markdown = `# Code Examples

Here is some \`inline code\` in a sentence.

\`\`\`javascript
function hello() {
  console.log("Hello world");
}
\`\`\`

And some more text after the code block.`

    const result = cleanMarkdownContent(markdown)
    expect(result).toMatchInlineSnapshot(`
      "Code Examples
      Here is some  inline code  in a sentence.
      function hello() {
        console.log("Hello world");
      }
      And some more text after the code block."
    `)
  })

  test('links and images', () => {
    const markdown = `# Links and Images

Check out [this link](https://example.com) and [another one](https://test.org).

![Alt text for image](image.png)
![](empty-alt.jpg)

Here's a [reference link][1].

[1]: https://reference.com`

    const result = cleanMarkdownContent(markdown)
    expect(result).toMatchInlineSnapshot(`
      "Links and Images
      Check out  this link  and  another one .
      Alt text for image 
       
      Here's a  reference link ."
    `)
  })

  test('blockquotes and tables', () => {
    const markdown = `# Quotes and Tables

> This is a blockquote
> with multiple lines
> > And nested quotes

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |`

    const result = cleanMarkdownContent(markdown)
    expect(result).toMatchInlineSnapshot(`
        "Quotes and Tables
        This is a blockquote
        with multiple lines And nested quotes
        Header 1 Header 2
        Cell 1 Cell 2
        Cell 3 Cell 4"
      `)
  })

  test('MDX with JSX components', () => {
    const mdx = `import { Button } from './components';
import React from 'react';

# MDX Example

<Button onClick={() => alert('clicked')}>
  Click me
</Button>

Some regular text here.

<CustomComponent prop="value" />

<Card>
  <CardHeader>Title</CardHeader>
  <CardBody>
    Content inside the card
  </CardBody>
</Card>

export default function Layout({ children }) {
  return <div>{children}</div>;
}`

    const result = cleanMarkdownContent(mdx)
    expect(result).toMatchInlineSnapshot(`
      "import { Button } from './components';
      import React from 'react';
      MDX Example
      <Button onClick={() => alert('clicked')}>
        Click me
       
      Some regular text here.
      export default function Layout({ children }) {
        return   {children}  ;
      }"
    `)
  })

  test('frontmatter and metadata', () => {
    const markdown = `---
title: My Document
author: John Doe
date: 2024-01-21
---

# Actual Content

This is the document content after frontmatter.`

    const result = cleanMarkdownContent(markdown)
    expect(result).toMatchInlineSnapshot(`
      "My Document John Doe
      Actual Content
      This is the document content after frontmatter."
    `)
  })

  test('frontmatter values are extracted and included', () => {
    // Test various frontmatter formats
    const markdownWithYamlFrontmatter = `---
title: Test Page About Rockets
description: This page explains rocket science
tags: [rockets, space, science]
author: John Doe
published: true
weight: 2.0
---

# Main Content

This is the actual content.`

    const result1 = cleanMarkdownContent(markdownWithYamlFrontmatter)
    expect(result1).toMatchInlineSnapshot(`
      "Test Page About Rockets This page explains rocket science rockets space science John Doe true 2
      Main Content
      This is the actual content."
    `)

    // Test frontmatter with complex YAML
    const complexFrontmatter = `---
title: Complex Frontmatter Test
meta:
  description: A complex example
  keywords:
    - test
    - frontmatter
    - yaml
nested:
  deeply:
    nested:
      value: 42
      text: This contains important information
---

Content after complex frontmatter.`

    const result2 = cleanMarkdownContent(complexFrontmatter)
    expect(result2).toMatchInlineSnapshot(`
      "Complex Frontmatter Test A complex example test frontmatter yaml 42 This contains important information
      Content after complex frontmatter."
    `)

    // Test frontmatter only (no content after)
    const frontmatterOnly = `---
title: Just Frontmatter
description: This file only has frontmatter
---`

    const result3 = cleanMarkdownContent(frontmatterOnly)
    expect(result3).toMatchInlineSnapshot(`"Just Frontmatter This file only has frontmatter"`)

    // Test multiple dashes in frontmatter
    const frontmatterWithDashes = `---
title: Title with --- dashes
description: Also has --- in content
---

# The actual content starts here`

    const result4 = cleanMarkdownContent(frontmatterWithDashes)
    expect(result4).toMatchInlineSnapshot(`
      "Title with --- dashes Also has --- in content
      The actual content starts here"
    `)

    // Test invalid YAML frontmatter
    const invalidYamlFrontmatter = `---
title: Invalid YAML
description: [This is not valid YAML
  missing: closing bracket
tags:
  - one
  - two
  bad indentation here
---

# Content after invalid YAML

This content should not be returned.`

    const result5 = cleanMarkdownContent(invalidYamlFrontmatter)
    expect(result5).toMatchInlineSnapshot(`""`)
  })

  test('complex mixed content', () => {
    const markdown = `---
title: Complex Example
---

import { useState } from 'react';

# Complex Mixed Content

<Alert type="warning">
  This is a warning message
</Alert>

## Features

- **Bold item** with *emphasis*
- \`Code in list\`
- [Link in list](https://example.com)

\`\`\`tsx
const Component = () => {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
};
\`\`\`

> Blockquote with **formatting** and \`code\`

### Table Example

| Feature | Status |
|---------|--------|
| Search  | ✅ Done |
| Filter  | 🚧 WIP  |

<Demo>
  Interactive demo component
</Demo>

Regular paragraph with ~~strikethrough~~ text.`

    const result = cleanMarkdownContent(markdown)
    expect(result).toMatchInlineSnapshot(`
      "Complex Example
      import { useState } from 'react';
      Complex Mixed Content
      Features
      - **Bold item** with *emphasis*
      - \`Code in list\`
      - [Link in list](https://example.com)
      const Component = () => {
        const [count, setCount] = useState(0);
        return <div>{count}</div>;
      };
      Blockquote with  formatting  and  code
      Table Example
      Feature Status
      Search ✅ Done
      Filter 🚧 WIP
      Regular paragraph with  strikethrough  text."
    `)
  })

  test('HTML comments and special characters', () => {
    const markdown = `# Document

<!-- This is an HTML comment -->

Text with special characters: <>&"' and symbols: @#$%^&*()

<!-- Another comment
spanning multiple
lines -->

More content here.`

    const result = cleanMarkdownContent(markdown)
    expect(result).toMatchInlineSnapshot(`
      "Document
      Text with special characters: <>&"' and symbols: @#$%^&*()
      More content here."
    `)
  })

  test('empty and whitespace only content', () => {
    expect(cleanMarkdownContent('')).toMatchInlineSnapshot(`""`)
    expect(cleanMarkdownContent('   \n\n\t  ')).toMatchInlineSnapshot(`""`)
    expect(cleanMarkdownContent('# \n\n## \n\n')).toMatchInlineSnapshot(`""`)
  })

  test('nested markdown in lists', () => {
    const markdown = `# Nested Content

- Item with **bold** and *italic*
  - Sub-item with \`code\`
  - Another with [link](url)
- Item with image: ![alt](img.png)

1. Numbered with **formatting**
2. Another with \`inline code\``

    const result = cleanMarkdownContent(markdown)
    expect(result).toMatchInlineSnapshot(`
          "Nested Content
          - Item with **bold** and *italic*
            - Sub-item with \`code\`
            - Another with [link](url)
          - Item with image: ![alt](img.png)
          1. Numbered with **formatting**
          2. Another with \`inline code\`"
        `)
  })
})
