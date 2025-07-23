import { describe, test, expect } from 'vitest';
import { env } from 'cloudflare:test';

const PRODUCTION_URL = 'https://eyecrest.org';

// JWT token from Cloudflare test environment
const JWT_TOKEN = env.EYECREST_EXAMPLE_JWT;
if (!JWT_TOKEN) {
  throw new Error('EYECREST_EXAMPLE_JWT not found in test environment');
}

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${JWT_TOKEN}`
};

const TEST_DATASET_ID = 'filename-validation-test-' + Date.now();

describe('Filename Validation Tests', () => {
  test('should accept valid filenames', async () => {
    const validFilenames = [
      'test.md',
      'docs/api.md',
      'src/components/Button.tsx',
      'README.md',
      'test-file.md',
      'test_file.md',
      'nested/deep/path/file.md',
      '123.md',
      'a1b2c3.md'
    ];

    for (const filename of validFilenames) {
      const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({
          files: [{
            filename,
            content: 'Test content'
          }]
        })
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
    }
  });

  test('should reject filenames with invalid characters', async () => {
    const invalidFilenames = [
      'test file.md', // space
      'test@file.md', // @
      'test#file.md', // #
      'test$file.md', // $
      'test%file.md', // %
      'test&file.md', // &
      'test*file.md', // *
      'test(file).md', // parentheses
      'test[file].md', // brackets
      'test{file}.md', // braces
      'test|file.md', // pipe
      'test\\file.md', // backslash
      'test:file.md', // colon
      'test;file.md', // semicolon
      'test"file.md', // quote
      'test\'file.md', // single quote
      'test<file>.md', // angle brackets
      'test?file.md', // question mark
      'test!file.md', // exclamation
      'test,file.md', // comma
      'test file.md', // space
      'тест.md', // non-ASCII
      '文件.md', // Chinese characters
      '😀.md' // emoji
    ];

    for (const filename of invalidFilenames) {
      const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({
          files: [{
            filename,
            content: 'Test content'
          }]
        })
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(422);
      
      const error = await response.json() as any;
      expect(error).toMatchInlineSnapshot(`
        {
          "code": "VALIDATION",
          "message": "files.0.filename: Filename must only contain alphanumeric characters, hyphens, underscores, forward slashes, and dots",
          "status": 422,
        }
      `);
    }
  });

  test('should reject filenames exceeding 500 characters', async () => {
    const longFilename = 'a'.repeat(501) + '.md';
    
    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        files: [{
          filename: longFilename,
          content: 'Test content'
        }]
      })
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(422);
    
    const error = await response.json() as any;
    expect(error).toMatchInlineSnapshot(`
      {
        "code": "VALIDATION",
        "message": "files.0.filename: Filename must not exceed 500 characters",
        "status": 422,
      }
    `);
  });

  test('should accept filename exactly 500 characters', async () => {
    const maxFilename = 'a'.repeat(496) + '.md'; // 496 + 3 = 499 < 500
    
    const response = await fetch(`${PRODUCTION_URL}/v1/datasets/${TEST_DATASET_ID}/files`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify({
        files: [{
          filename: maxFilename,
          content: 'Test content'
        }]
      })
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
  });
});