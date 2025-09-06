import { describe, it, expect } from 'vitest'
import { searchDocsWithSearchApi } from './search-api-search'
import type { FileUpdate } from './edit-tool'

describe('searchDocsWithSearchApi', () => {
  it('searches through filesInDraft using regex', async () => {
    const filesInDraft: Record<string, FileUpdate> = {
      'getting-started.mdx': {
        githubPath: 'getting-started.mdx',
        content: `---
title: Getting Started Guide
description: Learn how to get started with our platform
---

# Getting Started

Welcome to our platform! This guide will help you get started quickly.

## Installation

To install the package, run:

\`\`\`bash
npm install our-package
\`\`\`

## Configuration

Configure your settings in the config file:

\`\`\`json
{
  "apiKey": "your-api-key",
  "environment": "development"
}
\`\`\`

## Next Steps

Once you're set up, you can start using the platform features.
`,
        addedLines: 30,
        deletedLines: 0,
      },
      'api/authentication.mdx': {
        githubPath: 'api/authentication.mdx',
        content: `---
title: Authentication
description: How to authenticate with our API
---

# Authentication

Our API uses token-based authentication for secure access.

## Getting API Keys

You can get your API key from the dashboard:

1. Go to Settings
2. Navigate to API Keys section
3. Generate a new key

## Using the API Key

Include the API key in your requests:

\`\`\`bash
curl -H "Authorization: Bearer YOUR_API_KEY" https://api.example.com
\`\`\`

Remember to keep your API key secure!
`,
        addedLines: 25,
        deletedLines: 0,
      },
      'tutorials/advanced.mdx': {
        githubPath: 'tutorials/advanced.mdx',
        content: `---
title: Advanced Features
---

# Advanced Configuration

This tutorial covers advanced features and configurations.

## Custom Hooks

You can create custom hooks for specific use cases.

## Performance Optimization

Optimize your application performance with these tips.
`,
        addedLines: 15,
        deletedLines: 0,
      },
    }

    const results = await searchDocsWithSearchApi({
      query: ['API', 'key'],
      branchId: null, // No LanceDB search
      exact: false,
      filesInDraft,
    })

    expect(results).toMatchInlineSnapshot(`
          [
            {
              "content": "Authentication (Draft)",
              "id": "draft-page-api/authentication.mdx",
              "type": "page",
              "url": "/api/authentication",
            },
            {
              "basePath": "/api/authentication",
              "content": "
          ## Getting API Keys

          You can get your API key from the dashboard:",
              "fragment": "line-10",
              "id": "draft-api/authentication.mdx-166",
              "line": 10,
              "type": "text",
              "url": "/api/authentication#line-10",
            },
            {
              "basePath": "/api/authentication",
              "content": "
          You can get your API key from the dashboard:

          1. Go to Settings",
              "fragment": "line-12",
              "id": "draft-api/authentication.mdx-193",
              "line": 12,
              "type": "text",
              "url": "/api/authentication#line-12",
            },
            {
              "basePath": "/api/authentication",
              "content": "1. Go to Settings
          2. Navigate to API Keys section
          3. Generate a new key
          ",
              "fragment": "line-15",
              "id": "draft-api/authentication.mdx-255",
              "line": 15,
              "type": "text",
              "url": "/api/authentication#line-15",
            },
            {
              "basePath": "/api/authentication",
              "content": "
          ## Using the API Key

          Include the API key in your requests:",
              "fragment": "line-18",
              "id": "draft-api/authentication.mdx-308",
              "line": 18,
              "type": "text",
              "url": "/api/authentication#line-18",
            },
            {
              "basePath": "/api/authentication",
              "content": "
          Include the API key in your requests:

          \`\`\`bash",
              "fragment": "line-20",
              "id": "draft-api/authentication.mdx-329",
              "line": 20,
              "type": "text",
              "url": "/api/authentication#line-20",
            },
          ]
        `)
  })

  it('searches with case-insensitive regex', async () => {
    const filesInDraft: Record<string, FileUpdate> = {
      'example.mdx': {
        githubPath: 'example.mdx',
        content: `# Example Documentation

This is an EXAMPLE of how to use the API.
Another example shows different usage patterns.
`,
        addedLines: 4,
        deletedLines: 0,
      },
    }

    const results = await searchDocsWithSearchApi({
      query: 'example',
      branchId: null,
      exact: false,
      filesInDraft,
    })

    expect(results).toMatchInlineSnapshot(`
          [
            {
              "content": "example (Draft)",
              "id": "draft-page-example.mdx",
              "type": "page",
              "url": "/example",
            },
            {
              "basePath": "/example",
              "content": "# Example Documentation

          This is an EXAMPLE of how to use the API.",
              "fragment": "line-1",
              "id": "draft-example.mdx-2",
              "line": 1,
              "type": "text",
              "url": "/example#line-1",
            },
            {
              "basePath": "/example",
              "content": "
          This is an EXAMPLE of how to use the API.
          Another example shows different usage patterns.
          ",
              "fragment": "line-3",
              "id": "draft-example.mdx-36",
              "line": 3,
              "type": "text",
              "url": "/example#line-3",
            },
            {
              "basePath": "/example",
              "content": "This is an EXAMPLE of how to use the API.
          Another example shows different usage patterns.
          ",
              "fragment": "line-4",
              "id": "draft-example.mdx-75",
              "line": 4,
              "type": "text",
              "url": "/example#line-4",
            },
          ]
        `)
  })

  it('handles files without frontmatter', async () => {
    const filesInDraft: Record<string, FileUpdate> = {
      'simple.md': {
        githubPath: 'simple.md',
        content: `# Simple Document

This is a simple document without frontmatter.
It should still be searchable.
`,
        addedLines: 4,
        deletedLines: 0,
      },
    }

    const results = await searchDocsWithSearchApi({
      query: 'simple',
      branchId: null,
      exact: false,
      filesInDraft,
    })

    expect(results).toMatchInlineSnapshot(`
          [
            {
              "content": "simple (Draft)",
              "id": "draft-page-simple.md",
              "type": "page",
              "url": "/simple",
            },
            {
              "basePath": "/simple",
              "content": "# Simple Document

          This is a simple document without frontmatter.",
              "fragment": "line-1",
              "id": "draft-simple.md-2",
              "line": 1,
              "type": "text",
              "url": "/simple#line-1",
            },
            {
              "basePath": "/simple",
              "content": "
          This is a simple document without frontmatter.
          It should still be searchable.
          ",
              "fragment": "line-3",
              "id": "draft-simple.md-29",
              "line": 3,
              "type": "text",
              "url": "/simple#line-3",
            },
          ]
        `)
  })

  it('handles special regex characters in search query', async () => {
    const filesInDraft: Record<string, FileUpdate> = {
      'regex-test.mdx': {
        githubPath: 'regex-test.mdx',
        content: `# Regex Test

Use $.price to get the price.
Set config.* for wildcard settings.
The pattern [a-z]+ matches letters.
`,
        addedLines: 5,
        deletedLines: 0,
      },
    }

    const results = await searchDocsWithSearchApi({
      query: '$.price',
      branchId: null,
      exact: false,
      filesInDraft,
    })

    expect(results).toMatchInlineSnapshot(`
          [
            {
              "content": "regex-test (Draft)",
              "id": "draft-page-regex-test.mdx",
              "type": "page",
              "url": "/regex-test",
            },
            {
              "basePath": "/regex-test",
              "content": "
          Use $.price to get the price.
          Set config.* for wildcard settings.
          The pattern [a-z]+ matches letters.",
              "fragment": "line-3",
              "id": "draft-regex-test.mdx-18",
              "line": 3,
              "type": "text",
              "url": "/regex-test#line-3",
            },
          ]
        `)
  })

  it('returns empty results when no matches found', async () => {
    const filesInDraft: Record<string, FileUpdate> = {
      'no-match.mdx': {
        githubPath: 'no-match.mdx',
        content: `# No Match Document

This document contains different content.
Nothing here matches the search term.
`,
        addedLines: 4,
        deletedLines: 0,
      },
    }

    const results = await searchDocsWithSearchApi({
      query: 'nonexistent',
      branchId: null,
      exact: false,
      filesInDraft,
    })

    expect(results).toMatchInlineSnapshot(`[]`)
  })

  it('handles empty filesInDraft', async () => {
    const results = await searchDocsWithSearchApi({
      query: 'test',
      branchId: null,
      exact: false,
      filesInDraft: {},
    })

    expect(results).toMatchInlineSnapshot(`[]`)
  })

  it('handles files with null content', async () => {
    const filesInDraft: Record<string, FileUpdate> = {
      'empty.mdx': {
        githubPath: 'empty.mdx',
        content: null,
        addedLines: 0,
        deletedLines: 0,
      },
      'valid.mdx': {
        githubPath: 'valid.mdx',
        content: '# Valid document with searchable content',
        addedLines: 1,
        deletedLines: 0,
      },
    }

    const results = await searchDocsWithSearchApi({
      query: 'searchable',
      branchId: null,
      exact: false,
      filesInDraft,
    })

    expect(results).toMatchInlineSnapshot(`
          [
            {
              "content": "valid (Draft)",
              "id": "draft-page-valid.mdx",
              "type": "page",
              "url": "/valid",
            },
            {
              "basePath": "/valid",
              "content": "# Valid document with searchable content",
              "fragment": "line-1",
              "id": "draft-valid.mdx-22",
              "line": 1,
              "type": "text",
              "url": "/valid#line-1",
            },
          ]
        `)
  })
})
