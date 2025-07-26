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
            className={cn('text-[14px]', className)}
        />
    )
}

const renderNode: RenderNode = (node, transform) => {
    if (node.type === 'code') {
        const language = node.lang || ''

        const html = node.data?.['html']
        const props = {
            title: '',
            ...(node.data?.hProperties ?? {}),

            lang: language,
        }

        return (
            <div

                className='not-prose py-6 -ml-2 leading-7 fd-codeblock'
                {...props}
            >
                <Pre>
                    {html ? (
                        <div dangerouslySetInnerHTML={{ __html: html }}></div>
                    ) : (
                        node.value
                    )}
                </Pre>
            </div>
        )
    }
}
