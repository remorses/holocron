import { FileEditPreview, jsxDedent } from 'contesto'
import { useChatContext } from 'contesto/src/chat/chat-provider'
import { MarkdownRuntimeChat as Markdown } from 'docs-website/src/lib/markdown-runtime-chat'
import { escapeMdxSyntax, truncateText } from 'docs-website/src/lib/utils'
import { WebsiteToolPart } from 'website/src/lib/types'
import { cn } from 'website/src/lib/utils'
import { parsePatch } from 'diff'
import { ReactNode } from 'react'

function Highlight({ children }: { children: ReactNode }) {
    return <span className=" dark:text-purple-300">{children}</span>
}

export function ErrorPreview({ error }) {
    const truncatedError = truncateText(String(error), 300)
    return (
        <>
            <br />⎿ Error:{' '}
            <span className='text-destructive'>{truncatedError}</span>
        </>
    )
}

export function EditorToolPreview({
    input: args,
    state,
    toolCallId,
    output: result,
}: Extract<WebsiteToolPart, { type: 'tool-strReplaceEditor' }>) {
    const { isGenerating: isChatGenerating } = useChatContext()
    let code = args?.new_str || args?.file_text || ''
    if (code && typeof code === 'object') {
        code = code?.['error'] || JSON.stringify(code, null, 2)
    }
    const command = args?.command
    let error = ''
    if (typeof result === 'object' && 'error' in result && result.error) {
        error = result.error
    }
    if (command === 'view') {
        let linesText = ''
        if (args?.view_range?.length === 2) {
            const [start, end] = args?.view_range
            linesText = `:${start}:${end}`
        }

        return (
            <ToolPreviewContainer>
                <Dot/> Reading <Highlight>{args?.path}</Highlight>
                {linesText}
                {error && <ErrorPreview error={error} />}
            </ToolPreviewContainer>
        )
    }
    if (command === 'create' || command === 'insert') {
        let markdown = ''
        markdown +=
            '````mdx lineNumbers' +
            ` title=" ${args?.path || ''}" \n` +
            code +
            '\n````'

        return (
            <ToolPreviewContainer>
                <Dot/> {command} <Highlight>{args?.path}</Highlight>
                {command === 'insert' ? `:${args?.insert_line || 0}` : ''}
                {error ? (
                    <ErrorPreview error={result.error} />
                ) : (
                    <Markdown
                        className='block  pt-[1em]'
                        isStreaming={isChatGenerating}
                        markdown={markdown}
                    />
                )}
            </ToolPreviewContainer>
        )
    }

    if (command === 'undo_edit') {
        return (
            <ToolPreviewContainer>
                <Dot/> Undo last edit in <Highlight>{args?.path}</Highlight>
                {error && <ErrorPreview error={error} />}
            </ToolPreviewContainer>
        )
    }

    // For replace command
    if (state === 'output-available' && result && typeof result === 'string') {
        // Parse the diff patch from the result string
        const patches = parsePatch(result)
        if (patches.length > 0 && patches[0].hunks) {
            return (
                <ToolPreviewContainer>
                    <Dot/> Replaced content in <Highlight>{args?.path}</Highlight>
                    {error ? (
                        <ErrorPreview error={error} />
                    ) : (
                        <div className='overflow-x-auto py-2 max-w-full'>
                            <FileEditPreview
                                hunks={patches[0].hunks}
                                className={'pt-[1em]  min-w-max w-full'}
                                paddingLeft={0}
                            />
                        </div>
                    )}
                </ToolPreviewContainer>
            )
        }
    }

    return (
        <ToolPreviewContainer>
            <Dot/> Replacing content in <Highlight>{args?.path}</Highlight>
            {error && <ErrorPreview error={error} />}
        </ToolPreviewContainer>
    )
}

export function FilesTreePreview({
    output,
}: Extract<WebsiteToolPart, { type: 'tool-getProjectFiles' }>) {
    const { isGenerating: isChatGenerating } = useChatContext()
    const code = output || '\n'

    if (!code) return null

    return (
        <ToolPreviewContainer>
            <Dot/> getting file structure
            <br />
            <Markdown
                isStreaming={isChatGenerating}
                className='pt-[1em] block'
                markdown={`\n\`\`\`sh lineNumbers=true\n${code}\n\`\`\`\n`}
            />
        </ToolPreviewContainer>
    )
}

export function ToolPreviewContainer({
    children,
}: {
    children: React.ReactNode
}) {
    return <div className='py-1 space-y-2'>{children}</div>
}

export function addIndentation(spaces: number, text: string): string {
    const indent = ' '.repeat(spaces)
    return text
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => indent + line)
        .join('\n')
}

export function Dot() {
    return '•'
}
