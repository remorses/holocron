import { FileEditPreview, jsxDedent } from 'contesto'
import { useChatContext } from 'contesto/src/chat/chat-provider'
import { MarkdownRuntimeChat as Markdown } from 'docs-website/src/lib/markdown-runtime-chat'
import { escapeMdxSyntax, truncateText } from 'docs-website/src/lib/utils'
import { WebsiteToolPart } from 'website/src/lib/types'
import { cn } from 'website/src/lib/utils'
import { parsePatch } from 'diff'
import { ReactNode, useMemo } from 'react'

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
                <Dot toolCallId={toolCallId}/> Reading <Highlight>{args?.path}</Highlight>
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
                <Dot toolCallId={toolCallId}/> {command} <Highlight>{args?.path}</Highlight>
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
                <Dot toolCallId={toolCallId}/> Undo last edit in <Highlight>{args?.path}</Highlight>
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
                    <Dot toolCallId={toolCallId}/> Replaced content in <Highlight>{args?.path}</Highlight>
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
            <Dot toolCallId={toolCallId}/> Replacing content in <Highlight>{args?.path}</Highlight>
            {error && <ErrorPreview error={error} />}
        </ToolPreviewContainer>
    )
}

export function FilesTreePreview({
    output,
    toolCallId,
}: Extract<WebsiteToolPart, { type: 'tool-getProjectFiles' }>) {
    const { isGenerating: isChatGenerating } = useChatContext()
    const code = output || '\n'

    if (!code) return null

    return (
        <ToolPreviewContainer>
            <Dot toolCallId={toolCallId}/> getting file structure
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

export function Dot({ toolCallId }: { toolCallId?: string }) {
    const { messages } = useChatContext()

    const isLastPendingCall = useMemo(() => {
        if (!toolCallId) return false

        // Find all tool calls across all messages
        const allToolCalls: Array<{ id: string; state?: string }> = []
        messages.forEach((message) => {
            if (message.parts) {
                message.parts.forEach((part) => {
                    if (part.type?.startsWith('tool-') && 'toolCallId' in part) {
                        allToolCalls.push({
                            id: part.toolCallId,
                            state: part.state
                        })
                    }
                })
            }
        })

        // Check if this is the last tool call
        const lastToolCall = allToolCalls[allToolCalls.length - 1]
        if (!lastToolCall || lastToolCall.id !== toolCallId) return false

        // Check if it's still processing (not output-available or error)
        return lastToolCall.state !== 'output-available' && lastToolCall.state !== 'error'
    }, [toolCallId, messages])

    return (
        <span className={cn('whitespace-pre',isLastPendingCall && 'animate-pulse')}>
            •{' '}
        </span>
    )
}
