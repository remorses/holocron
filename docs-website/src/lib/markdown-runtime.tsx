import { useId, useMemo, Suspense, memo } from 'react'
import { marked } from 'marked'

import {
    MarkdownAstRenderer,
    Markdown,
    MarkdownRendererProps,
} from './safe-mdx'
import { createHighlighter, Highlighter } from 'shiki'
import { getProcessor } from './mdx'

export function MarkdownRuntimeComponent({
    markdown,
    extension,
    id,
}: MarkdownRendererProps) {
    const generatedId = useId()
    const blockId = id ?? generatedId
    const blocks = useMemo(() => marked.lexer(markdown || ''), [markdown])

    return (
        <Suspense>
            {blocks.map((block, index) => {
                if (block.type === 'space') return block.raw
                return (
                    <MarkdownRuntimeItem
                        key={`${blockId}-block-${index}`}
                        extension={extension}
                        markdown={block.raw}
                    />
                )
            })}
        </Suspense>
    )
}

const onMissingLanguage = (highlighter: Highlighter, language) => {
    throw highlighter.loadLanguage(language)
}

function setHighlighter() {
    if (highlighter) return
    createHighlighter({
        themes: ['github-dark', 'github-light'],
        langs: ['text'],
    }).then((x) => {
        if (highlighter) return
        highlighter = x
    })
}

let highlighter: Highlighter | undefined
setHighlighter()

const MarkdownRuntimeItem = memo(
    ({ markdown, extension }: { markdown; extension }) => {
        if (!highlighter) {
            throw setHighlighter()
        }
        const processor = getProcessor({
            extension,
            onMissingLanguage,
            highlighter,
        })
        const file = processor.processSync(markdown)
        let ast = file.data.ast
        return <MarkdownAstRenderer ast={ast} />
    },
)
