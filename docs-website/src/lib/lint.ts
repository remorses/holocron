import { Root } from 'mdast'
import { visit } from 'unist-util-visit'
import path from 'node:path'

export type DetectedError = {
  url: string
  line: number
  column: number
  reason: string
}

export interface ErrorWithPosition extends Error {
  line?: number
  column?: number
  reason?: string
  position?: {
    start?: {
      line?: number
      column?: number
    }
  }
}

export interface ValidateConfig {
  validSlugs: string[]
  resolveDir?: string
}

export async function validateMarkdownLinks(tree: Root, config: ValidateConfig): Promise<DetectedError[]> {
  const detected: DetectedError[] = []
  const validSlugSet = new Set(config.validSlugs)

  visit(tree, 'link', (node) => {
    // ignore generated nodes
    if (!node.position) return
    const pos = node.position

    const result = detectInvalidLink(node.url, validSlugSet, config.resolveDir)
    if (result) {
      detected.push({
        url: node.url,
        line: pos.start.line,
        column: pos.start.column,
        reason: result,
      })
    }
  })

  return detected
}

function detectInvalidLink(href: string, validSlugs: Set<string>, resolveDir?: string): string | undefined {
  // Skip external URLs
  if (href.match(/^https?:\/\//)) {
    return undefined
  }

  // Skip mailto links
  if (href.startsWith('mailto:')) {
    return undefined
  }

  // Skip anchor-only links
  if (href.startsWith('#')) {
    return undefined
  }

  // Extract pathname without fragment and query
  const [pathnameWithQuery] = href.split('#', 2)
  const [pathname] = pathnameWithQuery.split('?', 2)

  // Skip empty paths
  if (pathname.length === 0) {
    return undefined
  }

  let normalizedPath = pathname

  // Handle relative paths
  if (!pathname.startsWith('/')) {
    if (!resolveDir) {
      // Without resolveDir, we can't resolve relative paths
      return `Cannot resolve relative path "${pathname}" without resolveDir`
    }

    // Resolve the path relative to resolveDir
    normalizedPath = path.posix.resolve(resolveDir, pathname)

    // Check if the resolved path escapes the root
    if (!normalizedPath.startsWith('/')) {
      return `Path "${pathname}" escapes the root directory`
    }
  }

  // Check if it's a valid slug
  if (!validSlugs.has(normalizedPath)) {
    return `Link to "${normalizedPath}" not found in valid slugs`
  }

  return undefined
}

export function formatErrorWithContext(error: ErrorWithPosition, content: string, errorType: string = 'Error'): string {
  // Extract error details
  const errorLine = error.line || error.position?.start?.line || 1
  const errorColumn = error.column || error.position?.start?.column || 1
  const errorMessage = error.reason || error.message || 'Unknown error'

  // Split content into lines
  const lines = content.split('\n')

  // Calculate line range to show (5 lines before and after the error)
  const contextRange = 5
  const startLine = Math.max(1, errorLine - contextRange)
  const endLine = Math.min(lines.length, errorLine + contextRange)

  // Build context message
  let contextMessage = `${errorType} at line ${errorLine}, column ${errorColumn}:\n${errorMessage}\n\n`
  contextMessage += 'Error Context:\n'

  for (let i = startLine - 1; i < endLine; i++) {
    const lineNumber = i + 1
    const isErrorLine = lineNumber === errorLine
    const line = lines[i] || ''

    // Add line with line number
    contextMessage += `${lineNumber.toString().padStart(3, ' ')} | ${line}\n`

    // Add error indicator for the error line
    if (isErrorLine && errorColumn) {
      const padding = ' '.repeat(5 + errorColumn - 1)
      contextMessage += `${padding}^\n`
    }
  }

  return contextMessage
}

export function createFormattedError(
  error: ErrorWithPosition,
  content: string,
  errorType: string = 'Error',
  additionalMessage?: string,
): ErrorWithPosition {
  const formattedMessage = formatErrorWithContext(error, content, errorType)
  const fullMessage = additionalMessage ? `${formattedMessage}\n${additionalMessage}` : formattedMessage

  const formattedError: ErrorWithPosition = new Error(fullMessage)
  formattedError.line = error.line || error.position?.start?.line
  formattedError.column = error.column || error.position?.start?.column
  formattedError.reason = error.reason

  return formattedError
}
