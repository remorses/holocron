import { describe, test, expect } from 'vitest';
import { parseMarkdownIntoSections, isSupportedMarkdownFile } from './markdown-parser.js';

describe('parseMarkdownIntoSections', () => {
  test('handles frontmatter', () => {
    const content = `---
title: My Document
author: John Doe
date: 2024-01-01
tags: [test, documentation]
---

# Introduction

This is the intro section.

## Getting Started

Here's how to get started.`;

    const result = parseMarkdownIntoSections(content);
    
    expect(result.sections).toMatchInlineSnapshot(`
      [
        {
          "content": "title: My Document
      author: John Doe
      date: 2024-01-01
      tags: [test, documentation]",
          "heading": "",
          "isFrontmatter": true,
          "level": 0,
          "orderIndex": 0,
          "startLine": 1,
          "weight": 2,
        },
        {
          "content": "This is the intro section.",
          "heading": "Introduction",
          "level": 1,
          "orderIndex": 1,
          "startLine": 9,
        },
        {
          "content": "Here's how to get started.",
          "heading": "Getting Started",
          "level": 2,
          "orderIndex": 2,
          "startLine": 13,
        },
      ]
    `);
  });
  test('parses simple markdown with headings', () => {
    const content = `# Introduction

This is the intro section.

## Getting Started

Here's how to get started:

- Step 1
- Step 2

### Installation

Run the following command:

\`\`\`bash
npm install
\`\`\`

## Configuration

Set up your config file.`;

    const result = parseMarkdownIntoSections(content);

    expect(result.sections).toMatchInlineSnapshot(`
      [
        {
          "content": "This is the intro section.",
          "heading": "Introduction",
          "level": 1,
          "orderIndex": 0,
          "startLine": 1,
        },
        {
          "content": "Here's how to get started:

      - Step 1
      - Step 2",
          "heading": "Getting Started",
          "level": 2,
          "orderIndex": 1,
          "startLine": 5,
        },
        {
          "content": "Run the following command:

      \`\`\`bash
      npm install
      \`\`\`",
          "heading": "Installation",
          "level": 3,
          "orderIndex": 2,
          "startLine": 12,
        },
        {
          "content": "Set up your config file.",
          "heading": "Configuration",
          "level": 2,
          "orderIndex": 3,
          "startLine": 20,
        },
      ]
    `);
  });

  test('handles markdown without any headings', () => {
    const content = `This is just some text.

With multiple paragraphs.

And some **formatting**.`;

    const result = parseMarkdownIntoSections(content);

    expect(result.sections).toMatchInlineSnapshot(`
      [
        {
          "content": "This is just some text.

      With multiple paragraphs.

      And some **formatting**.",
          "heading": "Introduction",
          "level": 1,
          "orderIndex": 0,
          "startLine": 1,
        },
      ]
    `);
  });

  test('handles empty content', () => {
    const result = parseMarkdownIntoSections('');
    
    expect(result.sections).toMatchInlineSnapshot(`[]`);
  });

  test('handles markdown with code blocks and tables', () => {
    const content = `# API Reference

This section covers the API.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /users | List users |
| POST | /users | Create user |

### Code Example

\`\`\`javascript
const user = await api.getUser(123);
console.log(user.name);
\`\`\`

## Response Format

All responses are in JSON format.`;

    const result = parseMarkdownIntoSections(content);

    expect(result.sections).toMatchInlineSnapshot(`
      [
        {
          "content": "This section covers the API.",
          "heading": "API Reference",
          "level": 1,
          "orderIndex": 0,
          "startLine": 1,
        },
        {
          "content": "| Method | Path | Description |
      | --- | --- | --- |
      | GET | /users | List users |
      | POST | /users | Create user |",
          "heading": "Endpoints",
          "level": 2,
          "orderIndex": 1,
          "startLine": 5,
        },
        {
          "content": "\`\`\`javascript
      const user = await api.getUser(123);
      console.log(user.name);
      \`\`\`",
          "heading": "Code Example",
          "level": 3,
          "orderIndex": 2,
          "startLine": 12,
        },
        {
          "content": "All responses are in JSON format.",
          "heading": "Response Format",
          "level": 2,
          "orderIndex": 3,
          "startLine": 19,
        },
      ]
    `);
  });

  test('preserves heading levels and order', () => {
    const content = `# Level 1

Content 1

## Level 2

Content 2

### Level 3

Content 3

## Another Level 2

Content 4`;

    const result = parseMarkdownIntoSections(content);

    expect(result.totalSections).toBe(4);
    expect(result.sections[0].level).toBe(1);
    expect(result.sections[1].level).toBe(2);
    expect(result.sections[2].level).toBe(3);
    expect(result.sections[3].level).toBe(2);
    
    expect(result.sections.map(s => s.orderIndex)).toEqual([0, 1, 2, 3]);
  });

  test('handles markdown with blockquotes and lists', () => {
    const content = `# Notes

Some important information:

> This is a blockquote
> with multiple lines

## Todo List

1. First item
2. Second item
3. Third item

- Bullet point 1
- Bullet point 2`;

    const result = parseMarkdownIntoSections(content);

    expect(result.sections).toMatchInlineSnapshot(`
      [
        {
          "content": "Some important information:

      > This is a blockquote
      with multiple lines",
          "heading": "Notes",
          "level": 1,
          "orderIndex": 0,
          "startLine": 1,
        },
        {
          "content": "1. First item
      2. Second item
      3. Third item

      - Bullet point 1
      - Bullet point 2",
          "heading": "Todo List",
          "level": 2,
          "orderIndex": 1,
          "startLine": 8,
        },
      ]
    `);
  });

  test('handles MDX with JSX imports and components', () => {
    const mdxContent = `---
title: Advanced MDX Example
---

import { Button, Card } from '@/components/ui'
import CustomChart from './CustomChart'

# MDX with JSX Components

This MDX file demonstrates how sections are split with JSX content.

<Card className="mb-4">
  <h2>Interactive Card</h2>
  
  <p>Content inside JSX components with newlines.</p>
  
  <Button 
    variant="primary"
    onClick={() => console.log('clicked')}
  >
    Click Me
  </Button>
</Card>

## Code Examples

Here's a React component within MDX:

<CustomChart
  data={[
    { x: 1, y: 2 },
    { x: 2, y: 4 },
    { x: 3, y: 6 }
  ]}
  
  options={{
    title: "Sample Chart",
    showGrid: true
  }}
/>

### Inline JSX

You can also use inline JSX: <Button size="small">Inline</Button> within text.

## Mixed Content

Regular markdown content follows:

\`\`\`jsx
// Code block example
function Component() {
  return (
    <div>
      <h1>Hello</h1>
      
      <p>World</p>
    </div>
  )
}
\`\`\`

<Card>
  <p>Another JSX block after code</p>
</Card>

## Conclusion

MDX allows mixing markdown and JSX seamlessly.`;

    const result = parseMarkdownIntoSections(mdxContent);

    expect(result.sections).toMatchInlineSnapshot(`
      [
        {
          "content": "title: Advanced MDX Example",
          "heading": "",
          "isFrontmatter": true,
          "level": 0,
          "orderIndex": 0,
          "startLine": 1,
          "weight": 2,
        },
        {
          "content": "import { Button, Card } from '@/components/ui'
      import CustomChart from './CustomChart'",
          "heading": "Introduction",
          "level": 1,
          "orderIndex": 1,
          "startLine": 5,
        },
        {
          "content": "This MDX file demonstrates how sections are split with JSX content.

      <Card className="mb-4">
        <h2>Interactive Card</h2>
        

        <p>Content inside JSX components with newlines.</p>
        

        <Button 
          variant="primary"
          onClick={() => console.log('clicked')}

      > 

      \`\`\`
      Click Me
      \`\`\`

        </Button>
      </Card>",
          "heading": "MDX with JSX Components",
          "level": 1,
          "orderIndex": 2,
          "startLine": 9,
        },
        {
          "content": "Here's a React component within MDX:

      <CustomChart
        data={[
          { x: 1, y: 2 },
          { x: 2, y: 4 },
          { x: 3, y: 6 }
        ]}

        options={{
          title: "Sample Chart",
          showGrid: true
        }}
      />",
          "heading": "Code Examples",
          "level": 2,
          "orderIndex": 3,
          "startLine": 26,
        },
        {
          "content": "You can also use inline JSX: <Button size="small">Inline</Button> within text.",
          "heading": "Inline JSX",
          "level": 3,
          "orderIndex": 4,
          "startLine": 43,
        },
        {
          "content": "Regular markdown content follows:

      \`\`\`jsx
      // Code block example
      function Component() {
        return (
          <div>
            <h1>Hello</h1>
            
            <p>World</p>
          </div>
        )
      }
      \`\`\`

      <Card>
        <p>Another JSX block after code</p>
      </Card>",
          "heading": "Mixed Content",
          "level": 2,
          "orderIndex": 5,
          "startLine": 47,
        },
        {
          "content": "MDX allows mixing markdown and JSX seamlessly.",
          "heading": "Conclusion",
          "level": 2,
          "orderIndex": 6,
          "startLine": 68,
        },
      ]
    `);

    // Find the actual sections with JSX content
    const jsxSection = result.sections.find(s => s.heading === "MDX with JSX Components");
    const codeExamplesSection = result.sections.find(s => s.heading === "Code Examples");
    const inlineJsxSection = result.sections.find(s => s.heading === "Inline JSX");
    const mixedContentSection = result.sections.find(s => s.heading === "Mixed Content");

    // Verify that JSX is preserved in sections
    expect(jsxSection?.content).toContain('<Card className="mb-4">');
    expect(jsxSection?.content).toContain('<Button');
    expect(codeExamplesSection?.content).toContain('<CustomChart');
    expect(inlineJsxSection?.content).toContain('<Button size="small">Inline</Button>');
    expect(mixedContentSection?.content).toContain('<Card>');

    // Verify the parser handled frontmatter correctly
    const frontmatterSection = result.sections.find(s => s.isFrontmatter === true);
    expect(frontmatterSection).toBeDefined();
    expect(frontmatterSection?.heading).toBe('');
    expect(frontmatterSection?.weight).toBe(2);

    // Imports become part of the Introduction section
    const introSection = result.sections.find(s => s.heading === "Introduction");
    expect(introSection?.content).toContain("import { Button, Card }");
  });
});

describe('isSupportedMarkdownFile', () => {
  test('recognizes supported markdown extensions', () => {
    expect(isSupportedMarkdownFile('README.md')).toBe(true);
    expect(isSupportedMarkdownFile('docs/guide.md')).toBe(true);
    expect(isSupportedMarkdownFile('component.mdx')).toBe(true);
    expect(isSupportedMarkdownFile('path/to/file.MDX')).toBe(true);
  });

  test('rejects unsupported file extensions', () => {
    expect(isSupportedMarkdownFile('script.js')).toBe(false);
    expect(isSupportedMarkdownFile('style.css')).toBe(false);
    expect(isSupportedMarkdownFile('data.json')).toBe(false);
    expect(isSupportedMarkdownFile('document.txt')).toBe(false);
    expect(isSupportedMarkdownFile('file_without_extension')).toBe(false);
  });
});