import { describe, it, expect } from 'vitest';
import { splitMarkdownSections, splitJavaScriptSections, splitIntoSections } from './section-splitter.js';

describe('splitMarkdownSections', () => {
  it('should split markdown by headings', () => {
    const content = `# Main Title

Some intro content here.

## Section 1

Content for section 1.

### Subsection 1.1

More content.

## Section 2

Final content.`;

    const sections = splitMarkdownSections(content);
    
    expect(sections).toMatchInlineSnapshot(`
      [
        {
          "content": "# Main Title

      Some intro content here.
      ",
          "endLine": 4,
          "level": 1,
          "startLine": 1,
          "title": "Main Title",
          "type": "heading",
        },
        {
          "content": "## Section 1

      Content for section 1.
      ",
          "endLine": 8,
          "level": 2,
          "startLine": 5,
          "title": "Section 1",
          "type": "heading",
        },
        {
          "content": "### Subsection 1.1

      More content.
      ",
          "endLine": 12,
          "level": 3,
          "startLine": 9,
          "title": "Subsection 1.1",
          "type": "heading",
        },
        {
          "content": "## Section 2

      Final content.",
          "endLine": 15,
          "level": 2,
          "startLine": 13,
          "title": "Section 2",
          "type": "heading",
        },
      ]
    `);
    expect(sections).toHaveLength(4);
    expect(sections[0].title).toBe('Main Title');
    expect(sections[0].level).toBe(1);
    expect(sections[1].title).toBe('Section 1');
    expect(sections[1].level).toBe(2);
  });

  it('should handle frontmatter', () => {
    const content = `---
title: "Test Document"
date: 2024-01-01
---

# Introduction

Content here.`;

    const sections = splitMarkdownSections(content);
    
    expect(sections).toHaveLength(2);
    expect(sections[0].type).toBe('frontmatter');
    expect(sections[0].title).toBe('Frontmatter');
    expect(sections[1].title).toBe('Introduction');
  });

  it('should handle content without headings', () => {
    const content = `Just some plain text content
without any headings.

Multiple paragraphs.`;

    const sections = splitMarkdownSections(content);
    
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Content');
    expect(sections[0].type).toBe('heading');
  });
});

describe('splitJavaScriptSections', () => {
  it('should split JavaScript by top-level constructs', () => {
    const content = `import React from 'react';
import { useState } from 'react';

const API_URL = 'https://api.example.com';
const DEBUG = true;

function fetchData(url) {
  return fetch(url).then(res => res.json());
}

class DataService {
  constructor(apiUrl) {
    this.apiUrl = apiUrl;
  }
  
  async getData() {
    return fetchData(this.apiUrl);
  }
}

export default DataService;`;

    const sections = splitJavaScriptSections(content);
    
    expect(sections).toMatchInlineSnapshot(`
      [
        {
          "content": "import React from 'react';
      import { useState } from 'react';",
          "endLine": 3,
          "startLine": 1,
          "title": "Imports (2)",
          "type": "import_group",
        },
        {
          "content": "const API_URL = 'https://api.example.com';
      const DEBUG = true;
      ",
          "endLine": 6,
          "startLine": 4,
          "title": "Variables & Statements",
          "type": "statement_group",
        },
        {
          "content": "function fetchData(url) {
        return fetch(url).then(res => res.json());
      }",
          "endLine": 9,
          "startLine": 7,
          "title": "Function: fetchData",
          "type": "function",
        },
        {
          "content": "class DataService {
        constructor(apiUrl) {
          this.apiUrl = apiUrl;
        }
        
        async getData() {
          return fetchData(this.apiUrl);
        }
      }",
          "endLine": 19,
          "startLine": 11,
          "title": "Class: DataService",
          "type": "class",
        },
      ]
    `);
    expect(sections.length).toBeGreaterThan(0);
    
    const importSection = sections.find(s => s.type === 'import_group');
    const functionSection = sections.find(s => s.type === 'function');
    const classSection = sections.find(s => s.type === 'class');
    const statementSection = sections.find(s => s.type === 'statement_group');
    
    expect(importSection).toBeDefined();
    expect(functionSection).toBeDefined();
    expect(classSection).toBeDefined();
    // Note: statement section may not be created if variables are not grouped together
  });

  it('should group related short statements', () => {
    const content = `const name = 'John';
const age = 25;
const city = 'NYC';

function longFunction() {
  // This is a longer function
  console.log('hello');
}`;

    const sections = splitJavaScriptSections(content);
    
    
    const statementGroup = sections.find(s => s.type === 'statement_group');
    expect(statementGroup).toBeDefined();
    expect(statementGroup?.title).toBe('Variables & Statements');
    
    const functionSection = sections.find(s => s.type === 'function');
    expect(functionSection?.title).toBe('Function: longFunction');
  });
});

describe('splitIntoSections', () => {
  it('should route to correct splitter based on file extension', () => {
    const jsContent = 'function test() { return true; }';
    const mdContent = '# Title\nContent';
    
    const jsSections = splitIntoSections(jsContent, 'test.js');
    const mdSections = splitIntoSections(mdContent, 'test.md');
    
    expect(jsSections[0].type).toBe('function');
    expect(mdSections[0].type).toBe('heading');
  });

  it('should handle unknown file extensions', () => {
    const content = 'Some unknown content';
    const sections = splitIntoSections(content, 'test.xyz');
    
    expect(sections).toHaveLength(1);
    expect(sections[0].type).toBe('code_block');
    expect(sections[0].title).toBe('XYZ Content');
  });
});