import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
import { RenderNode } from 'safe-mdx'
import { mdxParentsContext } from '../components/mdx-context'
import { use } from 'react'

export const renderNode: RenderNode = (node, transform) => {
    if (node.type === 'code') {
        const language = node.lang || ''
        const meta = parseMetaString(node.meta)
        const { parentTags } = use(mdxParentsContext)

        // the mdast plugin replaces the code string with shiki html
        const html = node.data?.['html'] || node.value || ''
        const props = {
            title: '',
            ...(node.data?.hProperties ?? {}),
            ...meta,
            lang: language,
        }
        if (parentTags?.includes('Tabs') && props.title) {
            props.title = ''
        }
        return (
            <CodeBlock {...props}>
                <Pre>
                    <div
                        className='content'
                        dangerouslySetInnerHTML={{ __html: html }}
                    ></div>
                </Pre>
            </CodeBlock>
        )
    }
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
