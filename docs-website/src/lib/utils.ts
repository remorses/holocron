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
