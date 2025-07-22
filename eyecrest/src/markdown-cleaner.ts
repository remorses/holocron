import { marked } from 'marked';

/**
 * Cleans markdown/MDX content using marked parser, removing all syntax and leaving only text
 */
export function cleanMarkdownContent(content: string): string {
  // Pre-process to remove MDX-specific content that marked doesn't handle
  let cleaned = content
    // Remove frontmatter
    .replace(/^---[\s\S]*?---/m, '')
    // Remove import statements
    .replace(/^import\s+.*?from\s+['"].*?['"];?$/gm, '')
    // Remove export statements  
    .replace(/^export\s+.*?$/gm, '')
    // Remove JSX/MDX components (both self-closing and with children)
    .replace(/<[A-Z][A-Za-z0-9]*(?:\s+[^>]*)?\/>/g, '') // Self-closing
    .replace(/<[A-Z][A-Za-z0-9]*(?:\s+[^>]*)?>[\s\S]*?<\/[A-Z][A-Za-z0-9]*>/g, ''); // With children

  // Parse with marked to get AST
  const tokens = marked.lexer(cleaned);
  
  // Walk through the token tree and extract only text content
  const walkTokens = (token: marked.Token): string => {
    switch (token.type) {
      case 'text':
      case 'codespan':
        return token.text;
      
      case 'strong':
      case 'em':
      case 'del':
      case 'link':
        if ('tokens' in token && token.tokens) {
          return token.tokens.map(walkTokens).join('');
        }
        return token.text || '';
      
      case 'image':
        return token.text || ''; // alt text
      
      case 'code':
        return token.text;
        
      case 'space':
      case 'br':
        return ' ';
        
      case 'html':
      case 'hr':
      case 'escape':
      case 'def':
        return '';
        
      default:
        // For any token with nested tokens, recurse
        if ('tokens' in token && Array.isArray(token.tokens)) {
          return token.tokens.map(walkTokens).join(' ');
        }
        // For any token with items (lists)
        if ('items' in token && Array.isArray(token.items)) {
          return token.items.map((item: any) => {
            if (item.tokens) {
              return item.tokens.map(walkTokens).join(' ');
            }
            return item.text || '';
          }).join(' ');
        }
        // For tables
        if (token.type === 'table' && 'header' in token) {
          const headerText = token.header.map((cell: any) => {
            if (cell.tokens) {
              return cell.tokens.map(walkTokens).join(' ');
            }
            return cell.text || '';
          }).join(' ');
          
          const rowsText = token.rows?.map((row: any) => 
            row.map((cell: any) => {
              if (cell.tokens) {
                return cell.tokens.map(walkTokens).join(' ');
              }
              return cell.text || '';
            }).join(' ')
          ).join(' ') || '';
          
          return `${headerText} ${rowsText}`;
        }
        return '';
    }
  };
  
  // Process all tokens
  const textParts = tokens.map(walkTokens).filter(text => text.trim());
  
  // Join and normalize whitespace
  return textParts
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}