import { marked } from 'marked';

export interface Section {
  heading: string;
  content: string;
  level: number;
  orderIndex: number;
}

export interface ParsedMarkdown {
  sections: Section[];
  totalSections: number;
}

/**
 * Parse markdown content into sections delimited by headings
 * Each section includes a heading and the content that follows it until the next heading
 */
export function parseMarkdownIntoSections(content: string): ParsedMarkdown {
  // Parse markdown to tokens
  const tokens = marked.lexer(content);
  
  const sections: Section[] = [];
  let currentHeading = '';
  let currentLevel = 1;
  let currentContent: string[] = [];
  let orderIndex = 0;

  // Helper function to save current section
  const saveCurrentSection = () => {
    if (currentHeading || currentContent.length > 0) {
      sections.push({
        heading: currentHeading || 'Introduction',
        content: currentContent.join('\n').trim(),
        level: currentLevel,
        orderIndex: orderIndex++
      });
      currentContent = [];
    }
  };

  for (const token of tokens) {
    if (token.type === 'heading') {
      // Save previous section
      saveCurrentSection();
      
      // Start new section
      currentHeading = token.text;
      currentLevel = token.depth;
    } else {
      // Add content to current section
      // Convert token back to markdown for storage
      const tokenMarkdown = tokenToMarkdown(token);
      if (tokenMarkdown.trim()) {
        currentContent.push(tokenMarkdown);
      }
    }
  }

  // Save final section
  saveCurrentSection();

  // If no sections were created (no headings), create a single section
  if (sections.length === 0 && content.trim()) {
    sections.push({
      heading: 'Content',
      content: content.trim(),
      level: 1,
      orderIndex: 0
    });
  }

  return {
    sections,
    totalSections: sections.length
  };
}

/**
 * Convert a marked token back to markdown string
 */
function tokenToMarkdown(token: any): string {
  switch (token.type) {
    case 'paragraph':
      return token.text + '\n';
    
    case 'code':
      return '```' + (token.lang || '') + '\n' + token.text + '\n```\n';
    
    case 'blockquote':
      return '> ' + token.text + '\n';
    
    case 'list':
      return token.items
        .map((item, index) => {
          const marker = token.ordered ? `${index + 1}. ` : '- ';
          return marker + item.text;
        })
        .join('\n') + '\n';
    
    case 'list_item':
      return '- ' + token.text + '\n';
    
    case 'hr':
      return '---\n';
    
    case 'table':
      const header = '| ' + token.header.map(cell => cell.text).join(' | ') + ' |';
      const separator = '| ' + token.header.map(() => '---').join(' | ') + ' |';
      const rows = token.rows.map(row => 
        '| ' + row.map(cell => cell.text).join(' | ') + ' |'
      );
      return [header, separator, ...rows].join('\n') + '\n';
    
    case 'text':
      return token.text;
    
    case 'space':
      return '\n';
    
    default:
      // For other token types, try to extract text or return raw
      return (token as any).text || (token as any).raw || '';
  }
}

/**
 * Check if a file extension is supported for section parsing
 */
export function isSupportedMarkdownFile(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop();
  return ext === 'md' || ext === 'mdx';
}