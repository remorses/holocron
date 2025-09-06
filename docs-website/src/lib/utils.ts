import JSONC from 'tiny-jsonc'
import { cn } from './cn.js'
import { DocsJsonType } from './docs-json.js'
import { DOCS_JSON_BASENAME } from './constants.js'

export { cn }

export function isDocsJson(path: string): boolean {
  if (!path) return false
  const candidates = [DOCS_JSON_BASENAME, 'fumabase.jsonc']
  for (const name of candidates) {
    if (path === name || path.endsWith(`/${name}`)) {
      return true
    }
  }
  return false
}

export function trySync<T>(fn: () => T): { data: T | undefined; error: any } {
  try {
    return { data: fn(), error: undefined }
  } catch (error) {
    return { data: undefined, error }
  }
}

export function capitalize(str: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function spaceCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/^./, (m) => m.toUpperCase())
}

export function isAbsoluteUrl(url: string) {
  if (!url) {
    return false
  }
  let abs = [
    '#',
    'https://',
    'http://',
    'mailto:', //
  ].some((x) => url.startsWith(x))
  return abs
}
export function isInsidePreviewIframe(): boolean {
  if (typeof window !== 'undefined') {
    return window.name === 'preview'
  }
  return false
}

export function debounce<T extends (...args: any[]) => any>(
  delay: number,
  fn: T,
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn.apply(this, args), delay)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  delay: number,
  fn: T,
) {
  let lastExecTime = 0
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const now = Date.now()

    if (now - lastExecTime >= delay) {
      // Execute immediately if enough time has passed
      lastExecTime = now
      fn.apply(this, args)
    } else {
      // Schedule execution for the remaining time
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(
        () => {
          lastExecTime = Date.now()
          fn.apply(this, args)
        },
        delay - (now - lastExecTime),
      )
    }
  }
}

export function generateSlugFromPath(
  pathWithFrontSlash: string,
  basePath: string,
) {
  // Return empty string for .json and .jsonc files to prevent navigation
  if (
    pathWithFrontSlash.endsWith('.json') ||
    pathWithFrontSlash.endsWith('.jsonc')
  ) {
    return ''
  }

  if (isAbsoluteUrl(pathWithFrontSlash)) {
    return pathWithFrontSlash
  }
  if (basePath && !basePath.startsWith('/')) {
    basePath = `/${basePath}`
  }
  if (pathWithFrontSlash && !pathWithFrontSlash.startsWith('/')) {
    pathWithFrontSlash = `/${pathWithFrontSlash}`
  }
  if (pathWithFrontSlash.startsWith(basePath)) {
    pathWithFrontSlash = pathWithFrontSlash.slice(basePath.length)
  }
  if (pathWithFrontSlash.startsWith('/')) {
    pathWithFrontSlash = pathWithFrontSlash.slice(1)
  }
  let res =
    '/' +
    pathWithFrontSlash
      .replace(/\.mdx?$/, '')
      .replace(/\/index$/, '')
      .replace(/^index$/, '')

  return res || '/'
}

export function pascalcase(str: string): string {
  return str
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

export function deduplicateBy<T>(array: T[], keyFn: (item: T) => string): T[] {
  const seen = new Map<string, T>()
  for (const item of array) {
    const key = keyFn(item)
    if (!seen.has(key)) {
      seen.set(key, item)
    }
  }
  return Array.from(seen.values())
}

export const isTruthy = <T>(value: T): value is NonNullable<T> => {
  return Boolean(value)
}

export function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K,
): Record<K, T[]> {
  return array.reduce(
    (acc, item) => {
      const key = keyFn(item)
      if (!(key in acc)) {
        acc[key] = []
      }
      acc[key].push(item)
      return acc
    },
    {} as Record<K, T[]>,
  )
}

/**
 * Escapes MDX/Markdown syntax to prevent rendering as formatted content
 * @param text - The text to escape
 * @returns The escaped text with MDX/Markdown syntax rendered as plain text
 */
export function escapeMdxSyntax(text: string): string {
  return (
    text
      // Escape HTML/JSX tags
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Escape JSX curly braces
      .replace(/{/g, '&#123;')
      .replace(/}/g, '&#125;')
      // Escape markdown formatting
      .replace(/\*/g, '&#42;')
      .replace(/_/g, '&#95;')
      .replace(/`/g, '&#96;')
      .replace(/~/g, '&#126;')
      .replace(/\^/g, '&#94;')
      .replace(/\[/g, '&#91;')
      .replace(/\]/g, '&#93;')
      .replace(/\|/g, '&#124;')
      .replace(/\\/g, '&#92;')
      // Escape headers (# at start of line)
      .replace(/^#/gm, '&#35;')
      // Escape blockquotes (> at start of line)
      .replace(/^>/gm, '&#62;')
      // Escape newlines to prevent line breaks
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
  )
}

/**
 * Truncates text to a specified length and adds ellipsis
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation (default: 500)
 * @returns The truncated text with ellipsis if it was truncated
 */
export function truncateText(text: string, maxLength: number = 500): string {
  if (!text?.length || text?.length <= maxLength) {
    return text
  }
  return text.slice(0, maxLength).trimEnd() + '...'
}

/**
 * Makes all properties of T optional, recursively.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? T[P] extends Function
      ? T[P]
      : DeepPartial<T[P]>
    : T[P]
}

export const safeJsoncParse = <T = unknown>(json: string): T | null => {
  try {
    return JSONC.parse(json)
  } catch {
    return null
  }
}

export function getDocsJson({ filesInDraft, docsJson }): DocsJsonType {
  const key = Object.keys(filesInDraft || {}).find((k) => isDocsJson(k))
  if (!key) {
    return docsJson
  }
  const parsed = safeJsoncParse(filesInDraft?.[key]?.content)
  return parsed || docsJson
}

export const lucideVersion = '0.525.0'

export function getBasePath(): string {
  return process.env.PUBLIC_BASE_PATH || ''
}

export function withBasePath(path: string): string {
  const basePath = getBasePath()
  if (!basePath) return path

  if (isAbsoluteUrl(path)) return path

  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return `${basePath}${normalizedPath}`
}

export function withoutBasePath(path: string): string {
  const basePath = getBasePath()
  if (!basePath) return path

  if (path.startsWith(basePath)) {
    return path.slice(basePath.length) || '/'
  }

  return path
}
