import { describe, test, expect } from 'vitest'
import { getFilesFromFilesInDraft } from './source.server'
import { getFumadocsSource } from './source'
import type { FilesInDraft } from './docs-state'
import type { DocsJsonType } from './docs-json'
import type { VirtualFile } from 'fumadocs-core/source'

describe('getFilesFromFilesInDraft', () => {
  test('converts filesInDraft to VirtualFile array', () => {
    const filesInDraft: FilesInDraft = {
      'docs/index.md': {
        content: '# Welcome',
        githubPath: 'docs/index.md',
      },
      'docs/api.mdx': {
        content: '# API Docs',
        githubPath: 'docs/api.mdx',
      },
      'docs/_meta.json': {
        content: '{"title": "Docs"}',
        githubPath: 'docs/_meta.json',
      },
    }

    const result = getFilesFromFilesInDraft(filesInDraft)

    expect(result).toHaveLength(3)
    expect(result).toContainEqual({
      path: 'docs/index.md',
      data: {},
      type: 'page',
    })
    expect(result).toContainEqual({
      path: 'docs/api.mdx',
      data: {},
      type: 'page',
    })
    expect(result).toContainEqual({
      path: 'docs/_meta.json',
      data: { title: "Docs" },
      type: 'meta',
    })
  })

  test('skips deleted files', () => {
    const filesInDraft: FilesInDraft = {
      'docs/index.md': {
        content: '# Welcome',
        githubPath: 'docs/index.md',
      },
      'docs/deleted.md': {
        content: null,
        githubPath: 'docs/deleted.md',
      },
    }

    const result = getFilesFromFilesInDraft(filesInDraft)

    expect(result).toHaveLength(1)
    expect(result[0].path).toBe('docs/index.md')
  })

  test('handles githubFolder prefix removal', () => {
    const filesInDraft: FilesInDraft = {
      'my-docs/index.md': {
        content: '# Welcome',
        githubPath: 'my-docs/index.md',
      },
    }

    const result = getFilesFromFilesInDraft(filesInDraft, 'my-docs')

    expect(result).toHaveLength(1)
    expect(result[0].path).toBe('index.md')
  })

  test('preserves frontmatter fields like notionPageId in page data', () => {
    const filesInDraft: FilesInDraft = {
      'docs/index.md': {
        content: `---
title: Welcome
notionPageId: abc123
customField: someValue
---

# Welcome`,
        githubPath: 'docs/index.md',
      },
    }

    const files = getFilesFromFilesInDraft(filesInDraft)
    const source = getFumadocsSource({
      files,
      defaultLanguage: 'en',
      languages: ['en'],
    })

    const pages = source.getPages()
    
    expect(pages).toMatchInlineSnapshot(`
      [
        {
          "absolutePath": "",
          "data": {
            "customField": "someValue",
            "notionPageId": "abc123",
            "title": "Welcome",
          },
          "file": {
            "dirname": "docs",
            "ext": ".md",
            "flattenedPath": "docs/index",
            "name": "index",
            "path": "docs/index.md",
          },
          "locale": "en",
          "path": "docs/index.md",
          "slugs": [
            "docs",
          ],
          "url": "/docs",
        },
      ]
    `)
  })
})

