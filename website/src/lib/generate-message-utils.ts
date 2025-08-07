import { generateMessageStream } from './spiceflow-generate-message'
import { FileSystemEmulator } from './file-system-emulator'
import { createAiCacheMiddleware } from 'contesto/src/lib/ai-cache'
import { 
    wrapLanguageModel, 
    readUIMessageStream,
    type CoreMessage,
    type UIMessage 
} from 'ai'
import type { FileUpdate } from 'docs-website/src/lib/edit-tool'
import { asyncIterableToReadableStream } from 'contesto/src/lib/utils'
import { printDirectoryTree } from 'docs-website/src/lib/directory-tree'
import * as yaml from 'js-yaml'

/**
 * Result type for testGenerateMessage generator
 */
export type TestGenerateMessageResult = {
    markdown: string
    filesInDraft: Record<string, FileUpdate>
    filesMarkdown: string
}

/**
 * Utility to convert UI message to markdown format for snapshots
 */
export function uiMessageToMarkdown(message: UIMessage): string {
    const lines: string[] = []
    
    if (!message.parts) return ''
    
    for (const part of message.parts) {
        if (part.type === 'text') {
            // Regular text content
            if (part.text) {
                lines.push(part.text)
            }
        } else if (part.type === 'reasoning') {
            // Reasoning content (for o1 models)
            lines.push('\n## Reasoning\n')
            lines.push(part.text || '')
        } else if (part.type === 'tool-call') {
            // Tool call with args
            const toolCallPart = part as any
            const toolData = {
                toolName: toolCallPart.toolName,
                input: toolCallPart.args || {}
            }
            lines.push('\n<tool-call>')
            lines.push(yaml.dump(toolData, { 
                indent: 2, 
                lineWidth: 80,
                noRefs: true,
                sortKeys: false
            }))
            lines.push('</tool-call>\n')
        } else if (part.type.startsWith('tool-')) {
            // Tool parts with various states
            const toolPart = part as any
            const toolName = part.type.replace('tool-', '')
            
            if (toolPart.state === 'input-available' || toolPart.state === 'input-streaming') {
                const toolData = {
                    toolName: toolName,
                    state: toolPart.state,
                    input: toolPart.input || {}
                }
                
                // Special handling for strReplaceEditor to make it more readable
                if (toolName === 'strReplaceEditor' && typeof toolPart.input === 'object') {
                    const input = toolPart.input as any
                    if (input.command === 'view') {
                        toolData.input = {
                            command: 'view',
                            path: input.path,
                            ...(input.view_range && { view_range: input.view_range })
                        }
                    } else if (input.command === 'create') {
                        toolData.input = {
                            command: 'create',
                            path: input.path,
                            file_text: input.file_text || ''
                        }
                    } else if (input.command === 'str_replace') {
                        toolData.input = {
                            command: 'str_replace',
                            path: input.path,
                            old_str: input.old_str || '',
                            new_str: input.new_str || ''
                        }
                    }
                }
                
                lines.push('\n<tool-input>')
                lines.push(yaml.dump(toolData, { 
                    indent: 2, 
                    lineWidth: 80,
                    noRefs: true,
                    sortKeys: false
                }))
                lines.push('</tool-input>\n')
            }
            
            if (toolPart.state === 'output-available' && toolPart.output) {
                const toolData = {
                    toolName: toolName,
                    state: 'output',
                    output: toolPart.output
                }
                
                lines.push('\n<tool-output>')
                lines.push(yaml.dump(toolData, { 
                    indent: 2, 
                    lineWidth: 80,
                    noRefs: true,
                    sortKeys: false,
                    skipInvalid: true
                }))
                lines.push('</tool-output>\n')
            }
            
            if (toolPart.state === 'output-error') {
                const toolData = {
                    toolName: toolName,
                    state: 'error',
                    error: toolPart.errorText || 'Unknown error'
                }
                
                lines.push('\n<tool-error>')
                lines.push(yaml.dump(toolData, { 
                    indent: 2, 
                    lineWidth: 80,
                    noRefs: true,
                    sortKeys: false
                }))
                lines.push('</tool-error>\n')
            }
        } else if (part.type === 'file') {
            // File attachments
            const fileData = {
                type: 'file',
                filename: part.filename || 'unnamed',
                mediaType: part.mediaType || 'unknown',
                ...(part.url && { url: part.url })
            }
            
            lines.push('\n<file-attachment>')
            lines.push(yaml.dump(fileData, { 
                indent: 2, 
                lineWidth: 80,
                noRefs: true,
                sortKeys: false
            }))
            lines.push('</file-attachment>\n')
        } else if (part.type === 'source-url') {
            // Source URL references
            const sourceData = {
                type: 'source-url',
                title: part.title || part.url,
                url: part.url
            }
            
            lines.push('\n<source-reference>')
            lines.push(yaml.dump(sourceData, { 
                indent: 2, 
                lineWidth: 80,
                noRefs: true,
                sortKeys: false
            }))
            lines.push('</source-reference>\n')
        } else if ((part as any).type === 'step-start' || (part as any).type === 'step-finish') {
            // Step boundaries for structured output
            lines.push(`\n--- ${(part as any).type} ---\n`)
        }
    }
    
    return lines.join('\n').trim()
}

