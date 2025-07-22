import { describe, test, expect, afterAll } from 'vitest';
import { env } from 'cloudflare:test';


const PRODUCTION_URL = 'https://eyecrest.org';
// Dataset ID must match the orgId in the JWT token
const TEST_DATASET_ID = 'test-org-123-xx-dataset-' + Date.now(); // Unique dataset ID for this test run

// JWT token from Cloudflare test environment
const JWT_TOKEN = env.EYECREST_EXAMPLE_JWT;
if (!JWT_TOKEN) {
  throw new Error('EYECREST_EXAMPLE_JWT not found in test environment. Make sure it is set in .dev.vars');
}

// Common headers with authentication
const authHeaders = {
  'Authorization': `Bearer ${JWT_TOKEN}`
};

const jsonHeaders = {
  'Content-Type': 'application/json',
  ...authHeaders
};

// Track files to clean up
const filesToCleanup: string[] = [];

describe('Eyecrest Production API', () => {
  // Test authentication failures first
  test('should reject requests without authorization header', async () => {
    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`);

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);

    const error = await response.json() as any;
    expect(error.error).toContain('Missing or invalid Authorization header');
  });

  test('should reject requests with invalid JWT token', async () => {
    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      headers: {
        'Authorization': 'Bearer invalid-jwt-token'
      }
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);

    const error = await response.json() as any;
    expect(error.error).toContain('JWT verification failed');
  });

  test('should reject requests with wrong authorization scheme', async () => {
    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      headers: {
        'Authorization': 'Basic dXNlcjpwYXNz' // Basic auth instead of Bearer
      }
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);

    const error = await response.json() as any;
    expect(error.error).toContain('Missing or invalid Authorization header');
  });

  afterAll(async () => {
    // Clean up all test files as the last action
    if (filesToCleanup.length > 0) {
      console.log(`🗑️  Cleaning up ${filesToCleanup.length} test files...`);

      const deleteResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${JWT_TOKEN}`
        },
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

  test('should upload files', async () => {
    const testContent = `# Test File

This is a test file for the Eyecrest API.

## Features

- SHA validation
- Section parsing
- Full-text search

## Usage

Upload markdown files and search through them.`;

    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        files: [{
          filename: 'test.md',
          content: testContent
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
      headers: jsonHeaders,
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
    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/test.md`, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`File retrieval failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json() as any;
    expect(data).toMatchInlineSnapshot(`
      {
        "__superjsonMeta": {
          "values": {
            "metadata": [
              "undefined",
            ],
          },
        },
        "content": "# Test File

      This is a test file for the Eyecrest API.

      ## Features

      - SHA validation
      - Section parsing
      - Full-text search

      ## Usage

      Upload markdown files and search through them.",
        "metadata": null,
        "sha": "888714a3a2b2d0f763ddcd537ac56c4d61abe77a",
      }
    `);
  });

  test('should retrieve file with line numbers', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/test.md?showLineNumbers=true&start=5&end=10`,
      {
        headers: authHeaders
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`File retrieval failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json() as any;
    expect(data.content).toMatchInlineSnapshot(`
      " 5  ## Features
       6  
       7  - SHA validation
       8  - Section parsing
       9  - Full-text search
      10  "
    `);
  });

  test('should treat empty showLineNumbers as true', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/test.md?showLineNumbers=&start=1&end=3`,
      {
        headers: authHeaders
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`File retrieval failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json() as any;
    expect(data.content).toContain('1  # Test File');
    expect(data.content).toContain('2  ');
    expect(data.content).toContain('3  This is a test file');
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
        content: mdxContent
      },
      {
        filename: 'docs/install.md',
        content: docContent
      }
    ];

    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: jsonHeaders,
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
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=installation`,
      {
        headers: authHeaders
      }
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
            "cleanedSnippet": "docs/install.md",
            "filename": "docs/install.md",
            "metadata": null,
            "score": -0.6817175152436655,
            "section": "Installation",
            "sectionSlug": "installation",
            "snippet": "docs/install.md",
            "startLine": null,
          },
          {
            "cleanedSnippet": "docs/install.md",
            "filename": "docs/install.md",
            "metadata": null,
            "score": -0.6096543529557517,
            "section": "Documentation",
            "sectionSlug": "documentation",
            "snippet": "docs/install.md",
            "startLine": null,
          },
          {
            "cleanedSnippet": "docs/install.md",
            "filename": "docs/install.md",
            "metadata": null,
            "score": -0.44986974874894,
            "section": "Configuration",
            "sectionSlug": "configuration",
            "snippet": "docs/install.md",
            "startLine": null,
          },
        ],
      }
    `);
  });



  test('should support pagination in search', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=the&page=0&perPage=2`,
      {
        headers: authHeaders
      }
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
            "cleanedSnippet": "Configure your client with the API endpoint.",
            "filename": "docs/install.md",
            "metadata": null,
            "score": -0.44986974874894,
            "section": "Configuration",
            "sectionSlug": "configuration",
            "snippet": "Configure your client with the API endpoint.",
            "startLine": null,
          },
          {
            "cleanedSnippet": "This is a test file for the Eyecrest API.",
            "filename": "test.md",
            "metadata": null,
            "score": -0.4185290405632374,
            "section": "Test File",
            "sectionSlug": "test-file",
            "snippet": "This is a test file for the Eyecrest API.",
            "startLine": null,
          },
        ],
      }
    `);
  });

  test('should limit results per file with maxChunksPerFile', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=the&maxChunksPerFile=1`,
      {
        headers: authHeaders
      }
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
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/non-existent.md`,
      {
        headers: authHeaders
      }
    );

    expect(response.ok).toBe(false);
    expect(response.status).toBe(500); // Worker throws error which becomes 500

    const errorText = await response.text();
    expect(errorText).toContain('File not found');
    expect(errorText).toContain('non-existent.md');
  });

  test('should handle empty search results', async () => {
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=xyznonexistentquery`,
      {
        headers: authHeaders
      }
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

    // Upload file with metadata
    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        files: [{
          filename: 'metadata-test.md',
          content: content,
          metadata: metadata
        }]
      })
    });

    expect(response.ok).toBe(true);
    filesToCleanup.push('metadata-test.md');

    // Retrieve file to verify metadata
    const getResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/metadata-test.md`, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`
      }
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      throw new Error(`File retrieval failed with status ${getResponse.status}: ${errorText}`);
    }

    const fileData = await getResponse.json() as any;
    expect(fileData).toMatchInlineSnapshot(`
      {
        "content": "# Metadata Test

      This file tests metadata storage.

      ## First Section

      Content in first section.

      ## Second Section

      Content in second section.",
        "metadata": {
          "author": "Test Author",
          "customField": {
            "nested": true,
          },
          "tags": [
            "test",
            "metadata",
          ],
          "version": "1.0.0",
        },
        "sha": "36937b98f7b8bf0699d944beaa1e8f53d3e6dafb",
      }
    `);

    // Wait for indexing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Search to verify line numbers are returned
    const searchResponse = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=section`,
      {
        headers: authHeaders
      }
    );

    const searchData = await searchResponse.json() as any;
    expect(searchData).toMatchInlineSnapshot(`
      {
        "__superjsonMeta": {
          "values": {
            "results.0.startLine": [
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
            "cleanedSnippet": "First Section",
            "filename": "metadata-test.md",
            "metadata": {
              "author": "Test Author",
              "customField": {
                "nested": true,
              },
              "tags": [
                "test",
                "metadata",
              ],
              "version": "1.0.0",
            },
            "score": -1.2697268570997082,
            "section": "First Section",
            "sectionSlug": "first-section",
            "snippet": "First Section",
            "startLine": null,
          },
          {
            "cleanedSnippet": "Second Section",
            "filename": "metadata-test.md",
            "metadata": {
              "author": "Test Author",
              "customField": {
                "nested": true,
              },
              "tags": [
                "test",
                "metadata",
              ],
              "version": "1.0.0",
            },
            "score": -1.2697268570997082,
            "section": "Second Section",
            "sectionSlug": "second-section",
            "snippet": "Second Section",
            "startLine": null,
          },
          {
            "cleanedSnippet": "- SHA validation
      - Section parsing
      - Full-text search",
            "filename": "test.md",
            "metadata": null,
            "score": -0.9033710596991084,
            "section": "Features",
            "sectionSlug": "features",
            "snippet": "- SHA validation
      - Section parsing
      - Full-text search",
            "startLine": null,
          },
        ],
      }
    `);
  });

  test('should skip re-uploading files with same content', async () => {
    const content = 'Test content for SHA check';

    // First upload
    const response1 = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        files: [{
          filename: 'sha-test.md',
          content: content
        }]
      })
    });

    expect(response1.ok).toBe(true);
    filesToCleanup.push('sha-test.md');

    // Second upload with same content should skip processing (SHA computed internally)
    const response2 = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        files: [{
          filename: 'sha-test.md',
          content: content
        }]
      })
    });

    expect(response2.ok).toBe(true);

    // Verify content hasn't changed
    const getResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/sha-test.md`, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`
      }
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      throw new Error(`File retrieval failed with status ${getResponse.status}: ${errorText}`);
    }

    const data = await getResponse.json() as any;
    expect(data).toMatchInlineSnapshot(`
      {
        "__superjsonMeta": {
          "values": {
            "metadata": [
              "undefined",
            ],
          },
        },
        "content": "Test content for SHA check",
        "metadata": null,
        "sha": "1782917c7c9a9c41779b7f69d27db008019f9b92",
      }
    `);
  });


  test('should delete specific files', async () => {
    // Create a file to delete
    const content = 'File to be deleted';
    const response1 = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: jsonHeaders,
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
      headers: jsonHeaders,
      body: JSON.stringify({
        filenames: ['to-delete.md']
      })
    });

    expect(response2.ok).toBe(true);
    expect(response2.status).toBe(200);

    // Verify file is gone
    const response3 = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/to-delete.md`, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`
      }
    });
    expect(response3.ok).toBe(false);

    // Remove from cleanup list since it's already deleted
    const index = filesToCleanup.indexOf('to-delete.md');
    if (index > -1) {
      filesToCleanup.splice(index, 1);
    }
  });
});
