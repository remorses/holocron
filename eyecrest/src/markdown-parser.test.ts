import { describe, test, expect } from 'vitest';
import { parseMarkdownIntoSections, isSupportedMarkdownFile } from './markdown-parser.js';

describe('parseMarkdownIntoSections', () => {
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
        },
        {
          "content": "Here's how to get started:

      - Step 1
      - Step 2",
          "heading": "Getting Started",
          "level": 2,
          "orderIndex": 1,
        },
        {
          "content": "Run the following command:

      \`\`\`bash
      npm install
      \`\`\`",
          "heading": "Installation",
          "level": 3,
          "orderIndex": 2,
        },
        {
          "content": "Set up your config file.",
          "heading": "Configuration",
          "level": 2,
          "orderIndex": 3,
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
        },
        {
          "content": "| Method | Path | Description |
      | --- | --- | --- |
      | GET | /users | List users |
      | POST | /users | Create user |",
          "heading": "Endpoints",
          "level": 2,
          "orderIndex": 1,
        },
        {
          "content": "\`\`\`javascript
      const user = await api.getUser(123);
      console.log(user.name);
      \`\`\`",
          "heading": "Code Example",
          "level": 3,
          "orderIndex": 2,
        },
        {
          "content": "All responses are in JSON format.",
          "heading": "Response Format",
          "level": 2,
          "orderIndex": 3,
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
        },
      ]
    `);
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