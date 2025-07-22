import { marked, Token } from 'marked';

/**
 * Cleans markdown/MDX content using marked parser, removing all syntax and leaving only text
 */
export function cleanMarkdownContent(content: string): string {
  // Pre-process to remove MDX-specific content that marked doesn't handle
  let cleaned = content
    // Remove frontmatter
    .replace(/^---[\s\S]*?---/m, '')
    // Remove import statements


  // Parse with marked to get AST
  const tokens = marked.lexer(cleaned);

  // Walk through the token tree and extract only text content
  const walkTokens = (token: Token, depth: number = 0): string => {
    switch (token.type) {
      case 'text':
      case 'codespan':
        return token.text;

      case 'strong':
      case 'em':
      case 'del':
      case 'link':
        if ('tokens' in token && token.tokens) {
          return token.tokens.map(t => walkTokens(t, depth)).join('');
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
        
      case 'list':
        if ('items' in token && Array.isArray(token.items)) {
          return token.items.map((item: any, index: number) => {
            // Process item content, handling nested lists
            let itemText = '';
            let nestedList = '';
            
            if (item.tokens) {
              for (const t of item.tokens) {
                if (t.type === 'list') {
                  // Handle nested list separately
                  nestedList = '\n' + walkTokens(t, depth + 1);
                } else {
                  itemText += walkTokens(t, depth);
                }
              }
            } else {
              itemText = item.text || '';
            }
            
            // Add proper indentation
            const indent = '  '.repeat(depth);
            
            // Preserve list markers with indentation
            const marker = token.ordered ? `${index + 1}.` : '-';
            return `${indent}${marker} ${itemText.trim()}${nestedList}`;
          }).join('\n');
        }
        return '';
        
      case 'table':
        if ('header' in token) {
          const headerText = token.header.map((cell: any) => {
            if (cell.tokens) {
              return cell.tokens.map((t: any) => walkTokens(t, depth)).join(' ');
            }
            return cell.text || '';
          }).join(' ');

          const rowsText = token.rows?.map((row: any) =>
            row.map((cell: any) => {
              if (cell.tokens) {
                return cell.tokens.map((t: any) => walkTokens(t, depth)).join(' ');
              }
              return cell.text || '';
            }).join(' ')
          ).join('\n') || '';

          return `${headerText}\n${rowsText}`;
        }
        return '';

      default:
        // For any token with nested tokens, recurse
        if ('tokens' in token && Array.isArray(token.tokens)) {
          return token.tokens.map(t => walkTokens(t, depth)).join(' ');
        }
        return '';
    }
  };

  // Process all tokens and preserve structure
  const processedTokens: string[] = [];
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const text = walkTokens(token);
    
    if (text.trim()) {
      processedTokens.push(text);
      
      // Add newline after block-level elements
      if (token.type === 'heading' || 
          token.type === 'paragraph' || 
          token.type === 'code' || 
          token.type === 'blockquote' ||
          token.type === 'list' ||
          token.type === 'table' ||
          token.type === 'hr') {
        processedTokens.push('\n');
      }
    }
  }
  
  // Join and clean up excessive newlines
  return processedTokens
    .join('')
    .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines to double
    .trim();
}
