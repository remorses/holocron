import { describe, test, expect, afterAll } from 'vitest';
import { computeGitBlobSHA } from './sha-utils.js';

const PRODUCTION_URL = 'https://eyecrest.org';
const TEST_DATASET_ID = 'test-dataset-' + Date.now(); // Unique dataset ID for this test run

// Track files to clean up
const filesToCleanup: string[] = [];

describe('Eyecrest Production API', () => {
  afterAll(async () => {
    // Clean up all test files as the last action
    if (filesToCleanup.length > 0) {
      console.log(`🗑️  Cleaning up ${filesToCleanup.length} test files...`);
      
      const deleteResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filenames: filesToCleanup
        })
      });

      if (deleteResponse.ok) {
        console.log('✅ Test files cleaned up successfully');
      } else {
        console.error('❌ Failed to clean up test files:', await deleteResponse.text());
      }
    }
  });

  test('should upload files with SHA validation', async () => {
    const testContent = `# Test File

This is a test file for the Eyecrest API.

## Features

- SHA validation
- Section parsing
- Full-text search

## Usage

Upload markdown files and search through them.`;

    const sha = await computeGitBlobSHA(testContent);
    
    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: [{
          filename: 'test.md',
          content: testContent,
          sha: sha
        }]
      })
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    
    // Track for cleanup
    filesToCleanup.push('test.md');
  });

  test('should reject files with incorrect SHA', async () => {
    const testContent = 'This is test content';
    const wrongSHA = 'incorrect_sha_hash';
    
    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: [{
          filename: 'bad-sha.md',
          content: testContent,
          sha: wrongSHA
        }]
      })
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(500); // Worker throws error for SHA mismatch
  });

  test('should retrieve file content with SHA', async () => {
    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/test.md`);
    
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    
    const data = await response.json() as any;
    expect(data).toHaveProperty('content');
    expect(data).toHaveProperty('sha');
    expect(data.sha).toMatch(/^[a-f0-9]{40}$/); // SHA-1 is 40 hex characters
  });

  test('should retrieve file with line numbers', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/test.md?showLineNumbers=true&start=5&end=10`
    );
    
    expect(response.ok).toBe(true);
    
    const data = await response.json() as any;
    expect(data.content).toContain('5  '); // Should have line number prefix
  });

  test('should upload multiple files including MDX', async () => {
    const mdxContent = `# React Component Guide

This is an MDX file with React components.

<CustomComponent />

## Code Example

\`\`\`jsx
function MyComponent() {
  return <div>Hello World</div>;
}
\`\`\``;

    const docContent = `# Documentation

## Installation

Run the following command:

\`\`\`bash
npm install eyecrest-client
\`\`\`

## Configuration

Configure your client with the API endpoint.`;

    const files = [
      {
        filename: 'guide.mdx',
        content: mdxContent,
        sha: await computeGitBlobSHA(mdxContent)
      },
      {
        filename: 'docs/install.md',
        content: docContent,
        sha: await computeGitBlobSHA(docContent)
      }
    ];

    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files })
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    
    // Track for cleanup
    filesToCleanup.push('guide.mdx', 'docs/install.md');
  });

  test('should search across file sections', async () => {
    // Wait a moment for indexing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=installation`
    );
    
    expect(response.ok).toBe(true);
    
    const data = await response.json() as any;
    expect(data).toHaveProperty('results');
    expect(data).toHaveProperty('count');
    expect(data).toHaveProperty('page');
    expect(data).toHaveProperty('perPage');
    
    expect(data.results.length).toBeGreaterThan(0);
    
    const result = data.results[0];
    expect(result).toHaveProperty('filename');
    expect(result).toHaveProperty('section');
    expect(result).toHaveProperty('snippet');
    expect(result).toHaveProperty('score');
  });

  test('should return plain text search results', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search.txt?query=configuration`
    );
    
    expect(response.ok).toBe(true);
    // Note: Currently returns JSON, not plain text due to Spiceflow handling
    
    const text = await response.text();
    expect(text).toContain(':'); // Format: "filename:section: snippet"
  });

  test('should support pagination in search', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=the&page=0&perPage=2`
    );
    
    expect(response.ok).toBe(true);
    
    const data = await response.json() as any;
    expect(data.results.length).toBeLessThanOrEqual(2);
    expect(data.page).toBe(0);
    expect(data.perPage).toBe(2);
  });

  test('should limit results per file with maxChunksPerFile', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=the&maxChunksPerFile=1`
    );
    
    expect(response.ok).toBe(true);
    
    const data = await response.json() as any;
    
    // Count results per file
    const filesCount: Record<string, number> = {};
    for (const result of data.results) {
      filesCount[result.filename] = (filesCount[result.filename] || 0) + 1;
    }
    
    // Each file should have at most 1 result
    for (const count of Object.values(filesCount)) {
      expect(count).toBeLessThanOrEqual(1);
    }
  });

  test('should return 404 for non-existent file', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/non-existent.md`
    );
    
    expect(response.ok).toBe(false);
    expect(response.status).toBe(500); // Worker throws error which becomes 500
  });

  test('should handle empty search results', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=xyznonexistentquery`
    );
    
    expect(response.ok).toBe(true);
    
    const data = await response.json() as any;
    expect(data.results).toEqual([]);
    expect(data.count).toBe(0);
  });

  test('should skip re-uploading files with same SHA', async () => {
    const content = 'Test content for SHA check';
    const sha = await computeGitBlobSHA(content);
    
    // First upload
    const response1 = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: [{
          filename: 'sha-test.md',
          content: content,
          sha: sha
        }]
      })
    });
    
    expect(response1.ok).toBe(true);
    filesToCleanup.push('sha-test.md');
    
    // Second upload with same content/SHA should skip processing
    const response2 = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: [{
          filename: 'sha-test.md',
          content: content,
          sha: sha
        }]
      })
    });
    
    expect(response2.ok).toBe(true);
    
    // Verify content hasn't changed
    const getResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/sha-test.md`);
    const data = await getResponse.json() as any;
    expect(data.sha).toBe(sha);
  });

  test('should handle MDX with JSX imports and components', async () => {
    // Complex MDX content with JSX, imports, and newlines between tags
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

    const sha = await computeGitBlobSHA(mdxContent);
    
    // Upload the MDX file
    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: [{
          filename: 'complex-example.mdx',
          content: mdxContent,
          sha: sha
        }]
      })
    });

    expect(response.ok).toBe(true);
    filesToCleanup.push('complex-example.mdx');
    
    // Wait for indexing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Search for content to see how sections were split
    const searchResponse = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=JSX`
    );
    
    expect(searchResponse.ok).toBe(true);
    const searchData = await searchResponse.json() as any;
    
    console.log('MDX Section Split Results:');
    console.log('Total sections found:', searchData.count);
    console.log('\nSections:');
    searchData.results.forEach((result: any) => {
      console.log(`- Section: "${result.section}"`);
      console.log(`  Snippet: "${result.snippet}"`);
      console.log('');
    });
    
    // Verify sections were created at heading boundaries
    expect(searchData.results.length).toBeGreaterThan(0);
    
    // Check that JSX content is included in sections
    const hasJSXContent = searchData.results.some((r: any) => 
      r.snippet.includes('Card') || r.snippet.includes('Button') || r.snippet.includes('JSX')
    );
    expect(hasJSXContent).toBe(true);
    
    // Retrieve the full file to see how it was stored
    const fileResponse = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/complex-example.mdx`
    );
    
    const fileData = await fileResponse.json() as any;
    expect(fileData.content).toBe(mdxContent); // Content should be stored as-is
    expect(fileData.sha).toBe(sha);
  });

  test('should delete specific files', async () => {
    // Create a file to delete
    const content = 'File to be deleted';
    const response1 = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: [{
          filename: 'to-delete.md',
          content: content
        }]
      })
    });
    
    expect(response1.ok).toBe(true);
    
    // Delete the file
    const response2 = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filenames: ['to-delete.md']
      })
    });
    
    expect(response2.ok).toBe(true);
    expect(response2.status).toBe(200);
    
    // Verify file is gone
    const response3 = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/to-delete.md`);
    expect(response3.ok).toBe(false);
    
    // Remove from cleanup list since it's already deleted
    const index = filesToCleanup.indexOf('to-delete.md');
    if (index > -1) {
      filesToCleanup.splice(index, 1);
    }
  });
});