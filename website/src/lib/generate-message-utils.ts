import { generateMessageStream } from './spiceflow-generate-message'
import { FileSystemEmulator } from './file-system-emulator'
import { VirtualFile } from 'fumadocs-core/source'
import { ProcessorDataFrontmatter } from 'docs-website/src/lib/mdx-heavy'
import { createAiCacheMiddleware } from 'contesto/src/lib/ai-cache'
import {
    wrapLanguageModel,
    readUIMessageStream,
    type CoreMessage,
    type UIMessage,
    isToolUIPart,
} from 'ai'
import type { FileUpdate } from 'docs-website/src/lib/edit-tool'
import { asyncIterableToReadableStream } from 'contesto/src/lib/utils'
import { printDirectoryTree } from 'docs-website/src/lib/directory-tree'
import { getFilesFromFilesInDraft } from 'docs-website/src/lib/source.server'
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
            lines.push('')
            lines.push('````md reasoning')
            lines.push((part.text || '').trim())
            lines.push('````')
            lines.push('')
        } else if (isToolUIPart(part) && part.state !== 'input-streaming') {
            const toolData = {
                input: part.input,
                output: part.output,
                errorText: part.errorText,
            }

            lines.push('````yaml ' + part.type)
            lines.push(
                yaml.dump(toolData, {
                    indent: 2,
                    lineWidth: 100,
                    noRefs: true,
                    sortKeys: false,
                }),
            )
            lines.push('````')
        } else if (part.type === 'file') {
            // File attachments
            const fileData = {
                filename: part.filename || 'unnamed',
                mediaType: part.mediaType || 'unknown',
                ...(part.url && { url: part.url }),
            }

            lines.push('')
            lines.push('````yaml ' + part.type)
            lines.push(
                yaml.dump(fileData, {
                    indent: 2,
                    lineWidth: 80,
                    noRefs: true,
                    sortKeys: false,
                }),
            )
            lines.push('````')
            lines.push('')
        } else if (part.type === 'source-url') {
            // Source URL references
            const sourceData = {
                title: part.title || part.url,
                url: part.url,
            }

            lines.push('')
            lines.push('````yaml ' + part.type)
            lines.push(
                yaml.dump(sourceData, {
                    indent: 2,
                    lineWidth: 80,
                    noRefs: true,
                    sortKeys: false,
                }),
            )
            lines.push('````')
        } else if (part.type === 'step-start') {
            // Step boundaries for structured output
            lines.push(`\n--- ${(part as any).type} ---\n`)
        }
    }

    return lines.join('\n').trim()
}

/**
 * Serialize filesInDraft to markdown format with file tree
 */
export function filesInDraftToMarkdown(
    filesInDraft: Record<string, FileUpdate>,
): string {
    const lines: string[] = []

    // Filter out deleted files (content: null) and get file paths with titles
    const filePaths = Object.entries(filesInDraft)
        .filter(([, file]) => file.content !== null)
        .map(([path]) => ({
            path: path.startsWith('/') ? path.slice(1) : path,
            title: '',
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
        lines.push('='.repeat(50))
        lines.push(`FILE: ${cleanPath}`)
        lines.push('='.repeat(50))
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
            },
        ],
    }))

    // Create FileSystemEmulator
    const fileSystem = new FileSystemEmulator({
        filesInDraft,
        getPageContent: async (_githubPath: string) => {
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

    // Get files from filesInDraft for source
    const files = getFilesFromFilesInDraft(filesInDraft)

    // Generate stream
    const stream = generateMessageStream({
        messages: uiMessages,
        currentSlug,
        filesInDraft,
        fileSystem,
        files,
        isOnboardingChat,
        githubFolder: '',
        defaultLocale: 'en',
        locales: ['en'],
        trieveDatasetId: null,
        modelId: null,
        modelProvider: null,
        experimental_wrapLanguageModel: (model: any) =>
            wrapLanguageModel({
                model,
                middleware: cacheMiddleware,
            }),
    })

    // Convert async generator to ReadableStream
    const readableStream = asyncIterableToReadableStream(stream)

    // Throttling logic
    const throttleMs = 50
    let lastYieldTs = 0
    let lastItem: TestGenerateMessageResult | null = null

    // Use readUIMessageStream to consume the stream and yield results
    for await (const message of readUIMessageStream({
        stream: readableStream,
        onError: (error) => {
            throw error
        },
    })) {
        // Only process assistant messages

        const markdown = uiMessageToMarkdown(message)

        // Build current state item
        const currentFiles = fileSystem.getFilesInDraft()
        const item: TestGenerateMessageResult = {
            markdown,
            filesInDraft: currentFiles,
            filesMarkdown: filesInDraftToMarkdown(currentFiles),
        }
        lastItem = item
        const now = Date.now()
        if (now - lastYieldTs >= throttleMs) {
            yield item
            lastYieldTs = now
            lastItem = null
        }
    }
    // Always yield the last item, if there is one left
    if (lastItem) {
        yield lastItem
    }
}
