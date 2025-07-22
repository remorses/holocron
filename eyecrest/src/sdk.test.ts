import { describe, test, expect, afterAll } from 'vitest';
import { env } from 'cloudflare:test';
import { EyecrestClient } from './sdk.js';

// Round timestamp to nearest 5 minutes for stable snapshots
function roundToNearest5Minutes(timestamp: number): number {
  const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
  return Math.round(timestamp / fiveMinutes) * fiveMinutes;
}

const PRODUCTION_URL = 'https://eyecrest.org';
const TEST_DATASET_ID = 'sdk-test-dataset-' + roundToNearest5Minutes(Date.now());
const JWT_TOKEN = env.EYECREST_EXAMPLE_JWT;

if (!JWT_TOKEN) {
  throw new Error('EYECREST_EXAMPLE_JWT not found in test environment');
}

// Track files for cleanup
const filesToCleanup: string[] = [];

describe('EyecrestClient', () => {
  afterAll(async () => {
    // Clean up test files
    if (filesToCleanup.length > 0) {
      const client = new EyecrestClient({ token: JWT_TOKEN, baseUrl: PRODUCTION_URL });
      await client.deleteFiles({
        datasetId: TEST_DATASET_ID,
        filenames: filesToCleanup
      });
    }
  });

  test('should create client with default base URL', () => {
    const client = new EyecrestClient({ token: 'test-token' });
    expect(client).toMatchInlineSnapshot(`
      EyecrestClient {
        "baseUrl": "https://eyecrest.org",
        "token": "test-token",
      }
    `);
  });

  test('should create client with custom base URL', () => {
    const client = new EyecrestClient({ 
      token: 'test-token',
      baseUrl: 'https://custom.example.com' 
    });
    expect(client).toMatchInlineSnapshot(`
      EyecrestClient {
        "baseUrl": "https://custom.example.com",
        "token": "test-token",
      }
    `);
  });

  test('should handle trailing slash in base URL', () => {
    const client = new EyecrestClient({ 
      token: 'test-token',
      baseUrl: 'https://custom.example.com/' 
    });
    expect(client).toMatchInlineSnapshot(`
      EyecrestClient {
        "baseUrl": "https://custom.example.com",
        "token": "test-token",
      }
    `);
  });

  test('should have all required methods', () => {
    const client = new EyecrestClient({ token: 'test-token' });
    
    expect(typeof client.upsertFiles).toMatchInlineSnapshot(`"function"`);
    expect(typeof client.deleteFiles).toMatchInlineSnapshot(`"function"`);
    expect(typeof client.getFile).toMatchInlineSnapshot(`"function"`);
    expect(typeof client.search).toMatchInlineSnapshot(`"function"`);
  });

  test('should upload and search files', async () => {
    const client = new EyecrestClient({ token: JWT_TOKEN, baseUrl: PRODUCTION_URL });
    
    // Upload test files
    await client.upsertFiles({
      datasetId: TEST_DATASET_ID,
      files: [
        {
          filename: 'sdk-test.md',
          content: '# SDK Test\n\nThis is a test file for the SDK.\n\n## Features\n\n- Type-safe API\n- Easy to use\n- Full error handling',
          weight: 1.2
        },
        {
          filename: 'sdk-docs.md',
          content: '# SDK Documentation\n\n## Installation\n\nInstall the SDK using npm or pnpm.\n\n## Usage\n\nImport and create a client.',
          metadata: { version: '1.0.0' }
        }
      ]
    });

    filesToCleanup.push('sdk-test.md', 'sdk-docs.md');

    // Wait for indexing
    await new Promise(resolve => setTimeout(resolve, 500));

    // Search for content
    const results = await client.search({
      datasetId: TEST_DATASET_ID,
      query: 'SDK',
      perPage: 5
    });

    expect(results).toMatchInlineSnapshot(`
      {
        "hasNextPage": false,
        "page": 0,
        "perPage": 5,
        "results": [
          {
            "cleanedSnippet": "SDK Test
      This is a test file for the SDK.",
            "filename": "sdk-test.md",
            "score": -0.000001290479895447539,
            "sectionSlug": "sdk-test",
            "snippet": "# SDK Test

      This is a test file for the SDK.",
            "startLine": 1,
          },
          {
            "cleanedSnippet": "SDK Documentation",
            "filename": "sdk-docs.md",
            "metadata": {
              "version": "1.0.0",
            },
            "score": -0.0000011936389148737139,
            "sectionSlug": "sdk-documentation",
            "snippet": "# SDK Documentation",
            "startLine": 1,
          },
          {
            "cleanedSnippet": "Installation
      Install the SDK using npm or pnpm.",
            "filename": "sdk-docs.md",
            "metadata": {
              "version": "1.0.0",
            },
            "score": -9.860896445131375e-7,
            "sectionSlug": "installation",
            "snippet": "## Installation

      Install the SDK using npm or pnpm.",
            "startLine": 3,
          },
        ],
      }
    `);
  });

  test('should get file with line numbers', async () => {
    const client = new EyecrestClient({ token: JWT_TOKEN, baseUrl: PRODUCTION_URL });
    
    const file = await client.getFile({
      datasetId: TEST_DATASET_ID,
      filePath: 'sdk-test.md',
      showLineNumbers: true,
      start: 3,
      end: 7
    });

    expect(file).toMatchInlineSnapshot(`
      {
        "content": "3  This is a test file for the SDK.
      4  
      5  ## Features
      6  
      7  - Type-safe API",
        "sha": "48ce1348bcaf391b590c42d479d4e99da0218f13",
      }
    `);
  });

  test('should throw error on non-ok response', async () => {
    const client = new EyecrestClient({ token: 'invalid-token', baseUrl: PRODUCTION_URL });
    
    await expect(client.search({
      datasetId: 'test-dataset',
      query: 'test'
    })).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: Request failed with status 401: {"error":"JWT verification failed: Invalid Compact JWS"}]`);
  });

  test('should get search results as text with returnAsText parameter', async () => {
    const client = new EyecrestClient({ token: JWT_TOKEN, baseUrl: PRODUCTION_URL });
    
    const text = await client.search({
      datasetId: TEST_DATASET_ID,
      query: 'Features',
      perPage: 2,
      returnAsText: true
    });

    expect(text).toMatchInlineSnapshot(`
      "### Features

      [sdk-test.md:5](/v1/datasets/sdk-test-dataset-1753196400000/files/sdk-test.md?start=5)

      ## Features

      - Type-safe API
      - Easy to use
      - Full error handling
      "
    `);
  });
});