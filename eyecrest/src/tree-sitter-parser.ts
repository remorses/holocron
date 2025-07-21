// Global tree-sitter setup
let treeSitterParser: any = null
let treeSitterLanguages: Record<string, any> = {}

async function initTreeSitter() {
    // web-tree-sitter doesn't work well in Cloudflare Workers due to missing Node.js APIs
    // For now, we'll provide a mock implementation that shows the structure
    console.log('Tree-sitter initialization skipped - using mock parser for Cloudflare Workers compatibility')
    
    // Mock implementation - no actual parsing but shows structure
    treeSitterParser = {
        setLanguage: () => {},
        parse: (code: string) => ({
            rootNode: {
                type: 'program',
                childCount: 1,
                startPosition: { row: 0, column: 0 },
                endPosition: { row: code.split('\n').length - 1, column: code.split('\n').pop()?.length || 0 },
                text: code.length > 100 ? code.substring(0, 100) + '...' : code,
                toString: () => `(program ${code.split('\n').length} lines)`,
                descendantCount: code.split(/\s+/).length // rough estimate
            }
        })
    }
    
    // Set all languages to use the same mock parser
    treeSitterLanguages.javascript = true
    treeSitterLanguages.markdown = true
    treeSitterLanguages.mdx = true
}

function getLanguageFromExtension(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase()
    switch (ext) {
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
            return 'javascript'
        case 'md':
            return 'markdown'
        case 'mdx':
            return 'mdx'
        default:
            return 'javascript' // fallback
    }
}

export async function parseWithTreeSitter(content: string, filePath: string) {
    await initTreeSitter()

    const language = getLanguageFromExtension(filePath)
    const languageParser = treeSitterLanguages[language]

    if (!languageParser) {
        throw new Error(
            `Unsupported language: ${language} for file: ${filePath}`,
        )
    }

    treeSitterParser.setLanguage(languageParser)
    const tree = treeSitterParser.parse(content)

    if (!tree) {
        throw new Error(`Failed to parse ${filePath}`)
    }

    const rootNode = tree.rootNode

    // Helper function to convert tree to JSON (simplified for mock)
    function nodeToJson(node: any): any {
        return {
            type: node.type,
            startPosition: node.startPosition,
            endPosition: node.endPosition,
            text: node.text,
            children: undefined, // Simplified - no children in mock
        }
    }

    return {
        language,
        parseTree: nodeToJson(rootNode),
        sExpression: rootNode.toString(),
        stats: {
            nodeCount: (rootNode as any).descendantCount || 'unknown',
        },
    }
}