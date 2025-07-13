'use client'

import { Markdown } from 'contesto/src/lib/markdown'
import { diffWordsWithSpace } from 'diff'
import { markAddedNodes } from './diff'
import { mdxComponents } from '../components/mdx-components'
import { getProcessor } from './mdx-heavy'
import { renderNode } from './mdx-code-block'
import { useMemo } from 'react'
import {
    useAddedHighlighter,
    useScrollToFirstAddedIfAtTop,
} from './diff-highlight'

export function MarkdownRuntime({
    extension = 'mdx',
    isStreaming = true,
    markdown,
    showDiff = false,
    previousMarkdown = '',
    className = '',

}) {
    const onAst = (ast) => {
        if (showDiff && previousMarkdown) {
            const diffs = diffWordsWithSpace(previousMarkdown, markdown)
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
