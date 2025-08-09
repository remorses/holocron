'use client'

import { Markdown, MarkdownRendererProps } from 'contesto/src/lib/markdown'
import { diffWordsWithSpace } from 'diff'
import { useMemo } from 'react'
import { mdxComponents } from '../components/mdx-components'
import { markAddedNodes } from './diff'
import { renderNode } from './mdx-render-node'
import { getProcessor } from './mdx-heavy'

export function MarkdownRuntime({
    extension = 'mdx',
    isStreaming = true,
    markdown,
    showDiff = false,
    previousMarkdown = '',
    className = '',
}: MarkdownRendererProps & {
    extension?: string
    showDiff?: boolean
    previousMarkdown?: string
}) {
    const onAst = (ast) => {
        if (showDiff && previousMarkdown) {
            const diffs = diffWordsWithSpace(previousMarkdown, markdown || '')
            markAddedNodes(diffs, ast)
        }
    }

    const processor = useMemo(() => getProcessor({ extension }), [extension])

    return (
        <Markdown
            isStreaming={isStreaming}
            renderNode={renderNode}
            onAst={onAst}
            markdown={markdown}
            processor={processor}
            components={mdxComponents}
            className={className}
        />
    )
}
