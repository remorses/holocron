export function findLineNumberInContent(
    content: string,
    snippet: string,
): number | null {
    if (snippet.length < 3) {
        return null
    }

    const lines = content.split('\n')

    // First try: exact match
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(snippet)) {
            return i + 1
        }
    }

    // Second try: match by words (for cases where snippet formatting differs)
    const snippetWords = snippet
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .slice(0, 3) // Use first 3 significant words

    if (snippetWords.length === 0) {
        return null
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        let wordsFound = 0
        for (const word of snippetWords) {
            if (line.includes(word)) {
                wordsFound++
            }
        }

        // If we find most of the significant words, consider it a match
        if (wordsFound >= Math.ceil(snippetWords.length * 0.6)) {
            return i + 1
        }
    }

    return null
}