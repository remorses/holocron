export function splitExtension(str: string): {
    base: string
    extension: string
} {
    const lastSlash = str.lastIndexOf('/')
    const lastDot = str.lastIndexOf('.')
    // Extension must come after the last slash and dot is not the first character after slash.
    if (lastDot > lastSlash + 1) {
        return {
            base: str.substring(0, lastDot),
            extension: str.substring(lastDot),
        }
    }
    return { base: str, extension: '' }
}

export function slugKebabCaseKeepExtension(str: string): string {
    const { base, extension } = splitExtension(str)
    // slugify base path
    let slug = base
        .toLowerCase()
        .split('/')
        .map((segment) => segment.split(' ').filter(Boolean).join('-'))
        .join('-')
        .replace(/-+/g, '-') // collapse multiple dashes
    if (slug.endsWith('-')) slug = slug.slice(0, -1)
    // Just concat extension if exists; keep as is because prompt says "keep it as is"
    return slug + extension
}