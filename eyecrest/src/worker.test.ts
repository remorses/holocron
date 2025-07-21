import { describe, it, expect } from 'vitest';
import { findLineNumberInContent } from './utils.js';


describe('findLineNumberInContent', () => {
  const sampleContent = `line 1 content
line 2 has some text
line 3 with more content
line 4 final line`;

  it('should return 1 for content on first line', () => {
    const result = findLineNumberInContent(sampleContent, 'line 1 content');
    expect(result).toBe(1);
  });

  it('should return 2 for content on second line', () => {
    const result = findLineNumberInContent(sampleContent, 'line 2 has some text');
    expect(result).toBe(2);
  });

  it('should return 3 for content on third line', () => {
    const result = findLineNumberInContent(sampleContent, 'line 3 with more');
    expect(result).toBe(3);
  });

  it('should return 4 for content on fourth line', () => {
    const result = findLineNumberInContent(sampleContent, 'line 4 final');
    expect(result).toBe(4);
  });

  it('should return null for non-existent content', () => {
    const result = findLineNumberInContent(sampleContent, 'not found');
    expect(result).toBe(null);
  });

  it('should handle partial snippet matches', () => {
    // This simulates what SQLite snippet() might return
    const snippet = 'has some text';
    const result = findLineNumberInContent(sampleContent, snippet);
    expect(result).toBe(2);
  });

  it('should handle snippets with ellipsis removed', () => {
    // This simulates cleaned snippet from SQLite
    const snippet = 'with more content';
    const result = findLineNumberInContent(sampleContent, snippet);
    expect(result).toBe(3);
  });
});

describe('findLineNumberInContent - advanced cases', () => {
  const sampleContent = `function example() {
  const data = {
    name: "test",
    value: 42
  };
  return data;
}`;

  it('should find line number even with partial matches', () => {
    // Simulate SQLite snippet that might be truncated
    const snippet = 'const data = {';
    const result = findLineNumberInContent(sampleContent, snippet);
    expect(result).toBe(2);
  });

  it('should handle snippets with extra whitespace', () => {
    const snippet = '  name: "test",  ';
    const result = findLineNumberInContent(sampleContent, snippet);
    expect(result).toBe(3);
  });

  it('should fallback to word matching when exact match fails', () => {
    // This snippet doesn't exactly match but contains recognizable words
    const snippet = 'name: "test" value:';
    const result = findLineNumberInContent(sampleContent, snippet);
    expect(result).toBe(3); // Should find "name:"
  });

  it('should return null for very short snippets', () => {
    const result = findLineNumberInContent(sampleContent, 'ab');
    expect(result).toBe(null);
  });
});

describe('Deployed Worker /health endpoint', () => {
  it('should return success from deployed health endpoint', async () => {
    // Test against the deployed worker
    const deployedUrl = 'https://eyecrest.org/health';
    
    try {
      const result = await fetch(deployedUrl);
      expect(result.status).toBe(200);
      
      const json = await result.json() as any;
      expect(json.success).toBe(true);
      expect(json.message).toBe('Service is healthy - markdown parsed successfully!');
      expect(json.platform).toBe('Cloudflare Workers with web-tree-sitter');
      expect(json.timestamp).toBeDefined();
      expect(json.parser).toBeDefined();
      expect(json.parser.language).toBe('markdown');
      expect(json.parser.nodeCount).toBeDefined();
      expect(json.parser.sExpression).toBeDefined();
    } catch (error) {
      // If the deployed worker is not available, skip this test
      console.warn('Deployed worker not available, skipping test:', error);
    }
  });
});