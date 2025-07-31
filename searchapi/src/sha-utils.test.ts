import { describe, test, expect } from 'vitest';
import { computeGitBlobSHA, verifySHA } from './sha-utils.js';

describe('computeGitBlobSHA', () => {
  test('computes SHA for simple text', async () => {
    const content = 'hello world';
    const sha = await computeGitBlobSHA(content);
    
    // This should match what Git would compute for this content
    // Can verify with: echo -n "hello world" | git hash-object --stdin
    expect(sha).toMatchInlineSnapshot(`"95d09f2b10159347eece71399a7e2e907ea3df4f"`);
  });

  test('computes SHA for empty string', async () => {
    const content = '';
    const sha = await computeGitBlobSHA(content);
    
    expect(sha).toMatchInlineSnapshot(`"e69de29bb2d1d6434b8b29ae775ad8c2e48c5391"`);
  });

  test('computes SHA for multiline content', async () => {
    const content = `# Hello World

This is a test file with multiple lines.

## Section 2

Some more content here.`;
    
    const sha = await computeGitBlobSHA(content);
    
    expect(sha).toMatchInlineSnapshot(`"95305c65ff2fbb216fe70188cd053f95d331618d"`);
  });

  test('computes different SHAs for different content', async () => {
    const content1 = 'hello world';
    const content2 = 'hello world!';
    
    const sha1 = await computeGitBlobSHA(content1);
    const sha2 = await computeGitBlobSHA(content2);
    
    expect(sha1).not.toBe(sha2);
  });

  test('computes same SHA for identical content', async () => {
    const content = 'identical content';
    
    const sha1 = await computeGitBlobSHA(content);
    const sha2 = await computeGitBlobSHA(content);
    
    expect(sha1).toBe(sha2);
  });
});

describe('verifySHA', () => {
  test('verifies correct SHA', async () => {
    const content = 'test content';
    const sha = await computeGitBlobSHA(content);
    
    const isValid = await verifySHA(content, sha);
    expect(isValid).toBe(true);
  });

  test('rejects incorrect SHA', async () => {
    const content = 'test content';
    const wrongSHA = 'incorrect_sha_hash';
    
    const isValid = await verifySHA(content, wrongSHA);
    expect(isValid).toBe(false);
  });
});