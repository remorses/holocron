import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { SearchClient } from './sdk.js'

// Use a unique dataset ID for each test run
const datasetId = `test-lancedb-sdk-${Date.now()}`

describe('LanceDB SDK Implementation', () => {
    // Initialize client with LanceDB provider
    const client = new SearchClient({
        provider: 'lancedb',
        dbPath: './test-lancedb' // Use a test-specific path
    })
    
    afterAll(async () => {
        // Cleanup: delete the test dataset
        try {
            await client.deleteDataset({ datasetId })
            console.log(`✅ Cleaned up test dataset: ${datasetId}`)
        } catch (error) {
            console.warn(`Failed to cleanup dataset: ${error}`)
        }
    })
    
    test('should create a dataset', async () => {
        await client.upsertDataset({ datasetId })
        // If no error is thrown, dataset was created successfully
        expect(true).toBe(true)
    })
    
    test('should upload markdown files', async () => {
        const testFiles = [
            {
                filename: 'README.md',
                content: `# LanceDB Test Documentation

## Overview
This is a test document for the LanceDB implementation.

## Features
- Vector search capabilities
- Markdown parsing
- Section extraction

## Getting Started
To use this SDK, first install the package:

\`\`\`bash
npm install @searchapi/sdk
\`\`\`

## API Reference
The SDK provides several methods for managing datasets.

### Creating a Dataset
Use the \`upsertDataset\` method to create a new dataset.

### Uploading Files
Files can be uploaded using the \`upsertFiles\` method.

### Searching
Search functionality is available through the \`searchSections\` method.
`,
                weight: 1.0,
                metadata: { category: 'documentation' }
            },
            {
                filename: 'guide.md',
                content: `# User Guide

## Installation
Follow these steps to install the LanceDB SDK.

## Configuration
Configure your API key and database path.

## Examples
Here are some examples of using the SDK:

### Example 1: Basic Setup
\`\`\`typescript
const client = new SearchClient({
    token: 'your-api-key',
    provider: 'lancedb'
})
\`\`\`

### Example 2: Creating a Dataset
\`\`\`typescript
await client.upsertDataset({
    datasetId: 'my-dataset',
    orgId: 'my-org'
})
\`\`\`

## Troubleshooting
Common issues and solutions.
`,
                weight: 1.0,
                metadata: { category: 'guide' }
            },
            {
                filename: 'api-docs.mdx',
                content: `# API Documentation

## Introduction
Complete API reference for the LanceDB SDK.

## Methods

### upsertDataset
Creates or updates a dataset.

### upsertFiles
Uploads files to a dataset.

### searchSections
Searches through document sections.

### getFileContents
Retrieves file contents from the dataset.

## Error Handling
All methods return promises and may throw errors.

## Rate Limits
Please observe API rate limits.
`,
                weight: 1.5, // Higher weight for API docs
                metadata: { category: 'api', priority: 'high' }
            }
        ]
        
        await client.upsertFiles({
            datasetId,
            files: testFiles
        })
        
        // Verify files were uploaded by checking dataset size
        const size = await client.getDatasetSize({ datasetId })
        
        expect(size.fileCount).toBe(3)
        expect(size.sectionCount).toBeGreaterThan(0)
        expect(size.uploadedContentSizeBytes).toBeGreaterThan(0)
    })
    
    test('should retrieve file contents', async () => {
        const result = await client.getFileContents({
            datasetId,
            filePath: 'README.md'
        })
        
        expect(result.files).toHaveLength(1)
        expect(result.files[0].filename).toBe('README.md')
        expect(result.files[0].content).toContain('LanceDB Test Documentation')
        expect(result.files[0].sha).toBeDefined()
        expect(result.files[0].metadata).toEqual({ category: 'documentation' })
    })
    
    test('should retrieve file with line numbers', async () => {
        const result = await client.getFileContents({
            datasetId,
            filePath: 'guide.md',
            showLineNumbers: true,
            start: 1,
            end: 5
        })
        
        expect(result.files).toHaveLength(1)
        const content = result.files[0].content
        expect(content).toContain('1  # User Guide')
        expect(content.split('\n')).toHaveLength(5)
    })
    
    test('should retrieve all files', async () => {
        const result = await client.getFileContents({
            datasetId,
            getAllFiles: true
        })
        
        expect(result.files).toHaveLength(3)
        const filenames = result.files.map(f => f.filename).sort()
        expect(filenames).toEqual(['README.md', 'api-docs.mdx', 'guide.md'])
    })
    
    test('should search sections', async () => {
        // Search for "SDK"
        const searchResult = await client.searchSections({
            datasetId,
            query: 'SDK',
            page: 0,
            perPage: 10
        })
        
        expect(searchResult.results.length).toBeGreaterThan(0)
        expect(searchResult.results[0].snippet).toBeDefined()
        expect(searchResult.results[0].cleanedSnippet).toBeDefined()
        expect(searchResult.results[0].filename).toBeDefined()
        expect(searchResult.results[0].sectionSlug).toBeDefined()
        
        // Verify search results contain the query term
        const hasSDK = searchResult.results.some(r => 
            r.snippet.toLowerCase().includes('sdk') || 
            r.cleanedSnippet.toLowerCase().includes('sdk')
        )
        expect(hasSDK).toBe(true)
    })
    
    test('should search with pagination', async () => {
        // First page
        const page1 = await client.searchSections({
            datasetId,
            query: 'the',
            page: 0,
            perPage: 5
        })
        
        expect(page1.page).toBe(0)
        expect(page1.perPage).toBe(5)
        expect(page1.results.length).toBeLessThanOrEqual(5)
        
        // Second page if available
        if (page1.hasNextPage) {
            const page2 = await client.searchSections({
                datasetId,
                query: 'the',
                page: 1,
                perPage: 5
            })
            
            expect(page2.page).toBe(1)
            // Results should be different
            const page1Slugs = page1.results.map(r => r.sectionSlug)
            const page2Slugs = page2.results.map(r => r.sectionSlug)
            const overlap = page1Slugs.filter(s => page2Slugs.includes(s))
            expect(overlap.length).toBe(0)
        }
    })
    
    test('should limit chunks per file', async () => {
        const result = await client.searchSections({
            datasetId,
            query: 'a', // Common word to get many results
            maxChunksPerFile: 2,
            perPage: 20
        })
        
        // Count sections per file
        const fileCount: Record<string, number> = {}
        result.results.forEach(r => {
            fileCount[r.filename] = (fileCount[r.filename] || 0) + 1
        })
        
        // No file should have more than 2 sections
        Object.values(fileCount).forEach(count => {
            expect(count).toBeLessThanOrEqual(2)
        })
    })
    
    test('should delete specific files', async () => {
        // First verify the file exists
        const beforeDelete = await client.getFileContents({
            datasetId,
            filePath: 'guide.md'
        })
        expect(beforeDelete.files).toHaveLength(1)
        
        // Delete the file
        await client.deleteFiles({
            datasetId,
            filenames: ['guide.md']
        })
        
        // Verify file is deleted
        await expect(client.getFileContents({
            datasetId,
            filePath: 'guide.md'
        })).rejects.toThrow('File not found')
        
        // Verify other files still exist
        const remainingFiles = await client.getFileContents({
            datasetId,
            getAllFiles: true
        })
        expect(remainingFiles.files).toHaveLength(2)
        expect(remainingFiles.files.map(f => f.filename).sort()).toEqual(['README.md', 'api-docs.mdx'])
    })
    
    test('should handle file updates', async () => {
        const updatedContent = `# README - Updated

This is the updated content for the README file.

## New Section
This section was added in the update.
`
        
        // Update the file
        await client.upsertFiles({
            datasetId,
            files: [{
                filename: 'README.md',
                content: updatedContent,
                weight: 2.0,
                metadata: { category: 'documentation', updated: true }
            }]
        })
        
        // Verify the update
        const result = await client.getFileContents({
            datasetId,
            filePath: 'README.md'
        })
        
        expect(result.files[0].content).toBe(updatedContent)
        expect(result.files[0].weight).toBe(2.0)
        expect(result.files[0].metadata).toEqual({ 
            category: 'documentation', 
            updated: true 
        })
    })
    
    test('should skip files with unchanged SHA', async () => {
        const size1 = await client.getDatasetSize({ datasetId })
        
        // Upload the same file again
        await client.upsertFiles({
            datasetId,
            files: [{
                filename: 'api-docs.mdx',
                content: `# API Documentation

## Introduction
Complete API reference for the LanceDB SDK.

## Methods

### upsertDataset
Creates or updates a dataset.

### upsertFiles
Uploads files to a dataset.

### searchSections
Searches through document sections.

### getFileContents
Retrieves file contents from the dataset.

## Error Handling
All methods return promises and may throw errors.

## Rate Limits
Please observe API rate limits.
`,
                weight: 1.5,
                metadata: { category: 'api', priority: 'high' }
            }]
        })
        
        // Size should remain the same (file was skipped)
        const size2 = await client.getDatasetSize({ datasetId })
        expect(size2.uploadedContentSizeBytes).toBe(size1.uploadedContentSizeBytes)
    })
})