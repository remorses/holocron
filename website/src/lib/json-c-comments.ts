import { visit, JSONVisitor, parseTree, ParseError, getNodePath, parse } from 'jsonc-parser'

export interface JsonCComments {
    [keyPath: string]: string
}

export interface ExtractJsonCCommentsResult {
    comments: JsonCComments
    data: any
}

/**
 * Extracts comments from a JSON-C string that are above object keys and array elements
 * Returns both the parsed object and a map of key paths to their associated comments (including //)
 * Supports nested objects with dot notation and arrays with bracket notation for key paths
 */
export function extractJsonCComments(jsonCString: string): ExtractJsonCCommentsResult {
    const comments: JsonCComments = {}
    
    // Store all comments with their line numbers
    const commentLines: Array<{line: number, text: string}> = []
    
    // Track array contexts and current path
    const pathStack: string[] = []
    const arrayIndices: Map<number, number> = new Map() // depth -> current index
    
    // First pass: collect all comments
    visit(jsonCString, {
        onComment: (offset: number, length: number, startLine: number) => {
            const text = jsonCString.substring(offset, offset + length)
            commentLines.push({ line: startLine, text })
        }
    } as JSONVisitor)
    
    // Helper to collect comments above a line
    function getCommentsAboveLine(targetLine: number): string {
        const collected: string[] = []
        let currentLine = targetLine - 1
        
        // Collect all consecutive comments above the target line
        while (currentLine >= 0) {
            const commentsAtLine = commentLines.filter(c => c.line === currentLine)
            if (commentsAtLine.length === 0) {
                // No comment at this line, stop looking
                break
            }
            // Add comments in reverse order since we're going backwards
            collected.unshift(...commentsAtLine.map(c => c.text))
            currentLine--
        }
        
        return collected.join('\n')
    }
    
    // Second pass: parse structure and associate comments
    visit(jsonCString, {
        onObjectProperty: (property: string, offset: number, length: number, startLine: number, startCharacter: number, pathSupplier: () => any[]) => {
            const path = pathSupplier()
            
            // Convert path to dot notation, treating numbers as string indices
            const fullPath = [...path, property].join('.')
            
            const comment = getCommentsAboveLine(startLine)
            if (comment) {
                comments[fullPath] = comment
            }
        },
        
        onObjectBegin: (offset: number, length: number, startLine: number, startCharacter: number, pathSupplier: () => any[]) => {
            const path = pathSupplier()
            
            // Check if the last element in path is a number (array index)
            if (path.length > 0 && typeof path[path.length - 1] === 'number') {
                // This is an object inside an array
                const arrayIndex = path[path.length - 1] as number
                const arrayPath = path.slice(0, -1).join('.')
                const fullPath = arrayPath ? `${arrayPath}.${arrayIndex}` : `${arrayIndex}`
                
                const comment = getCommentsAboveLine(startLine)
                if (comment) {
                    comments[fullPath] = comment
                }
            }
        },
        
        onArrayBegin: (offset: number, length: number, startLine: number, startCharacter: number, pathSupplier: () => any[]) => {
            const path = pathSupplier()
            const pathStr = path.join('.')
            
            if (pathStr) {
                // Store comment for the array itself
                const comment = getCommentsAboveLine(startLine)
                if (comment) {
                    comments[pathStr] = comment
                }
            }
        },
        
        onLiteralValue: (value: any, offset: number, length: number, startLine: number, startCharacter: number, pathSupplier: () => any[]) => {
            const path = pathSupplier()
            
            // Check if we're in an array (last element is a number)
            if (path.length > 0 && typeof path[path.length - 1] === 'number') {
                const arrayIndex = path[path.length - 1] as number
                const arrayPath = path.slice(0, -1).join('.')
                const fullPath = arrayPath ? `${arrayPath}.${arrayIndex}` : `${arrayIndex}`
                
                const comment = getCommentsAboveLine(startLine)
                if (comment) {
                    comments[fullPath] = comment
                }
            }
        }
    } as JSONVisitor, {
        allowTrailingComma: true,
        allowEmptyContent: true,
        disallowComments: false
    })
    
    // Parse the JSON to get the actual data
    const errors: ParseError[] = []
    const data = parse(jsonCString, errors, {
        allowTrailingComma: true,
        allowEmptyContent: true,
        disallowComments: false
    })
    
    if (errors.length > 0) {
        throw new Error(`Failed to parse JSON-C: ${errors[0].error}`)
    }
    
    return { comments, data }
}

