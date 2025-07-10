'use client'

import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
import { useState, useEffect } from 'react'
import { RenderNode } from 'safe-mdx'
import { codeToHtml } from 'shiki'

export const renderNode: RenderNode = (node, transform) => {
    if (node.type === 'code') {
        const language = node.lang || ''
        const meta = parseMetaString(node.meta)

        const html = node.data?.['html']
        const props = {
            title: '',
            ...(node.data?.hProperties ?? {}),
            ...meta,
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
                        <RuntimeShkiContent
                            code={node.value}
                            language={language}
                            themes={{
                                light: 'github-light',
                                dark: 'github-dark',
                            }}
                        />
                    )}
                </Pre>
            </CodeBlock>
        )
    }
}

function RuntimeShkiContent({ code, language, themes }) {
    const [highlightedHtml, setHighlightedHtml] = useState<string | null>(code)

    useEffect(() => {
        async function highlight() {
            if (!code) {
                setHighlightedHtml('<pre><code></code></pre>')
                return
            }

            const html = await codeToHtml(code, {
                lang: language,
                themes,
                defaultColor: false,
            })
            setHighlightedHtml(html)
        }
        highlight().catch(console.error)
    }, [code, language, themes])
    return (
        <div
            className='content'
            dangerouslySetInnerHTML={{
                __html: highlightedHtml ?? '',
            }}
        ></div>
    )
}

export function parseMetaString(
    meta: string | null | undefined,
): Record<string, string> {
    if (!meta) {
        return {}
    }

    const map: Record<string, string> = {}

    // If there is no '=', treat the whole meta as a trimmed title
    if (!meta.includes('=')) {
        map['title'] = meta.trim()
        return map
    }

    const metaRegex = /(\w+)="([^"]+)"/g
    let match: RegExpExecArray | null

    while ((match = metaRegex.exec(meta)) !== null) {
        const [, name, value] = match
        map[name] = value
    }

    return map
}
