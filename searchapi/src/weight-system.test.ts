import { describe, test, expect, afterAll } from 'vitest'
import { SearchClient } from './sdk.js'
import type { SearchApiFile } from './types.js'

describe('weight system for search ranking', () => {
  const client = new SearchClient()
  const datasetId = `test-weights-${Date.now()}`

  afterAll(async () => {
    // Clean up the test dataset
    await client.deleteDataset({ datasetId })
  })

  test('frontmatter sections get higher weights and rank higher in search', async () => {
    const files: SearchApiFile[] = [
      {
        filename: 'page-with-frontmatter.md',
        content: `---
title: Test Page About Rockets
description: This page explains rocket science
---

# Another Section About Rockets

This section also mentions rockets but should rank lower.

## Subsection on Rockets

More content about rockets here.
`,
      },
      {
        filename: 'page-without-frontmatter.md',
        content: `# Main Section About Rockets

This is the main content about rockets without frontmatter.

## Details on Rockets

Even more rocket content here.
`,
      },
    ]

    // Create dataset and upsert files
    await client.upsertDataset({ datasetId })
    await client.upsertFiles({ datasetId, files })

    // Create indexes for better search performance
    await client.createPendingIndexes(datasetId)

    // Search for "rockets"
    const searchResults = await client.searchSections({
      datasetId,
      query: 'rockets',
      perPage: 10,
    })

    // The frontmatter section should rank first due to higher weight
    expect(searchResults.results).toMatchInlineSnapshot(`
          [
            {
              "cleanedSnippet": "Test Page About Rockets This page explains rocket science",
              "filename": "page-with-frontmatter.md",
              "metadata": undefined,
              "score": 2,
              "sectionSlug": "",
              "snippet": "---
          title: Test Page About Rockets
          description: This page explains rocket science
          ---",
              "startLine": 1,
            },
            {
              "cleanedSnippet": "Another Section About Rockets
          This section also mentions rockets but should rank lower.",
              "filename": "page-with-frontmatter.md",
              "metadata": undefined,
              "score": 1.2,
              "sectionSlug": "another-section-about-rockets",
              "snippet": "# Another Section About Rockets

          This section also mentions rockets but should rank lower.",
              "startLine": 6,
            },
            {
              "cleanedSnippet": "Subsection on Rockets
          More content about rockets here.",
              "filename": "page-with-frontmatter.md",
              "metadata": undefined,
              "score": 1.1,
              "sectionSlug": "subsection-on-rockets",
              "snippet": "## Subsection on Rockets

          More content about rockets here.",
              "startLine": 10,
            },
            {
              "cleanedSnippet": "Main Section About Rockets
          This is the main content about rockets without frontmatter.",
              "filename": "page-without-frontmatter.md",
              "metadata": undefined,
              "score": 1.2,
              "sectionSlug": "main-section-about-rockets",
              "snippet": "# Main Section About Rockets

          This is the main content about rockets without frontmatter.",
              "startLine": 1,
            },
            {
              "cleanedSnippet": "Details on Rockets
          Even more rocket content here.",
              "filename": "page-without-frontmatter.md",
              "metadata": undefined,
              "score": 1.1,
              "sectionSlug": "details-on-rockets",
              "snippet": "## Details on Rockets

          Even more rocket content here.",
              "startLine": 5,
            },
          ]
        `)

    // Verify that scores reflect the weight system
    expect(searchResults.results.length).toBeGreaterThan(0)
    if (searchResults.results.length > 1) {
      // First result should have higher score
      expect(searchResults.results[0].score).toBeGreaterThan(
        searchResults.results[1].score,
      )
    }
  })

  test('H1 sections rank higher than H2 and H3 sections', async () => {
    const files: SearchApiFile[] = [
      {
        filename: 'hierarchy-test.md',
        content: `# Primary Topic About Testing

This is the main section about testing.

## Secondary Topic About Testing  

This is a subsection about testing.

### Tertiary Topic About Testing

This is a sub-subsection about testing.

#### Fourth Level About Testing

This is even deeper about testing.
`,
      },
    ]

    await client.upsertFiles({ datasetId, files })

    // Search for "testing"
    const searchResults = await client.searchSections({
      datasetId,
      query: 'testing',
      perPage: 10,
      maxChunksPerFile: 10, // Allow more chunks to see all sections
    })

    expect(searchResults.results).toMatchInlineSnapshot(`
          [
            {
              "cleanedSnippet": "Primary Topic About Testing
          This is the main section about testing.",
              "filename": "hierarchy-test.md",
              "metadata": undefined,
              "score": 1.2,
              "sectionSlug": "primary-topic-about-testing",
              "snippet": "# Primary Topic About Testing

          This is the main section about testing.",
              "startLine": 1,
            },
            {
              "cleanedSnippet": "Secondary Topic About Testing
          This is a subsection about testing.",
              "filename": "hierarchy-test.md",
              "metadata": undefined,
              "score": 1.1,
              "sectionSlug": "secondary-topic-about-testing--",
              "snippet": "## Secondary Topic About Testing  

          This is a subsection about testing.",
              "startLine": 5,
            },
            {
              "cleanedSnippet": "Tertiary Topic About Testing
          This is a sub-subsection about testing.",
              "filename": "hierarchy-test.md",
              "metadata": undefined,
              "score": 1.05,
              "sectionSlug": "tertiary-topic-about-testing",
              "snippet": "### Tertiary Topic About Testing

          This is a sub-subsection about testing.",
              "startLine": 9,
            },
            {
              "cleanedSnippet": "Fourth Level About Testing
          This is even deeper about testing.",
              "filename": "hierarchy-test.md",
              "metadata": undefined,
              "score": 1,
              "sectionSlug": "fourth-level-about-testing",
              "snippet": "#### Fourth Level About Testing

          This is even deeper about testing.",
              "startLine": 13,
            },
          ]
        `)

    // Verify sections are returned in order of heading level (weight)
    const h1Result = searchResults.results.find(
      (r) => r.sectionSlug === 'primary-topic-about-testing',
    )
    const h2Result = searchResults.results.find(
      (r) => r.sectionSlug === 'secondary-topic-about-testing',
    )
    const h3Result = searchResults.results.find(
      (r) => r.sectionSlug === 'tertiary-topic-about-testing',
    )

    if (h1Result && h2Result) {
      expect(h1Result.score).toBeGreaterThan(h2Result.score)
    }
    if (h2Result && h3Result) {
      expect(h2Result.score).toBeGreaterThan(h3Result.score)
    }
  })

  test('all frontmatter sections get weight 2.0', async () => {
    const files: SearchApiFile[] = [
      {
        filename: 'with-title.md',
        content: `---
title: Important Document About Weights
author: Test Author
---

# Section About Weights

Content about weights.
`,
      },
      {
        filename: 'without-title.md',
        content: `---
author: Another Author
tags: [weights, testing]
---

# Main Content About Weights

More content about weights.
`,
      },
    ]

    await client.upsertFiles({ datasetId, files })

    const searchResults = await client.searchSections({
      datasetId,
      query: 'weights',
      perPage: 10,
    })

    expect(searchResults.results).toMatchInlineSnapshot(`
          [
            {
              "cleanedSnippet": "Important Document About Weights Test Author",
              "filename": "with-title.md",
              "metadata": undefined,
              "score": 2,
              "sectionSlug": "",
              "snippet": "---
          title: Important Document About Weights
          author: Test Author
          ---",
              "startLine": 1,
            },
            {
              "cleanedSnippet": "Section About Weights
          Content about weights.",
              "filename": "with-title.md",
              "metadata": undefined,
              "score": 1.2,
              "sectionSlug": "section-about-weights",
              "snippet": "# Section About Weights

          Content about weights.",
              "startLine": 6,
            },
            {
              "cleanedSnippet": "Another Author weights testing",
              "filename": "without-title.md",
              "metadata": undefined,
              "score": 2,
              "sectionSlug": "",
              "snippet": "---
          author: Another Author
          tags: [weights, testing]
          ---",
              "startLine": 1,
            },
            {
              "cleanedSnippet": "Main Content About Weights
          More content about weights.",
              "filename": "without-title.md",
              "metadata": undefined,
              "score": 1.2,
              "sectionSlug": "main-content-about-weights",
              "snippet": "# Main Content About Weights

          More content about weights.",
              "startLine": 6,
            },
          ]
        `)

    // All frontmatter sections should have weight 2.0
    const frontmatterSections = searchResults.results.filter(
      (r) => r.sectionSlug === '',
    )

    for (const section of frontmatterSections) {
      expect(section.score).toBe(2.0)
    }
  })
})