/**
 * Serialize filesInDraft to markdown format with file tree
 */
export function filesInDraftToMarkdown(filesInDraft: Record<string, FileUpdate>): string {
    const lines: string[] = []
    
    // Filter out deleted files (content: null) and get file paths with titles
    const filePaths = Object.entries(filesInDraft)
        .filter(([, file]) => file.content !== null)
        .map(([path]) => ({
            path: path.startsWith('/') ? path.slice(1) : path,
            title: ''
        }))
        .sort((a, b) => a.path.localeCompare(b.path))
    
    if (filePaths.length === 0) {
        return 'No files created.'
    }
    
    // Add file tree at the top
    lines.push('# File Tree\n')
    lines.push(printDirectoryTree({ filePaths }))
    lines.push('\n')
    
    // Add individual file contents
    const sortedFiles = Object.entries(filesInDraft)
        .filter(([, file]) => file.content !== null)
        .sort(([a], [b]) => a.localeCompare(b))
    
    for (const [path, file] of sortedFiles) {
        const cleanPath = path.startsWith('/') ? path.slice(1) : path
        lines.push('=' .repeat(50))
        lines.push(`FILE: ${cleanPath}`)
        lines.push('=' .repeat(50))
        lines.push(file.content || '')
        lines.push('\n')
    }
    
    return lines.join('\n').trim()
}

/**
 * Input parameters for testGenerateMessage
 */
export type TestGenerateMessageInput = {
    messages: CoreMessage[]
    filesInDraft?: Record<string, FileUpdate>
    isOnboardingChat?: boolean
    currentSlug?: string
}

/**
 * Test utility for generateMessageStream - yields results as they stream
 */
export async function* testGenerateMessage({
    messages,
    filesInDraft = {},
    isOnboardingChat = true,
    currentSlug = '/',
}: TestGenerateMessageInput): AsyncGenerator<TestGenerateMessageResult> {
    // Convert CoreMessages to UIMessages format
    const uiMessages: UIMessage[] = messages.map((msg, idx) => ({
        id: `msg-${idx}`,
        role: msg.role as 'user' | 'assistant',
        parts: [
            {
                type: 'text',
                text: typeof msg.content === 'string' ? msg.content : '',
            }
        ],
    }))
    
    // Create FileSystemEmulator
    const fileSystem = new FileSystemEmulator({
        filesInDraft,
        getPageContent: async (githubPath: string) => {
            // For new files being created, return empty string
            // Files being edited should already be in filesInDraft
            return ''
        },
        onFilesDraftChange: async () => {
            // No-op for tests
        },
    })
    
    // Create AI cache middleware
    const cacheMiddleware = createAiCacheMiddleware({
        cacheDir: '.test-aicache',
        lruSize: 100,
    })
    
    // Generate stream
    const stream = generateMessageStream({
        messages: uiMessages,
        currentSlug,
        filesInDraft,
        fileSystem,
        files: [], // Empty for onboarding
        isOnboardingChat,
        githubFolder: '',
        defaultLocale: 'en',
        locales: ['en'],
        trieveDatasetId: null,
        modelId: null,
        modelProvider: null,
        experimental_wrapLanguageModel: (model: any) => wrapLanguageModel({
            model,
            middleware: cacheMiddleware,
        }),
    })
    
    // Convert async generator to ReadableStream
    const readableStream = asyncIterableToReadableStream(stream)
    
    // Use readUIMessageStream to consume the stream and yield results
    for await (const message of readUIMessageStream({
        stream: readableStream,
        onError: (error) => {
            throw error
        },
    })) {
        // Only process assistant messages
        if (message.role === 'assistant') {
            const markdown = uiMessageToMarkdown(message)
            
            // Yield current state
            const currentFiles = fileSystem.getFilesInDraft()
            yield {
                markdown,
                filesInDraft: currentFiles,
                filesMarkdown: filesInDraftToMarkdown(currentFiles),
            }
        }
    }
}