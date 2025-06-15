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
