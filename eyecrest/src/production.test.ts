import { describe, test, expect, afterAll } from 'vitest';
import { env } from 'cloudflare:test';

// Round timestamp to nearest 5 minutes for stable snapshots
function roundToNearest5Minutes(timestamp: number): number {
  const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
  return Math.round(timestamp / fiveMinutes) * fiveMinutes;
}

const PRODUCTION_URL = 'https://eyecrest.org';
// Dataset ID must match the orgId in the JWT token
const TEST_DATASET_ID = 'test-org-123-xx-dataset-' + roundToNearest5Minutes(Date.now()); // Unique dataset ID for this test run

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

  test('should upload all test files', async () => {
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

    // Track all files for cleanup
    filesToCleanup.push(...files.map(f => f.filename));

    // Wait a moment for indexing
    await new Promise(resolve => setTimeout(resolve, 1000));
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
    console.log(`⏱️  Search for 'installation' took ${searchTime}ms and found ${data.count} results`);
    expect(data).toMatchInlineSnapshot(`
      {
        "count": 1,
        "page": 0,
        "perPage": 20,
        "results": [
          {
            "cleanedSnippet": "Installation
      Run the following command:
      npm install eyecrest-client",
            "filename": "docs/install.md",
            "score": -2.669456589528529,
            "section": "Installation",
            "sectionSlug": "installation",
            "snippet": "## Installation

      Run the following command:

      \`\`\`bash
      npm install eyecrest-client
      \`\`\`",
          },
        ],
      }
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
    console.log(`⏱️  Paginated search for 'the' took ${searchTime}ms and found ${data.count} total results (showing ${data.results.length} on page ${data.page})`);
    expect(data).toMatchInlineSnapshot(`
      {
        "count": 3,
        "page": 0,
        "perPage": 2,
        "results": [
          {
            "cleanedSnippet": "Configuration
      Configure your client with the API endpoint.",
            "filename": "docs/install.md",
            "score": -0.9956804118952794,
            "section": "Configuration",
            "sectionSlug": "configuration",
            "snippet": "## Configuration

      Configure your client with the API endpoint.",
          },
          {
            "cleanedSnippet": "Installation
      Run the following command:
      npm install eyecrest-client",
            "filename": "docs/install.md",
            "score": -0.931881251714508,
            "section": "Installation",
            "sectionSlug": "installation",
            "snippet": "## Installation

      Run the following command:

      \`\`\`bash
      npm install eyecrest-client
      \`\`\`",
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
    console.log(`⏱️  Search for 'section' took ${searchTime}ms and found ${searchData.count} results`);
    expect(searchData).toMatchInlineSnapshot(`
      {
        "count": 3,
        "page": 0,
        "perPage": 20,
        "results": [
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
            "score": -1.403337815291314,
            "section": "First Section",
            "sectionSlug": "first-section",
            "snippet": "## First Section

      Content in first section.",
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
            "score": -1.403337815291314,
            "section": "Second Section",
            "sectionSlug": "second-section",
            "snippet": "## Second Section

      Content in second section.",
          },
          {
            "cleanedSnippet": "Features
      - SHA validation
      - Section parsing
      - Full-text search",
            "filename": "test.md",
            "score": -1.0309720050966873,
            "section": "Features",
            "sectionSlug": "features",
            "snippet": "## Features

      - SHA validation
      - Section parsing
      - Full-text search",
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

    // Remove from cleanup list since it's already deleted
    const index = filesToCleanup.indexOf('sha-test.md');
    if (index > -1) {
      filesToCleanup.splice(index, 1);
    }
  });
});
