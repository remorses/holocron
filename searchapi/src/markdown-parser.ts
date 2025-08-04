import { marked } from 'marked';
import Slugger from 'github-slugger';

export interface Section {
  content: string; // Full markdown content including heading
  headingSlug: string; // URL-friendly slug of the heading
  level: number;
  orderIndex: number;
  startLine: number;
  weight?: number; // Optional weight for ranking
}

export interface ParsedMarkdown {
  sections: Section[];
  totalSections: number;
}

/**
 * Parse markdown content into sections delimited by headings
 * Each section includes the full markdown content (heading + body) until the next heading
 */
export function parseMarkdownIntoSections(content: string): ParsedMarkdown {
  const sections: Section[] = [];
  let orderIndex = 0;
  const slugger = new Slugger();
  
  // Split content into lines for processing
  const lines = content.split('\n');
  
  // Check for frontmatter at the beginning of the file
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/m);
  let currentLineIndex = 0;
  
  if (frontmatterMatch) {
    const frontmatterFullText = frontmatterMatch[0];
    const frontmatterLines = frontmatterFullText.split('\n').length;
    
    // Add frontmatter as a special section with higher weight
    sections.push({
      content: frontmatterFullText.trim(),
      headingSlug: '',
      level: 0, // Special level for frontmatter
      orderIndex: orderIndex++,
      startLine: 1,
      weight: 2.0, // Always use weight 2.0 for frontmatter
    });
    
    currentLineIndex = frontmatterLines;
  }
  
  // Find all heading positions
  const headingPositions: { line: number; level: number; text: string }[] = [];
  
  for (let i = currentLineIndex; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      headingPositions.push({
        line: i,
        level: headingMatch[1].length,
        text: headingMatch[2]
      });
    }
  }
  
  // If no headings found, treat entire content (minus frontmatter) as one section
  if (headingPositions.length === 0) {
    if (currentLineIndex < lines.length) {
      const remainingContent = lines.slice(currentLineIndex).join('\n').trim();
      if (remainingContent) {
        sections.push({
          content: remainingContent,
          headingSlug: 'introduction',
          level: 1,
          orderIndex: orderIndex++,
          startLine: currentLineIndex + 1
        });
      }
    }
  } else {
    // Process content before first heading if any
    if (currentLineIndex < headingPositions[0].line) {
      const introContent = lines.slice(currentLineIndex, headingPositions[0].line).join('\n').trim();
      if (introContent) {
        sections.push({
          content: introContent,
          headingSlug: 'introduction',
          level: 1,
          orderIndex: orderIndex++,
          startLine: currentLineIndex + 1
        });
      }
    }
    
    // Process each heading and its content
    for (let i = 0; i < headingPositions.length; i++) {
      const currentHeading = headingPositions[i];
      const nextHeading = headingPositions[i + 1];
      
      const startLine = currentHeading.line;
      const endLine = nextHeading ? nextHeading.line : lines.length;
      
      const sectionContent = lines.slice(startLine, endLine).join('\n').trim();
      
      if (sectionContent) {
        // Assign weights based on heading level - higher level (H1) gets higher weight
        let weight = 1.0;
        switch (currentHeading.level) {
          case 1:
            weight = 1.2; // H1 headers
            break;
          case 2:
            weight = 1.1; // H2 headers
            break;
          case 3:
            weight = 1.05; // H3 headers
            break;
          default:
            weight = 1.0; // H4-H6 headers
        }
        
        sections.push({
          content: sectionContent,
          headingSlug: slugger.slug(currentHeading.text),
          level: currentHeading.level,
          orderIndex: orderIndex++,
          startLine: startLine + 1, // Convert to 1-based line numbering
          weight
        });
      }
    }
  }

  return {
    sections,
    totalSections: sections.length
  };
}

/**
 * Check if a file extension is supported for section parsing
 */
export function isSupportedMarkdownFile(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop();
  return ext === 'md' || ext === 'mdx';
}