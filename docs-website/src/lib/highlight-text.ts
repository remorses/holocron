export function highlightText({
    slug,
    startLine,
    endLine,
}: {
    slug: string
    startLine: number
    endLine: number
}) {
    // Clear any existing highlights
    if (CSS.highlights) {
        CSS.highlights.delete('llm-text-selection')
    }

    // Find elements with data-markdown-line attributes in the specified range
    const elementsToHighlight: HTMLElement[] = []

    for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
        const element = document.querySelector<HTMLElement>(
            `[data-markdown-line="${lineNum}"]`,
        )
        if (element) {
            elementsToHighlight.push(element)
        }
    }

    if (elementsToHighlight.length === 0) {
        console.warn(
            `No elements found with data-markdown-line attributes between ${startLine} and ${endLine}`,
        )
        return
    }

    // Create ranges for highlighting
    const ranges = elementsToHighlight.map((el) => {
        const range = document.createRange()
        range.selectNodeContents(el)
        return range
    })

    // Create highlight using CSS Highlight API
    if (CSS.highlights) {
        const highlight = new window.Highlight()
        ranges.forEach((range) => highlight.add(range))
        CSS.highlights.set('llm-text-selection', highlight)
    }

    // Scroll the first element into view
    if (elementsToHighlight[0]) {
        elementsToHighlight[0].scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        })
    }
}
