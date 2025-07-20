import { cn } from './cn'

export { cn }

export function trySync<T>(fn: () => T): { data: T | undefined; error: any } {
    try {
        return { data: fn(), error: undefined }
    } catch (error) {
        return { data: undefined, error }
    }
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

export function generateSlugFromPath(
    pathWithFrontSlash: string,
    basePath: string,
) {
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
        .map(
            (word) =>
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
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
    return text
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
}

/**
 * Truncates text to a specified length and adds ellipsis
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation (default: 500)
 * @returns The truncated text with ellipsis if it was truncated
 */
export function truncateText(text: string, maxLength: number = 500): string {
    if (text.length <= maxLength) {
        return text
    }
    return text.slice(0, maxLength).trimEnd() + '...'
}
