import { generateMessageStream } from './spiceflow-generate-message'
import { FileSystemEmulator } from './file-system-emulator'
import { createAiCacheMiddleware } from 'contesto/src/lib/ai-cache'
import {
  wrapLanguageModel,
  readUIMessageStream,
  type UIMessage,
  type ModelMessage,
  isToolUIPart,
} from 'ai'
import type { FileUpdate } from 'docs-website/src/lib/edit-tool'
import { asyncIterableToReadableStream } from 'contesto/src/lib/utils'
import { printDirectoryTree } from 'docs-website/src/lib/directory-tree'
import { getFilesFromFilesInDraft } from 'docs-website/src/lib/source.server'
import * as yaml from 'js-yaml'
import { WebsiteUIMessage } from './types'

/**
 * Truncate object fields or string to max length
 */
function truncateObjectOrString(value: unknown, maxLength = 1000): unknown {
  if (typeof value === 'string') {
    return value.length > maxLength
      ? value.substring(0, maxLength) + '...'
      : value
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const truncated: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      if (typeof val === 'string' && val.length > maxLength) {
        truncated[key] = val.substring(0, maxLength) + '...'
      } else {
        truncated[key] = val
      }
    }
    return truncated
  }

  return value
}

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
        input: truncateObjectOrString(part.input),
        output: truncateObjectOrString(part.output),
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
    return ''
  }

  // Add file tree at the top
  lines.push('# File Tree\n')
  lines.push(printDirectoryTree({ filePaths }))
  lines.push('\n')

  // Add individual file contents - deduplicate by clean path
  const filesByCleanPath = new Map<string, FileUpdate>()
  for (const [path, file] of Object.entries(filesInDraft)) {
    if (file.content !== null) {
      const cleanPath = path.startsWith('/') ? path.slice(1) : path
      // Later entries override earlier ones with the same clean path
      filesByCleanPath.set(cleanPath, file)
    }
  }

  // Sort by path and output
  const sortedFiles = Array.from(filesByCleanPath.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  )

  for (const [cleanPath, file] of sortedFiles) {
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
  messages: ModelMessage[]
  filesInDraft?: Record<string, FileUpdate>
  currentSlug?: string
}

/**
 * Test utility for generateMessageStream - yields results as they stream
 */
export async function* testGenerateMessage({
  messages,
  filesInDraft = {},
  currentSlug = '/',
}: TestGenerateMessageInput): AsyncGenerator<TestGenerateMessageResult> {
  // Convert CoreMessages to UIMessages format
  const uiMessages: WebsiteUIMessage[] = messages.map((msg, idx) => ({
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
    cacheDir: '.aicache',
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
    githubFolder: '',
    defaultLocale: 'en',
    locales: ['en'],
    branchId: 'test-branch',
    modelId: null,
    modelProvider: null,
    middlewares: [cacheMiddleware],
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
