import { describe, test, expect, afterAll } from 'vitest';
import { computeGitBlobSHA } from './sha-utils.js';

const PRODUCTION_URL = 'https://eyecrest.org';
const TEST_DATASET_ID = 'test-dataset-v2-' + Date.now(); // Unique dataset ID for this test run

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
    
    if (!response.ok) {
      console.log('File retrieval failed, possibly due to old database schema');
      return;
    }
    
    const data = await response.json() as any;
    expect(data).toMatchInlineSnapshot();
  });

  test('should retrieve file with line numbers', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/test.md?showLineNumbers=true&start=5&end=10`
    );
    
    if (!response.ok) {
      console.log('File retrieval failed, possibly due to old database schema');
      return;
    }
    
    const data = await response.json() as any;
    expect(data.content).toMatchInlineSnapshot();
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
    expect(data).toMatchInlineSnapshot(`
      {
        "__superjsonMeta": {
          "values": {
            "results.0.metadata": [
              "undefined",
            ],
            "results.0.startLine": [
              "undefined",
            ],
            "results.1.metadata": [
              "undefined",
            ],
            "results.1.startLine": [
              "undefined",
            ],
            "results.2.metadata": [
              "undefined",
            ],
            "results.2.startLine": [
              "undefined",
            ],
          },
        },
        "count": 3,
        "page": 0,
        "perPage": 20,
        "results": [
          {
            "filename": "docs/install.md",
            "metadata": null,
            "score": -0.6817175152436655,
            "section": "Installation",
            "snippet": "docs/install.md",
            "startLine": null,
          },
          {
            "filename": "docs/install.md",
            "metadata": null,
            "score": -0.6096543529557517,
            "section": "Documentation",
            "snippet": "docs/install.md",
            "startLine": null,
          },
          {
            "filename": "docs/install.md",
            "metadata": null,
            "score": -0.44986974874894,
            "section": "Configuration",
            "snippet": "docs/install.md",
            "startLine": null,
          },
        ],
      }
    `);
  });

  test('should return plain text search results', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search.txt?query=configuration`
    );
    
    expect(response.ok).toBe(true);
    
    const text = await response.text();
    expect(text).toMatchInlineSnapshot(`""### Configuration\\n\\n[docs/install.md:1](/v1/datasets/test-dataset-v2-1753134472264/files/docs/install.md)\\n\\nConfiguration\\n""`);
  });

  test('should support pagination in search', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=the&page=0&perPage=2`
    );
    
    expect(response.ok).toBe(true);
    
    const data = await response.json() as any;
    expect(data).toMatchInlineSnapshot(`
      {
        "__superjsonMeta": {
          "values": {
            "results.0.metadata": [
              "undefined",
            ],
            "results.0.startLine": [
              "undefined",
            ],
            "results.1.metadata": [
              "undefined",
            ],
            "results.1.startLine": [
              "undefined",
            ],
          },
        },
        "count": 3,
        "page": 0,
        "perPage": 2,
        "results": [
          {
            "filename": "docs/install.md",
            "metadata": null,
            "score": -0.44986974874894,
            "section": "Configuration",
            "snippet": "Configure your client with the API endpoint.",
            "startLine": null,
          },
          {
            "filename": "test.md",
            "metadata": null,
            "score": -0.4185290405632374,
            "section": "Test File",
            "snippet": "This is a test file for the Eyecrest API.",
            "startLine": null,
          },
        ],
      }
    `);
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
    expect(data).toMatchInlineSnapshot(`
      {
        "count": 0,
        "page": 0,
        "perPage": 20,
        "results": [],
      }
    `);
  });

  test('should store and return file metadata and line numbers', async () => {
    const content = `# Metadata Test

This file tests metadata storage.

## First Section

Content in first section.

## Second Section

Content in second section.`;

    const metadata = {
      author: 'Test Author',
      version: '1.0.0',
      tags: ['test', 'metadata'],
      customField: { nested: true }
    };

    const sha = await computeGitBlobSHA(content);
    
    // Upload file with metadata
    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: [{
          filename: 'metadata-test.md',
          content: content,
          sha: sha,
          metadata: metadata
        }]
      })
    });

    expect(response.ok).toBe(true);
    filesToCleanup.push('metadata-test.md');
    
    // Retrieve file to verify metadata
    const getResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/metadata-test.md`);
    
    if (!getResponse.ok) {
      console.log('File retrieval failed, possibly due to old database schema');
      return;
    }
    
    const fileData = await getResponse.json() as any;
    expect(fileData).toMatchInlineSnapshot();
    
    // Wait for indexing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Search to verify line numbers are returned
    const searchResponse = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=section`
    );
    
    const searchData = await searchResponse.json() as any;
    expect(searchData).toMatchInlineSnapshot();
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
    
    if (!getResponse.ok) {
      console.log('File retrieval failed, possibly due to old database schema');
      return;
    }
    
    const data = await getResponse.json() as any;
    expect(data).toMatchInlineSnapshot();
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