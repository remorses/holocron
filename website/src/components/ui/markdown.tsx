import { cn } from 'website/src/lib/utils'
import { MarkdownRender } from 'docs-website/src/lib/safe-mdx'

import { marked } from 'marked'
import { memo, Suspense, useId, useMemo } from 'react'
import ReactMarkdown, { Components } from 'react-markdown'

import { CodeBlock, CodeBlockCode } from './code-block'

export type MarkdownProps = {
    children: string
    id?: string
    className?: string
    components?: Partial<Components>
}

function MarkdownComponent({ children, id, className }: MarkdownProps) {
    const generatedId = useId()
    const blockId = id ?? generatedId
    const blocks = useMemo(() => marked.lexer(children), [children])

    return (
        <Suspense fallback='loading md processor'>
            <div className={className}>
                {blocks.map((block, index) => {
                    if (block.type === 'space') return block.raw
                    return (
                        <MarkdownRender
                            key={`${blockId}-block-${index}`}
                            content={block.raw}
                        />
                    )
                })}
            </div>
        </Suspense>
    )
}

const Markdown = memo(MarkdownComponent)
Markdown.displayName = 'Markdown'

export { Markdown }
