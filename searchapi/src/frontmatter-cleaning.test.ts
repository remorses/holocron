import { describe, test, expect, afterAll } from 'vitest'
import { SearchClient } from './sdk.js'
import type { SearchApiFile } from './types.js'

describe('frontmatter cleaning in search results', () => {
    const client = new SearchClient()
    const datasetId = `test-frontmatter-clean-${Date.now()}`
    
    afterAll(async () => {
        // Clean up the test dataset
        await client.deleteDataset({ datasetId })
    })
    
    test('frontmatter sections have cleanedSnippet with extracted YAML values', async () => {
        const files: SearchApiFile[] = [
            {
                filename: 'page-with-frontmatter.md',
                content: `---
title: Test Page About Cleaning
description: This page tests frontmatter cleaning
tags: [test, cleaning, frontmatter]
author: Test Author
---

# Content About Cleaning

This section mentions cleaning in the content.
`,
            },
        ]
        
        // Create dataset and upsert files
        await client.upsertDataset({ datasetId })
        await client.upsertFiles({ datasetId, files })
        
        // Search for "cleaning"
        const searchResults = await client.searchSections({
            datasetId,
            query: 'cleaning',
            perPage: 10,
        })
        
        expect(searchResults.results).toMatchInlineSnapshot(`
          [
            {
              "cleanedSnippet": "Test Page About Cleaning This page tests frontmatter cleaning test cleaning frontmatter Test Author",
              "filename": "page-with-frontmatter.md",
              "metadata": undefined,
              "score": 2,
              "sectionSlug": "",
              "snippet": "---
          title: Test Page About Cleaning
          description: This page tests frontmatter cleaning
          tags: [test, cleaning, frontmatter]
          author: Test Author
          ---",
              "startLine": 1,
            },
            {
              "cleanedSnippet": "Content About Cleaning
          This section mentions cleaning in the content.",
              "filename": "page-with-frontmatter.md",
              "metadata": undefined,
              "score": 1.2,
              "sectionSlug": "content-about-cleaning",
              "snippet": "# Content About Cleaning

          This section mentions cleaning in the content.",
              "startLine": 8,
            },
          ]
        `)
        
        // Find the frontmatter section
        const frontmatterSection = searchResults.results.find(r => r.sectionSlug === '')
        const contentSection = searchResults.results.find(r => r.sectionSlug === 'content-about-cleaning')
        
        // Verify frontmatter has proper cleanedSnippet with extracted text values
        expect(frontmatterSection).toBeDefined()
        expect(frontmatterSection?.cleanedSnippet).toMatchInlineSnapshot(`"Test Page About Cleaning This page tests frontmatter cleaning test cleaning frontmatter Test Author"`)
        expect(frontmatterSection?.snippet).toContain('---')
        expect(frontmatterSection?.snippet).toContain('title: Test Page About Cleaning')
        
        // Verify content section has proper cleanedSnippet
        expect(contentSection).toBeDefined()
        expect(contentSection?.cleanedSnippet).toMatchInlineSnapshot(`
          "Content About Cleaning
          This section mentions cleaning in the content."
        `)
        expect(contentSection?.cleanedSnippet).not.toContain('#')
    })
    
    test('complex frontmatter is properly cleaned', async () => {
        const files: SearchApiFile[] = [
            {
                filename: 'complex-frontmatter.md',
                content: `---
title: Complex Test
meta:
  description: Testing complex structures
  keywords:
    - test
    - complex
    - yaml
nested:
  deeply:
    nested:
      value: 42
      text: This contains the word structures
---

# Main Content

Regular content with structures mentioned.
`,
            },
        ]
        
        await client.upsertFiles({ datasetId, files })
        
        const searchResults = await client.searchSections({
            datasetId,
            query: 'structures',
            perPage: 10,
        })
        
        expect(searchResults.results).toMatchInlineSnapshot(`
          [
            {
              "cleanedSnippet": "Complex Test Testing complex structures test complex yaml 42 This contains the word structures",
              "filename": "complex-frontmatter.md",
              "metadata": undefined,
              "score": 2,
              "sectionSlug": "",
              "snippet": "---
          title: Complex Test
          meta:
            description: Testing complex structures
            keywords:
              - test
              - complex
              - yaml
          nested:
            deeply:
              nested:
                value: 42
                text: This contains the word structures
          ---",
              "startLine": 1,
            },
            {
              "cleanedSnippet": "Main Content
          Regular content with structures mentioned.",
              "filename": "complex-frontmatter.md",
              "metadata": undefined,
              "score": 1.2,
              "sectionSlug": "main-content",
              "snippet": "# Main Content

          Regular content with structures mentioned.",
              "startLine": 16,
            },
          ]
        `)
        
        // Verify both sections are found
        const frontmatterSection = searchResults.results.find(r => r.sectionSlug === '')
        const contentSection = searchResults.results.find(r => r.sectionSlug === 'main-content')
        
        // Frontmatter should have cleaned content with extracted YAML values
        expect(frontmatterSection).toBeDefined()
        expect(frontmatterSection?.cleanedSnippet).toMatchInlineSnapshot(`"Complex Test Testing complex structures test complex yaml 42 This contains the word structures"`)
        
        // Content section should have proper cleaned content
        expect(contentSection).toBeDefined()
        expect(contentSection?.cleanedSnippet).toMatchInlineSnapshot(`
          "Main Content
          Regular content with structures mentioned."
        `)
    })
    
    test('invalid YAML frontmatter returns empty cleanedSnippet', async () => {
        const files: SearchApiFile[] = [
            {
                filename: 'invalid-yaml.md',
                content: `---
title: Invalid YAML
tags:
  - one
  - two
  bad indentation
description: [unclosed bracket
---

# Valid Content Section

This section should still be searchable even though frontmatter is invalid.
`,
            },
        ]
        
        await client.upsertFiles({ datasetId, files })
        
        // First search for the frontmatter section
        const frontmatterResults = await client.searchSections({
            datasetId,
            query: 'yaml',
            perPage: 10,
        })
        
        // Then search for the content section
        const contentResults = await client.searchSections({
            datasetId,
            query: 'valid',
            perPage: 10,
        })
        
        // Find the frontmatter section with invalid YAML
        const invalidYamlFrontmatter = frontmatterResults.results.find(r => 
            r.filename === 'invalid-yaml.md' && r.sectionSlug === ''
        )
        
        // Find the content section
        const contentSection = contentResults.results.find(r => 
            r.sectionSlug === 'valid-content-section'
        )
        
        // Frontmatter with invalid YAML should have empty cleanedSnippet
        expect(invalidYamlFrontmatter).toBeDefined()
        expect(invalidYamlFrontmatter?.cleanedSnippet).toMatchInlineSnapshot(`""`)
        
        // Content section should still have proper cleanedSnippet
        expect(contentSection).toBeDefined()
        expect(contentSection?.cleanedSnippet).toMatchInlineSnapshot(`
          "Valid Content Section
          This section should still be searchable even though frontmatter is invalid."
        `)
    })
})