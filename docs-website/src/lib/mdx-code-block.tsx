import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
import { RenderNode } from 'safe-mdx'

export const renderNode: RenderNode = (node, transform) => {
    if (node.type === 'code') {
        const language = node.lang || ''
        const meta = parseMetaString(node.meta)
        // the mdast plugin replaces the code string with shiki html
        const html = node.data?.['html'] || node.value || ''
        return (
            <CodeBlock {...node.data?.hProperties} {...meta} lang={language}>
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

function parseMetaString(
    meta: string | null | undefined,
): Record<string, string> {
    if (!meta) {
        return {}
    }

    const map: Record<string, string> = {}
    const metaRegex = /(\w+)="([^"]+)"/g
    let match

    while ((match = metaRegex.exec(meta)) !== null) {
        const [, name, value] = match
        map[name] = value
    }

    return map
}
