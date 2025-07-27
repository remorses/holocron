'use client'

import { Markdown } from 'contesto/src/lib/markdown'
import { diffWordsWithSpace } from 'diff'
import { useMemo } from 'react'
import { mdxComponents as docsMdxComponents } from '../components/mdx-components'
import { markAddedNodes } from './diff'
import { getProcessor } from './mdx-heavy'
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
import { RenderNode } from 'safe-mdx'

import { cn } from './cn'

const mdxComponents = {
    ...docsMdxComponents,
}

export function MarkdownRuntimeChat({
    extension = 'mdx',
    isStreaming = true,
    markdown,
    className = '',
}) {
    const processor = useMemo(() => getProcessor({ extension }), [extension])

    return (
        <Markdown
            isStreaming={isStreaming}
            renderNode={renderNode}
            markdown={markdown}
            processor={processor}
            components={mdxComponents}
            className={cn('block max-w-full text-mono prose-xs ', className)}
        />
    )
}

const renderNode: RenderNode = (node, transform) => {
    if (node.type === 'strong') {
        return (
            <span className='dark:text-blue-200'>
                {node.children?.map((child) => transform(child))}
            </span>
        )
    }
    if (node.type === 'emphasis') {
        return (
            <span className='dark:text-emerald-200'>
                {node.children?.map((child) => transform(child))}
            </span>
        )
    }
    if (node.type === 'delete') {
        return (
            <span className='dark:text-red-200 line-through'>
                {node.children?.map((child) => transform(child))}
            </span>
        )
    }
    if (node.type === 'inlineCode') {
        return (
            <span className='dark:text-amber-200 dark:bg-amber-950/30 px-1 rounded'>
                {node.value}
            </span>
        )
    }
    if (node.type === 'code') {
        const language = node.lang || ''

        const html = node.data?.['html']
        const props = {
            title: '',
            ...(node.data?.hProperties ?? {}),

            lang: language,
        }

        return (
            <div className='-ml-[1em] max-w-full not-prose leading-relaxed' {...props}>
                <div
                    dangerouslySetInnerHTML={{ __html: html ?? node.value }}
                    // style={{ fontSize: 'inherit' }}
                    className='overflow-x-auto hide-scrollbar font-mono text-xs overflow-y-hidden max-w-full whitespace-pre-wrap'
                ></div>
            </div>
        )
    }
}
