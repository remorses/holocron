// Section splitting utilities for different programming languages
// Splits content into logical sections based on language-specific patterns

export interface Section {
    type: 'frontmatter' | 'heading' | 'code_block' | 'statement_group' | 'function' | 'class' | 'import_group'
    title: string
    content: string
    startLine: number
    endLine: number
    level?: number // For headings (1-6) or nesting level
}

/**
 * Split markdown content into sections by headings and frontmatter
 */
export function splitMarkdownSections(content: string): Section[] {
    const lines = content.split('\n')
    const sections: Section[] = []
    let currentSection: Section | null = null
    let lineIndex = 0

    // Handle frontmatter at the beginning
    if (lines[0]?.trim() === '---') {
        const frontmatterEnd = lines.findIndex((line, i) => i > 0 && line.trim() === '---')
        if (frontmatterEnd > 0) {
            sections.push({
                type: 'frontmatter',
                title: 'Frontmatter',
                content: lines.slice(0, frontmatterEnd + 1).join('\n'),
                startLine: 1,
                endLine: frontmatterEnd + 1
            })
            lineIndex = frontmatterEnd + 1
        }
    }

    // Process remaining lines for headings
    for (let i = lineIndex; i < lines.length; i++) {
        const line = lines[i]
        const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
        
        if (headingMatch) {
            // Save previous section
            if (currentSection) {
                currentSection.content = lines.slice(currentSection.startLine - 1, i).join('\n')
                currentSection.endLine = i
                sections.push(currentSection)
            }
            
            // Start new section
            currentSection = {
                type: 'heading',
                title: headingMatch[2].trim(),
                content: '', // Will be set when section ends
                startLine: i + 1,
                endLine: lines.length,
                level: headingMatch[1].length
            }
        }
    }

    // Handle the last section
    if (currentSection) {
        currentSection.content = lines.slice(currentSection.startLine - 1).join('\n')
        currentSection.endLine = lines.length
        sections.push(currentSection)
    }

    // If no headings found, create a single section for the entire content
    if (sections.length === 0 || (sections.length === 1 && sections[0].type === 'frontmatter')) {
        const startLine = sections.length > 0 ? sections[0].endLine + 1 : 1
        sections.push({
            type: 'heading',
            title: 'Content',
            content: lines.slice(startLine - 1).join('\n'),
            startLine,
            endLine: lines.length,
            level: 1
        })
    }

    return sections
}

/**
 * Split JavaScript/TypeScript content into sections by top-level constructs
 */
