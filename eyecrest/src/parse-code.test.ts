import { describe, test, expect } from 'vitest';
import { parseCode } from './parse-code.js';

describe('parseCode', () => {
  test('should parse JavaScript code and return AST', async () => {
    const result = await parseCode({
      extension: 'js',
      contents: `function hello(name) {
  console.log("Hello, " + name + "!");
  return "Hello " + name;
}

const greeting = hello("Tree-sitter");
console.log(greeting);`
    });

    expect(result).toMatchInlineSnapshot();
  });

});
