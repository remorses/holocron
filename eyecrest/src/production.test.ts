import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { env } from 'cloudflare:test';

// Round timestamp to nearest 2 minutes for stable snapshots
function roundToNearest2Minutes(timestamp: number): number {
  const twoMinutes = 2 * 60 * 1000; // 2 minutes in milliseconds
  return Math.round(timestamp / twoMinutes) * twoMinutes;
}

const PRODUCTION_URL = 'https://eyecrest.org';
// Dataset ID must match the orgId in the JWT token
const TEST_DATASET_ID = 'test-org-123-xx-dataset-' + roundToNearest2Minutes(Date.now()); // Unique dataset ID for this test run

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

// No need to track files - we'll delete entire dataset

describe('Eyecrest Production API', () => {
  // Create dataset before running file tests
  beforeAll(async () => {
    const createResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({})
    });
    
    if (!createResponse.ok) {
      console.error(`Failed to create test dataset: ${await createResponse.text()}`);
      // Dataset might already exist, continue anyway
    }
  });

  afterAll(async () => {
    // Delete entire test dataset
    console.log(`🗑️  Deleting test dataset ${TEST_DATASET_ID}...`);

    const deleteResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}`, {
      method: 'DELETE',
      headers: authHeaders
    });

    if (deleteResponse.ok) {
      console.log('✅ Test dataset deleted successfully');
    } else {
      console.error('❌ Failed to delete test dataset:', await deleteResponse.text());
    }
  });

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

  test('should upload all test files including frontmatter and weights', async () => {
    // File 1: Basic test file
    const testContent = `# Test File

This is a test file for the Eyecrest API.

## Features

- SHA validation
- Section parsing
- Full-text search

## Usage

Upload markdown files and search through them.`;

    // File 2: MDX file with React components
    const mdxContent = `# React Component Guide

This is an MDX file with React components.

<CustomComponent />

## Code Example

\`\`\`jsx
function MyComponent() {
  return <div>Hello World</div>;
}
\`\`\``;

    // File 3: Documentation file
    const docContent = `# Documentation

## Installation

Run the following command:

\`\`\`bash
npm install eyecrest-client
\`\`\`

## Configuration

Configure your client with the API endpoint.`;

    // File 4: Metadata test file
    const metadataContent = `# Metadata Test

This file tests metadata storage.

## First Section

Content in first section.

## Second Section

Content in second section.`;

    // File 5: SHA test file
    const shaTestContent = 'Test content for SHA check';

    // File 6: File with frontmatter and custom weight
    const frontmatterContent = `---
title: Test Document
author: Test Author
date: 2025-01-01
tags: [test, frontmatter]
---

# Document Title

This document has frontmatter which should be parsed as a separate section with higher weight.

## Section One

Some content in section one.

## Section Two

More content in section two.`;

    // Prepare all files
    const files = [
      {
        filename: 'test.md',
        content: testContent
      },
      {
        filename: 'guide.mdx',
        content: mdxContent
      },
      {
        filename: 'docs/install.md',
        content: docContent
      },
      {
        filename: 'metadata-test.md',
        content: metadataContent,
        metadata: {
          author: 'Test Author',
          version: '1.0.0',
          tags: ['test', 'metadata'],
          customField: { nested: true }
        }
      },
      {
        filename: 'sha-test.md',
        content: shaTestContent
      },
      {
        filename: 'frontmatter-test.md',
        content: frontmatterContent,
        weight: 1.5 // Custom file weight
      }
    ];

    // Upload all files at once
    const startTime = Date.now();
    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({ files })
    });
    const uploadTime = Date.now() - startTime;
    console.log(`⏱️  Upload of ${files.length} files took ${uploadTime}ms (${Math.round(uploadTime / files.length)}ms per file)`);

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    // No need to track files - dataset will be deleted at the end
  });

  test('should ignore user-provided SHA and compute it server-side', async () => {
    const testContent = 'This is test content';
    const wrongSHA = 'incorrect_sha_hash';
    const filename = 'ignore-sha-test.md';

    // Upload file with incorrect SHA - should succeed since SHA is ignored
    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        files: [{
          filename,
          content: testContent,
          sha: wrongSHA
        }]
      })
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    // Retrieve file to verify correct SHA was computed
    const getResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/${filename}`, {
      headers: authHeaders
    });

    const data = await getResponse.json() as any;
    expect(data.sha).not.toBe(wrongSHA); // SHA should not be the user-provided one
    expect(data.sha).toBe('417be07f3a69bd909b3a8455d5ca90ad7ed47360'); // Correct computed SHA

    // No need to track - dataset will be deleted at the end
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
        "content": "# Test File

      This is a test file for the Eyecrest API.

      ## Features

      - SHA validation
      - Section parsing
      - Full-text search

      ## Usage

      Upload markdown files and search through them.",
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


  test('should search across file sections', async () => {

    const startTime = Date.now();
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=installation`,
      {
        headers: authHeaders
      }
    );
    const searchTime = Date.now() - startTime;

    expect(response.ok).toBe(true);

    const data = await response.json() as any;
    console.log(`⏱️  Search for 'installation' took ${searchTime}ms and found ${data.results.length} results`);
    expect(data).toMatchInlineSnapshot(`
      {
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "Installation
      Run the following command:
      npm install eyecrest-client",
            "filename": "docs/install.md",
            "score": -3.191744709084836,
            "sectionSlug": "installation",
            "snippet": "## Installation

      Run the following command:

      \`\`\`bash
      npm install eyecrest-client
      \`\`\`",
            "startLine": 3,
          },
        ],
      }
    `);
  });



  test('should get dataset size information', async () => {
    const startTime = Date.now();
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/size`,
      {
        headers: authHeaders
      }
    );
    const fetchTime = Date.now() - startTime;

    if (!response.ok) {
      console.error(`Failed to get dataset size: ${response.status} ${await response.text()}`);
    }
    expect(response.ok).toBe(true);

    const data = await response.json() as any;
    console.log(`⏱️  Getting dataset size took ${fetchTime}ms`);
    console.log(`📊 Dataset stats: ${data.fileCount} files, ${data.sectionCount} sections, ${data.totalSizeBytes} bytes total`);
    
    // Verify the response structure
    expect(data).toHaveProperty('totalSizeBytes');
    expect(data).toHaveProperty('fileCount');
    expect(data).toHaveProperty('sectionCount');
    expect(data).toHaveProperty('breakdown');
    expect(data.breakdown).toHaveProperty('databaseSizeBytes');
    expect(data.breakdown).toHaveProperty('contentSizeBytes');
    expect(data.breakdown).toHaveProperty('metadataSizeBytes');
    
    // Verify counts match our test data
    expect(data.fileCount).toBeGreaterThanOrEqual(6); // We upload at least 6 test files
    expect(data.sectionCount).toBeGreaterThan(0);
    expect(data.totalSizeBytes).toBeGreaterThan(0);
    expect(data.breakdown.contentSizeBytes).toBeGreaterThan(0);
  });

  test.skip('should get all tokens from the dataset', async () => {
    const startTime = Date.now();
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/tokens`,
      {
        headers: authHeaders
      }
    );
    const fetchTime = Date.now() - startTime;

    expect(response.ok).toBe(true);

    const data = await response.json() as any;
    console.log(`⏱️  Getting tokens took ${fetchTime}ms (found ${data.count} unique tokens)`);
    
    // Verify the response structure
    expect(data).toHaveProperty('tokens');
    expect(data).toHaveProperty('count');
    expect(Array.isArray(data.tokens)).toBe(true);
    expect(data.count).toBe(data.tokens.length);
    
    // Check that tokens are sorted and contain expected terms
    expect(data.tokens).toEqual([...data.tokens].sort());
    
    // Sample a few tokens to verify they look correct
    const sampleTokens = data.tokens.slice(0, 10);
    expect(sampleTokens).toMatchInlineSnapshot(`
      [
        "01",
        "2025",
        "a",
        "an",
        "and",
        "api",
        "as",
        "author",
        "bash",
        "be",
      ]
    `);
  });

  test('should support pagination in search', async () => {
    const startTime = Date.now();
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=the&page=0&perPage=2`,
      {
        headers: authHeaders
      }
    );
    const searchTime = Date.now() - startTime;

    expect(response.ok).toBe(true);

    const data = await response.json() as any;
    console.log(`⏱️  Paginated search for 'the' took ${searchTime}ms (showing ${data.results.length} on page ${data.page}, hasNextPage: ${data.hasNextPage})`);
    expect(data).toMatchInlineSnapshot(`
      {
        "hasNextPage": true,
        "page": 0,
        "perPage": 2,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "Configuration
      Configure your client with the API endpoint.",
            "filename": "docs/install.md",
            "score": -1.446387253169038,
            "sectionSlug": "configuration",
            "snippet": "## Configuration

      Configure your client with the API endpoint.",
            "startLine": 11,
          },
          {
            "cleanedSnippet": "Installation
      Run the following command:
      npm install eyecrest-client",
            "filename": "docs/install.md",
            "score": -1.3562641622568563,
            "sectionSlug": "installation",
            "snippet": "## Installation

      Run the following command:

      \`\`\`bash
      npm install eyecrest-client
      \`\`\`",
            "startLine": 3,
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
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [],
      }
    `);
  });


  test('should store and return file metadata and line numbers', async () => {
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


    // Search to verify line numbers are returned
    const searchStart = Date.now();
    const searchResponse = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=section`,
      {
        headers: authHeaders
      }
    );
    const searchTime = Date.now() - searchStart;

    const searchData = await searchResponse.json() as any;
    console.log(`⏱️  Search for 'section' took ${searchTime}ms and found ${searchData.results.length} results`);
    expect(searchData).toMatchInlineSnapshot(`
      {
        "hasNextPage": false,
        "page": 0,
        "perPage": 20,
        "region": "weur",
        "results": [
          {
            "cleanedSnippet": "Section One
      Some content in section one.",
            "filename": "frontmatter-test.md",
            "score": -0.8221412936324344,
            "sectionSlug": "section-one",
            "snippet": "## Section One

      Some content in section one.",
            "startLine": 12,
          },
          {
            "cleanedSnippet": "Section Two
      More content in section two.",
            "filename": "frontmatter-test.md",
            "score": -0.8221412936324344,
            "sectionSlug": "section-two",
            "snippet": "## Section Two

      More content in section two.",
            "startLine": 16,
          },
          {
            "cleanedSnippet": "Document Title
      This document has frontmatter which should be parsed as a separate section with higher weight.",
            "filename": "frontmatter-test.md",
            "score": -0.451273155062302,
            "sectionSlug": "document-title",
            "snippet": "# Document Title

      This document has frontmatter which should be parsed as a separate section with higher weight.",
            "startLine": 8,
          },
          {
            "cleanedSnippet": "First Section
      Content in first section.",
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
            "score": -0.8123893062227998,
            "sectionSlug": "first-section",
            "snippet": "## First Section

      Content in first section.",
            "startLine": 5,
          },
          {
            "cleanedSnippet": "Second Section
      Content in second section.",
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
            "score": -0.8123893062227998,
            "sectionSlug": "second-section",
            "snippet": "## Second Section

      Content in second section.",
            "startLine": 9,
          },
          {
            "cleanedSnippet": "Features
      - SHA validation
      - Section parsing
      - Full-text search",
            "filename": "test.md",
            "score": -0.6005330653142935,
            "sectionSlug": "features",
            "snippet": "## Features

      - SHA validation
      - Section parsing
      - Full-text search",
            "startLine": 5,
          },
        ],
      }
    `);
  });

  test('should skip re-uploading files with same content', async () => {
    const content = 'Test content for SHA check';

    // Re-upload the same sha-test.md file to test SHA skipping
    const startTime = Date.now();
    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        files: [{
          filename: 'sha-test.md',
          content: content
        }]
      })
    });
    const reuploadTime = Date.now() - startTime;
    console.log(`⏱️  Re-upload of sha-test.md took ${reuploadTime}ms (should be fast due to SHA skipping)`);

    expect(response.ok).toBe(true);

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
        "content": "Test content for SHA check",
        "sha": "1782917c7c9a9c41779b7f69d27db008019f9b92",
      }
    `);
  });


  test('should prioritize frontmatter in search results', async () => {
    // Search for a term that appears in frontmatter
    const searchStart = Date.now();
    const response = await fetch(
      `${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/search?query=author`,
      {
        headers: authHeaders
      }
    );
    const searchTime = Date.now() - searchStart;

    expect(response.ok).toBe(true);
    const data = await response.json() as any;
    console.log(`⏱️  Search for 'author' took ${searchTime}ms and found ${data.results.length} results`);
    
    // The frontmatter section should appear first due to higher weight
    expect(data.results.length).toBeGreaterThan(0);
    const firstResult = data.results[0];
    expect(firstResult.sectionSlug).toBe(''); // Frontmatter has empty slug
    expect(firstResult.filename).toBe('frontmatter-test.md');
    
    // Verify the content includes our frontmatter
    expect(firstResult.snippet).toContain('author: Test Author');
  });

  test('should delete specific files', async () => {
    // Delete the sha-test.md file
    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'DELETE',
      headers: jsonHeaders,
      body: JSON.stringify({
        filenames: ['sha-test.md']
      })
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    // Verify file is gone
    const verifyResponse = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files/sha-test.md`, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`
      }
    });
    expect(verifyResponse.ok).toBe(false);

    // File is deleted, no cleanup needed
  });
});
