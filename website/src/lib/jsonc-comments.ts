export function stringifyJsonWithComments({ data, original }:{ data: Record<string, unknown>; original: string }): string {
    const commentMap = extractComments(original)
    const json = JSON.stringify(data, null, 2)
    return insertComments(json, commentMap)
}

function extractComments(text: string): Record<string, string[]> {
    const lines = text.split(/\r?\n/)
    const comments: Record<string, string[]> = {}
    const keyRegex = /^\s*"([^"\\]+)"\s*:/
    let pending: string[] = []

    for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
            pending.push(trimmed)
            continue
        }
        const match = line.match(keyRegex)
        if (match) {
            if (pending.length) {
                comments[match[1]] = pending.slice()
                pending = []
            } else {
                pending = []
            }
        } else if (trimmed) {
            pending = []
        }
    }

    return comments
}

function insertComments(json: string, comments: Record<string, string[]>): string {
    const lines = json.split('\n')
    const keyRegex = /^(\s*)"([^"\\]+)"\s*:/
    const result: string[] = []
    for (const line of lines) {
        const match = line.match(keyRegex)
        if (match) {
            const indent = match[1]
            const key = match[2]
            if (comments[key]) {
                for (const c of comments[key]) {
                    result.push(`${indent}${c}`)
                }
            }
        }
        result.push(line)
    }
    return result.join('\n')
}