describe('getFumadocsSource with tabs', () => {
  const createTestFiles = (folders: string[]): VirtualFile[] => {
    const files: VirtualFile[] = []
    
    // Add root index
    files.push({
      path: 'index.mdx',
      data: { title: 'Home' },
      type: 'page',
    })
    
    // Add files for each folder WITHOUT meta.json
    folders.forEach(folder => {
      files.push({
        path: `${folder}/index.mdx`,
        data: { title: `${folder} Index` },
        type: 'page',
      })
      files.push({
        path: `${folder}/getting-started.mdx`,
        data: { title: 'Getting Started' },
        type: 'page',
      })
    })
    
    return files
  }

  // Helper function to convert tree to readable text format
  function treeToText(node: any, indent = ''): string {
    const lines: string[] = []
    
    if (node.type === 'page') {
      lines.push(`${indent}📄 ${node.name} (${node.url})`)
    } else if (node.type === 'folder') {
      const tabIndicator = node.root ? ' [TAB]' : ''
      lines.push(`${indent}📁 ${node.name}${tabIndicator}`)
      
      // Show index page if exists
      if (node.index) {
        lines.push(`${indent}  📄 [index] ${node.index.name} (${node.index.url})`)
      }
      
      if (node.children) {
        node.children.forEach((child: any) => {
          lines.push(treeToText(child, indent + '  '))
        })
      }
    } else if (node.children) {
      // Root node
      node.children.forEach((child: any) => {
        lines.push(treeToText(child, indent))
      })
    }
    
    return lines.join('\n')
  }

  test('page tree with no tabs', () => {
    const files = createTestFiles(['blog', 'changelog'])
    
    const source = getFumadocsSource({
      files,
      defaultLanguage: 'en',
      languages: ['en'],
    })
    
    const tree = source.getPageTree()
    expect(treeToText(tree)).toMatchInlineSnapshot(`
      "📄 Home (/)
      📁 blog Index
        📄 [index] blog Index (/blog)
        📄 Getting Started (/blog/getting-started)
      📁 changelog Index
        📄 [index] changelog Index (/changelog)
        📄 Getting Started (/changelog/getting-started)"
    `)
  })

  test('page tree with one tab (blog)', () => {
    const files = createTestFiles(['blog', 'changelog'])
    
    const docsJson: DocsJsonType = {
      siteId: 'test-site',
      name: 'Test Site',
      tabs: [
        {
          tab: 'Blog',
          folder: 'blog',
          description: 'Blog posts',
        },
      ],
    }
    
    const source = getFumadocsSource({
      files,
      defaultLanguage: 'en',
      languages: ['en'],
      docsJson,
    })
    
    const tree = source.getPageTree()
    expect(treeToText(tree)).toMatchInlineSnapshot(`
      "📁 Docs [TAB]
        📄 Home (/)
        📁 changelog Index
          📄 [index] changelog Index (/changelog)
          📄 Getting Started (/changelog/getting-started)
      📁 Blog [TAB]
        📄 [index] blog Index (/blog)
        📄 Getting Started (/blog/getting-started)"
    `)
  })

  test('page tree with two tabs (blog and changelog)', () => {
    const files = createTestFiles(['blog', 'changelog', 'docs'])
    
    const docsJson: DocsJsonType = {
      siteId: 'test-site', 
      name: 'Test Site',
      tabs: [
        {
          tab: 'Blog',
          folder: 'blog',
          description: 'Blog posts',
        },
        {
          tab: 'Changelog',
          folder: 'changelog',
          description: 'Release notes',
        },
      ],
    }
    
    const source = getFumadocsSource({
      files,
      defaultLanguage: 'en',
      languages: ['en'],
      docsJson,
    })
    
    const tree = source.getPageTree()
    expect(treeToText(tree)).toMatchInlineSnapshot(`
      "📁 Docs [TAB]
        📄 Home (/)
        📁 docs Index
          📄 [index] docs Index (/docs)
          📄 Getting Started (/docs/getting-started)
      📁 Blog [TAB]
        📄 [index] blog Index (/blog)
        📄 Getting Started (/blog/getting-started)
      📁 Changelog [TAB]
        📄 [index] changelog Index (/changelog)
        📄 Getting Started (/changelog/getting-started)"
    `)
  })

  test('page tree with more complex structure and nested files', () => {
    const files: VirtualFile[] = [
      // Root pages
      { path: 'index.mdx', data: { title: 'Home' }, type: 'page' },
      { path: 'about.mdx', data: { title: 'About Us' }, type: 'page' },
      { path: 'contact.mdx', data: { title: 'Contact' }, type: 'page' },
      
      // Blog with multiple posts and nested structure
      { path: 'blog/index.mdx', data: { title: 'Blog Home' }, type: 'page' },
      { path: 'blog/getting-started.mdx', data: { title: 'Getting Started' }, type: 'page' },
      { path: 'blog/advanced-tips.mdx', data: { title: 'Advanced Tips' }, type: 'page' },
      { path: 'blog/tutorials/index.mdx', data: { title: 'Tutorials' }, type: 'page' },
      { path: 'blog/tutorials/react-basics.mdx', data: { title: 'React Basics' }, type: 'page' },
      { path: 'blog/tutorials/nextjs-guide.mdx', data: { title: 'Next.js Guide' }, type: 'page' },
      
      // Docs with nested structure
      { path: 'docs/index.mdx', data: { title: 'Documentation' }, type: 'page' },
      { path: 'docs/installation.mdx', data: { title: 'Installation' }, type: 'page' },
      { path: 'docs/configuration.mdx', data: { title: 'Configuration' }, type: 'page' },
      { path: 'docs/api/index.mdx', data: { title: 'API Reference' }, type: 'page' },
      { path: 'docs/api/endpoints.mdx', data: { title: 'Endpoints' }, type: 'page' },
      { path: 'docs/api/authentication.mdx', data: { title: 'Authentication' }, type: 'page' },
      
      // Changelog
      { path: 'changelog/index.mdx', data: { title: 'Changelog' }, type: 'page' },
      { path: 'changelog/v2.mdx', data: { title: 'Version 2.0' }, type: 'page' },
      { path: 'changelog/v1.mdx', data: { title: 'Version 1.0' }, type: 'page' },
    ]
    
    const docsJson: DocsJsonType = {
      siteId: 'test-site',
      name: 'Test Site',
      tabs: [
        {
          tab: 'Blog',
          folder: 'blog',
          description: 'Blog posts and tutorials',
        },
        {
          tab: 'Changelog', 
          folder: 'changelog',
          description: 'Release notes',
        },
      ],
    }
    
    const source = getFumadocsSource({
      files,
      defaultLanguage: 'en',
      languages: ['en'],
      docsJson,
    })
    
    const tree = source.getPageTree()
    expect(treeToText(tree)).toMatchInlineSnapshot(`
      "📁 Docs [TAB]
        📄 Home (/)
        📄 About Us (/about)
        📄 Contact (/contact)
        📁 Documentation
          📄 [index] Documentation (/docs)
          📄 Configuration (/docs/configuration)
          📄 Installation (/docs/installation)
          📁 API Reference
            📄 [index] API Reference (/docs/api)
            📄 Authentication (/docs/api/authentication)
            📄 Endpoints (/docs/api/endpoints)
      📁 Blog [TAB]
        📄 [index] Blog Home (/blog)
        📄 Advanced Tips (/blog/advanced-tips)
        📄 Getting Started (/blog/getting-started)
        📁 Tutorials
          📄 [index] Tutorials (/blog/tutorials)
          📄 Next.js Guide (/blog/tutorials/nextjs-guide)
          📄 React Basics (/blog/tutorials/react-basics)
      📁 Changelog [TAB]
        📄 [index] Changelog (/changelog)
        📄 Version 1.0 (/changelog/v1)
        📄 Version 2.0 (/changelog/v2)"
    `)
  })

  test('page tree with empty tab folder', () => {
    const files: VirtualFile[] = [
      { path: 'index.mdx', data: { title: 'Home' }, type: 'page' },
      { path: 'about.mdx', data: { title: 'About' }, type: 'page' },
      
      // Blog folder exists but is empty
      
      // Docs folder with content
      { path: 'docs/index.mdx', data: { title: 'Docs Home' }, type: 'page' },
      { path: 'docs/getting-started.mdx', data: { title: 'Getting Started' }, type: 'page' },
    ]
    
    const docsJson: DocsJsonType = {
      siteId: 'test-site',
      name: 'Test Site', 
      tabs: [
        {
          tab: 'Blog',
          folder: 'blog', // This folder has no files
          description: 'Blog posts',
        },
      ],
    }
    
    const source = getFumadocsSource({
      files,
      defaultLanguage: 'en',
      languages: ['en'],
      docsJson,
    })
    
    const tree = source.getPageTree()
    expect(treeToText(tree)).toMatchInlineSnapshot(`
      "📁 Docs [TAB]
        📄 Home (/)
        📄 About (/about)
        📁 Docs Home
          📄 [index] Docs Home (/docs)
          📄 Getting Started (/docs/getting-started)"
    `)
  })

  test('page tree with tab folder that has only an index page', () => {
    const files: VirtualFile[] = [
      { path: 'index.mdx', data: { title: 'Home' }, type: 'page' },
      { path: 'about.mdx', data: { title: 'About' }, type: 'page' },
      
      // Blog folder with only index
      { path: 'blog/index.mdx', data: { title: 'Blog Home' }, type: 'page' },
      
      // Docs folder with content
      { path: 'docs/index.mdx', data: { title: 'Docs Home' }, type: 'page' },
      { path: 'docs/getting-started.mdx', data: { title: 'Getting Started' }, type: 'page' },
    ]
    
    const docsJson: DocsJsonType = {
      siteId: 'test-site',
      name: 'Test Site', 
      tabs: [
        {
          tab: 'Blog',
          folder: 'blog',
          description: 'Blog posts',
        },
      ],
    }
    
    const source = getFumadocsSource({
      files,
      defaultLanguage: 'en',
      languages: ['en'],
      docsJson,
    })
    
    const tree = source.getPageTree()
    expect(treeToText(tree)).toMatchInlineSnapshot(`
      "📁 Docs [TAB]
        📄 Home (/)
        📄 About (/about)
        📁 Docs Home
          📄 [index] Docs Home (/docs)
          📄 Getting Started (/docs/getting-started)
      📁 Blog [TAB]
        📄 [index] Blog Home (/blog)"
    `)
  })
})