export function splitJavaScriptSections(content: string): Section[] {
    const lines = content.split('\n')
    const sections: Section[] = []
    
    // Simple regex-based parsing for top-level constructs
    let currentSection: Section | null = null
    let importLines: string[] = []
    let importStart = -1
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        
        // Skip empty lines and comments for section detection, but continue building current sections
        if (!line || line.startsWith('//') || line.startsWith('/*')) {
            if (currentSection && currentSection.type === 'statement_group') {
                // Continue the statement group through empty lines
                currentSection.endLine = i + 1
            }
            continue
        }
        
        // Handle imports - group them together
        if (line.startsWith('import ') || line.startsWith('export ') && line.includes('from')) {
            if (importLines.length === 0) {
                importStart = i
            }
            importLines.push(lines[i])
            continue
        } else if (importLines.length > 0) {
            // End of import group
            sections.push({
                type: 'import_group',
                title: `Imports (${importLines.length})`,
                content: importLines.join('\n'),
                startLine: importStart + 1,
                endLine: i
            })
            importLines = []
            importStart = -1
        }
        
        // Handle different types of constructs
        let processed = false
        
        // Detect function declarations
        if (line.match(/^(export\s+)?(async\s+)?function\s+\w+/) || 
            line.match(/^(export\s+)?const\s+\w+\s*=\s*(async\s+)?\(/)) {
            
            // Close any existing statement group
            if (currentSection && currentSection.type === 'statement_group') {
                currentSection.content = lines.slice(currentSection.startLine - 1, currentSection.endLine).join('\n')
                sections.push(currentSection)
                currentSection = null
            }
            
            const functionMatch = line.match(/function\s+(\w+)/) || 
                                  line.match(/const\s+(\w+)\s*=/)
            const functionName = functionMatch ? functionMatch[1] : 'Anonymous'
            
            currentSection = {
                type: 'function',
                title: `Function: ${functionName}`,
                content: '',
                startLine: i + 1,
                endLine: i + 1
            }
            
            // Find end of function (simple brace matching)
            let braceCount = 0
            let foundStart = false
            
            for (let j = i; j < lines.length; j++) {
                const funcLine = lines[j]
                for (const char of funcLine) {
                    if (char === '{') {
                        braceCount++
                        foundStart = true
                    } else if (char === '}') {
                        braceCount--
                    }
                }
                
                if (foundStart && braceCount === 0) {
                    currentSection.content = lines.slice(i, j + 1).join('\n')
                    currentSection.endLine = j + 1
                    sections.push(currentSection)
                    i = j // Skip to end of function
                    currentSection = null
                    break
                }
            }
            processed = true
        }
        
        // Detect class declarations
        else if (line.match(/^(export\s+)?class\s+\w+/)) {
            // Close any existing statement group
            if (currentSection && currentSection.type === 'statement_group') {
                currentSection.content = lines.slice(currentSection.startLine - 1, currentSection.endLine).join('\n')
                sections.push(currentSection)
                currentSection = null
            }
            
            const classMatch = line.match(/class\s+(\w+)/)
            const className = classMatch ? classMatch[1] : 'Anonymous'
            
            currentSection = {
                type: 'class',
                title: `Class: ${className}`,
                content: '',
                startLine: i + 1,
                endLine: i + 1
            }
            
            // Find end of class
            let braceCount = 0
            let foundStart = false
            
            for (let j = i; j < lines.length; j++) {
                const classLine = lines[j]
                for (const char of classLine) {
                    if (char === '{') {
                        braceCount++
                        foundStart = true
                    } else if (char === '}') {
                        braceCount--
                    }
                }
                
                if (foundStart && braceCount === 0) {
                    currentSection.content = lines.slice(i, j + 1).join('\n')
                    currentSection.endLine = j + 1
                    sections.push(currentSection)
                    i = j // Skip to end of class
                    currentSection = null
                    break
                }
            }
            processed = true
        }
        
        // Detect variable declarations and short statements - group them
        else if (line.match(/^(const|let|var|export const|export let)\s+/) || 
                 line.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*=/) ||
                 (line.length < 80 && line.includes('(') && !line.includes('function'))) {
            
            // Start or continue a statement group
            if (!currentSection || currentSection.type !== 'statement_group') {
                currentSection = {
                    type: 'statement_group',
                    title: 'Variables & Statements',
                    content: '',
                    startLine: i + 1,
                    endLine: i + 1
                }
            }
            
            // Continue building the statement group
            currentSection.endLine = i + 1
            processed = true
        }
        
        // If we haven't processed this line and we have a statement group, close it
        if (!processed && currentSection && currentSection.type === 'statement_group') {
            currentSection.content = lines.slice(currentSection.startLine - 1, currentSection.endLine).join('\n')
            sections.push(currentSection)
            currentSection = null
        }
    }
    
    // Handle remaining import group
    if (importLines.length > 0) {
        sections.push({
            type: 'import_group',
            title: `Imports (${importLines.length})`,
            content: importLines.join('\n'),
            startLine: importStart + 1,
            endLine: lines.length
        })
    }
    
    // Handle remaining statement group
    if (currentSection && currentSection.type === 'statement_group') {
        currentSection.content = lines.slice(currentSection.startLine - 1, currentSection.endLine).join('\n')
        sections.push(currentSection)
    }
    
    return sections
}

/**
 * Main function to split content into sections based on file extension
 */
export function splitIntoSections(content: string, filePath: string): Section[] {
    const ext = filePath.split('.').pop()?.toLowerCase()
    
    switch (ext) {
        case 'md':
        case 'markdown':
        case 'mdx':
            return splitMarkdownSections(content)
        
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
            return splitJavaScriptSections(content)
        
        default:
            // For unknown file types, create a single section
            return [{
                type: 'code_block',
                title: `${ext?.toUpperCase() || 'Text'} Content`,
                content: content,
                startLine: 1,
                endLine: content.split('\n').length
            }]
    }
}