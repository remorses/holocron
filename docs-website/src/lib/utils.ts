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
