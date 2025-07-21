import { describe, it, expect } from 'vitest';
import { parseWithTreeSitter } from './tree-sitter-parser.js';

describe('parseWithTreeSitter', () => {
  it('should parse JavaScript code correctly', async () => {
    const code = `function hello(name) {
  console.log("Hello, " + name + "!");
  return "Hello " + name;
}`;
    const filePath = 'example.js';

    const result = await parseWithTreeSitter(code, filePath);

    expect(result).toMatchInlineSnapshot(`
      {
        "language": "javascript",
        "parseTree": {
          "children": undefined,
          "endPosition": {
            "column": 1,
            "row": 3,
          },
          "startPosition": {
            "column": 0,
            "row": 0,
          },
          "text": "function hello(name) {
        console.log("Hello, " + name + "!");
        return "Hello " + name;
      }",
          "type": "program",
        },
        "sExpression": "(program 4 lines)",
        "stats": {
          "nodeCount": 15,
        },
      }
    `);
    expect(result.language).toBe('javascript');
    expect(result.parseTree).toBeDefined();
    expect(result.sExpression).toBeDefined();
    expect(result.stats.nodeCount).toBeDefined();
  });

  // TODO: Fix markdown parser WASM loading issue
  it.skip('should parse Markdown code correctly', async () => {
    const code = `# Hello World

This is a **markdown** document with:
- Lists
- And other features`;
    const filePath = 'example.md';

    const result = await parseWithTreeSitter(code, filePath);

    expect(result).toMatchInlineSnapshot();
    expect(result.language).toBe('markdown');
    expect(result.parseTree).toBeDefined();
    expect(result.sExpression).toBeDefined();
  });

});
