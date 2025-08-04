import { useChatContext } from 'contesto/src/chat/chat-provider'
import { MarkdownRuntime as Markdown } from 'docs-website/src/lib/markdown-runtime'
// import { MarkdownRuntimeChat as Markdown } from 'docs-website/src/lib/markdown-runtime-chat'
import { truncateText } from 'docs-website/src/lib/utils'
import { WebsiteToolPart } from 'website/src/lib/types'
import { capitalize, cn } from 'website/src/lib/utils'
import { ReactNode, useMemo } from 'react'

function Highlight({ children }: { children: ReactNode }) {
    return (
        <span className=' dark:text-purple-300 text-purple-800'>
            {children}
        </span>
    )
}

export function ErrorPreview({ error }) {
    const truncatedError = truncateText(String(error), 300)
    return (
        <div className='flex flex-row gap-2'>
            <div className='shrink-0'>⎿</div>
            <span>
                Error:{' '}
                <span className='dark:text-red-300 text-red-500'>
                    {truncatedError}
                </span>
            </span>
        </div>
    )
}

export function EditorToolPreview({
    input: args,
    state,
    toolCallId,
    output: result,
}: Extract<WebsiteToolPart, { type: 'tool-strReplaceEditor' }>) {
    const { isGenerating: isChatGenerating } = useChatContext()
    const command = args?.command
    let error = ''
    if (typeof result === 'object' && 'error' in result && result.error) {
        error = result.error
    }

    // For non-mutation operations, just log progress
    if (command === 'view') {
        let linesText = ''
        if (args?.view_range?.length === 2) {
            const [start, end] = args?.view_range
            linesText = `:${start}:${end}`
        }

        return (
            <ToolPreviewContainer>
                <Dot toolCallId={toolCallId} /> Reading{' '}
                <Highlight>{args?.path}</Highlight>
                {linesText}
                {error && <ErrorPreview error={error} />}
            </ToolPreviewContainer>
        )
    }

    if (command === 'undo_edit') {
        return (
            <ToolPreviewContainer>
                <Dot toolCallId={toolCallId} /> Undo last edit in{' '}
                <Highlight>{args?.path}</Highlight>
                {error && <ErrorPreview error={error} />}
            </ToolPreviewContainer>
        )
    }

    if (
        command === 'create' ||
        command === 'insert' ||
        command === 'str_replace'
    ) {
        let language = 'mdx'
        let code = args?.file_text || args?.new_str || ''
        if (args?.new_str || args?.old_str) {
            language = 'diff'
            code =
                (args.old_str || '')
                    .split('\n')
                    .map((line) => `- ${line}`)
                    .join('\n') +
                '\n' +
                (args.new_str || '')
                    .split('\n')
                    .map((line) => `+ ${line}`)
                    .join('\n')
        }

        if (code && typeof code === 'object') {
            code = code?.['error'] || JSON.stringify(code, null, 2)
        }

        const markdown = `<ShowMore>\n\`\`\`\`${language} lineNumbers=true data-last-lines=5  \n${code}\n\`\`\`\`\n</ShowMore>`

        let actionText = capitalize(command)
        if (command === 'str_replace') actionText = 'Replacing content in'

        return (
            <ToolPreviewContainer>
                <Dot toolCallId={toolCallId} /> {actionText}{' '}
                <Highlight>{args?.path}</Highlight>
                {command === 'insert' ? `:${args?.insert_line || 0}` : ''}
                {error ? (
                    <ErrorPreview error={error} />
                ) : (
                    <Markdown
                        className='block pt-[1em]'
                        isStreaming={isChatGenerating}
                        markdown={markdown}
                    />
                )}
            </ToolPreviewContainer>
        )
    }

    return (
        <ToolPreviewContainer>
            <Dot toolCallId={toolCallId} /> Processing{' '}
            <Highlight>{args?.path}</Highlight>
            {error && <ErrorPreview error={error} />}
        </ToolPreviewContainer>
    )
}

export function ToolPreviewContainer({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className='py-2 rounded-lg font-mono text-sm space-y-2 w-full'>
            {children}
        </div>
    )
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
        //
        const allToolCalls: Array<{ id: string; state?: string }> = []

        messages.forEach((message) => {
            if (message.parts) {
                message.parts.forEach((part) => {
                    if (
                        part.type?.startsWith('tool-') &&
                        'toolCallId' in part
                    ) {
                        allToolCalls.push({
                            id: part.toolCallId,
                            state: part.state,
                        })
                    }
                })
            }
        })

        // Check if this is the last tool call
        const lastToolCall = allToolCalls[allToolCalls.length - 1]
        if (!lastToolCall || lastToolCall.id !== toolCallId) return false

        // Check if it's still processing (not output-available or error)
        return (
            lastToolCall.state !== 'output-available' &&
            lastToolCall.state !== 'error'
        )
    }, [toolCallId, messages])

    return (
        <span
            className={cn(
                'whitespace-pre',
                isLastPendingCall && 'animate-pulse',
            )}
        >
            •{' '}
        </span>
    )
}