/**
 * Applies comments to a JSON object by converting it to a formatted JSON-C string
 * @param obj The object to apply comments to
 * @param comments Map of key paths to comment strings
 * @param indent Number of spaces for indentation (default: 4)
 * @returns JSON-C string with comments applied
 */
export function applyJsonCComments(obj: any, comments: JsonCComments, indent: number = 4): string {
    // First stringify the object to get a baseline
    const jsonString = JSON.stringify(obj, null, indent)
    
    // Parse the JSON to get position information
    const errors: ParseError[] = []
    const tree = parseTree(jsonString, errors)
    
    if (!tree || errors.length > 0) {
        throw new Error('Failed to parse JSON for comment application')
    }
    
    // Collect all positions where we need to insert comments
    const insertions: Array<{offset: number, comment: string, indent: number}> = []
    
    // Visit the tree to find where to insert comments
    function visitNode(node: any, currentPath: string[] = []): void {
        if (node.type === 'object' && node.children) {
            // Handle root object
            if (currentPath.length === 0) {
                for (const child of node.children) {
                    if (child.children && child.children.length >= 2) {
                        const keyNode = child.children[0]
                        const valueNode = child.children[1]
                        
                        if (keyNode.value) {
                            const fullPath = keyNode.value
                            
                            // Check if we have a comment for this path
                            if (comments[fullPath]) {
                                // Find the line start for proper indentation
                                const lineStart = findLineStart(jsonString, keyNode.offset)
                                const lineIndent = keyNode.offset - lineStart
                                
                                insertions.push({
                                    offset: lineStart,
                                    comment: comments[fullPath],
                                    indent: lineIndent
                                })
                            }
                            
                            // Recursively visit the value
                            if (valueNode.type === 'object' || valueNode.type === 'array') {
                                visitNode(valueNode, [keyNode.value])
                            }
                        }
                    }
                }
            } else {
                // Handle nested objects
                for (const child of node.children) {
                    if (child.children && child.children.length >= 2) {
                        const keyNode = child.children[0]
                        const valueNode = child.children[1]
                        
                        if (keyNode.value) {
                            const fullPath = [...currentPath, keyNode.value].join('.')
                            
                            // Check if we have a comment for this path
                            if (comments[fullPath]) {
                                // Find the line start for proper indentation
                                const lineStart = findLineStart(jsonString, keyNode.offset)
                                const lineIndent = keyNode.offset - lineStart
                                
                                insertions.push({
                                    offset: lineStart,
                                    comment: comments[fullPath],
                                    indent: lineIndent
                                })
                            }
                            
                            // Recursively visit the value
                            if (valueNode.type === 'object' || valueNode.type === 'array') {
                                visitNode(valueNode, [...currentPath, keyNode.value])
                            }
                        }
                    }
                }
            }
        } else if (node.type === 'array' && node.children) {
            const arrayPath = currentPath.join('.')
            
            // Skip array comment here - it's handled when we visit the property
            
            // Visit array elements
            node.children.forEach((child: any, index: number) => {
                const elementPath = arrayPath ? `${arrayPath}.${index}` : `${index}`
                
                if (comments[elementPath]) {
                    const lineStart = findLineStart(jsonString, child.offset)
                    const lineIndent = child.offset - lineStart
                    
                    insertions.push({
                        offset: lineStart,
                        comment: comments[elementPath],
                        indent: lineIndent
                    })
                }
                
                // If it's an object in array, visit it
                if (child.type === 'object') {
                    visitNode(child, [...currentPath])
                }
            })
        }
    }
    
    // Helper to find the start of a line
    function findLineStart(str: string, offset: number): number {
        let pos = offset
        while (pos > 0 && str[pos - 1] !== '\n') {
            pos--
        }
        return pos
    }
    
    // Start visiting from root
    visitNode(tree)
    
    // Sort insertions by offset (descending) to insert from end to beginning
    insertions.sort((a, b) => b.offset - a.offset)
    
    // Apply insertions
    let result = jsonString
    for (const insertion of insertions) {
        const indentStr = ' '.repeat(insertion.indent)
        const commentLines = insertion.comment.split('\n')
        const commentBlock = commentLines
            .map(line => indentStr + line)
            .join('\n') + '\n'
        
        result = result.slice(0, insertion.offset) + commentBlock + result.slice(insertion.offset)
    }
    
    return result
}