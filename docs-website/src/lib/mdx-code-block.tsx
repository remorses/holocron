'use client'

import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
import { useState, useEffect } from 'react'
import { RenderNode } from 'safe-mdx'
import { codeToHtml } from 'shiki'

export const renderNode: RenderNode = (node, transform) => {
    if (node.type === 'code') {
        const language = node.lang || ''

        const html = node.data?.['html']
        const props = {
            title: '',
            ...(node.data?.hProperties ?? {}),

            lang: language,
        }

        return (
            <CodeBlock {...props}>
                <Pre>
                    {html ? (
                        <div
                            className='content'
                            dangerouslySetInnerHTML={{ __html: html }}
                        ></div>
                    ) : (
                        node.value
                    )}
                </Pre>
            </CodeBlock>
        )
    }
}
