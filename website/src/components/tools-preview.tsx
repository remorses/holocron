import { memo } from 'react'
import { Markdown } from 'docs-website/src/lib/markdown'
import { cn } from 'website/src/lib/utils'
import { useWebsiteState } from '../lib/state'
import { EditToolParamSchema } from '../lib/edit-tool'
import { RenderFormPreview } from './render-form-preview'
import { useChatState } from './chat/chat-provider'

export function EditorToolPreview({
    args,
    state,
    toolCallId,
    result,
}: {
    state: 'partial-call' | 'call' | 'result'
    result?: string | { error?: string; success?: false }
    step?: number
    toolCallId: any
    args?: Partial<EditToolParamSchema>
}) {
    const isChatGenerating = useChatState((x) => x.isGenerating)
    let code = args?.new_str || args?.file_text || ''
    if (code && typeof code === 'object') {
        code = code?.['error'] || JSON.stringify(code, null, 2)
    }
    const command = args?.command
    if (typeof result === 'object' && 'error' in result && result.error) {
        return (
            <ToolPreviewContainer>
                <Markdown
                    isStreaming={isChatGenerating}
                    markdown={`❌ Error: ${result.error}`}
                />
            </ToolPreviewContainer>
        )
    }
    if (command === 'view') {
        let linesText = ''
        if (args?.view_range?.length === 2) {
            const [start, end] = args?.view_range
            linesText = `:${start}:${end}`
        }

        return (
            <ToolPreviewContainer>
                <Markdown
                    isStreaming={isChatGenerating}
                    markdown={`Reading \`${args?.path}${linesText}\` `}
                />
            </ToolPreviewContainer>
        )
    }
    if (command === 'create') {
        let markdown = ''
        markdown += `Creating \`${args?.path}\`\n`
        markdown +=
            '````mdx' + ` title=" ${args?.path || ''}" \n` + code + '\n````'
        return (
            <ToolPreviewContainer>
                <Markdown isStreaming={isChatGenerating} markdown={markdown} />
            </ToolPreviewContainer>
        )
    }

    if (command === 'undo_edit') {
        return (
            <ToolPreviewContainer>
                <div>
                    <strong>Undo last edit in:</strong> {args?.path}
                </div>
            </ToolPreviewContainer>
        )
    }

    if (command === 'insert') {
        let markdown = ''
        markdown += `Inserting content into \`${args?.path}:${args?.insert_line || 0}\`\n`
        // Prefix each line of code content with '+ '
        const codeWithPrefix = code
            .split('\n')
            .map((line) => '+ ' + line)
            .join('\n')
        markdown +=
            '````diff' +
            ` title=" ${args?.path || ''}:${args?.insert_line || 0}" \n` +
            codeWithPrefix +
            '\n````'
        return (
            <ToolPreviewContainer className='py-0'>
                <Markdown isStreaming={isChatGenerating} markdown={markdown} />
            </ToolPreviewContainer>
        )
    }
    let markdown = ''
    markdown += `Replacing content into \`${args?.path}\`\n`
    if (state === 'result') {
        let diff = result || ''

        if (result && typeof result === 'object') {
            diff = result?.error || JSON.stringify(result, null, 2)
        }
        markdown +=
            '````diff' + ` title=" ${args?.path || ''}" \n` + diff + '\n````'
        return (
            <ToolPreviewContainer className='py-0'>
                <Markdown isStreaming={isChatGenerating} markdown={markdown} />
            </ToolPreviewContainer>
        )
    }
    markdown += '````mdx' + ` title=" ${args?.path || ''}" \n` + code + '\n````'
    return (
        <ToolPreviewContainer className='py-0'>
            <Markdown isStreaming={isChatGenerating} markdown={markdown} />
        </ToolPreviewContainer>
    )
}

export function FilesTreePreview({
    args,
    state,
    toolCallId,
    result,
}: {
    state: 'partial-call' | 'call' | 'result'
    result?: string | { error?: string; success?: false }
    step?: number
    toolCallId: any
    args?: any
}) {
    const isChatGenerating = useChatState((x) => x.isGenerating)
    const code = result || '\n'
    if (!code) return null
    let markdown = ''
    markdown += 'Reading project structure\n'
    markdown += '```sh' + ` \n` + code + '\n```'
    return (
        <ToolPreviewContainer className='py-0'>
            <Markdown isStreaming={isChatGenerating} markdown={markdown} />
        </ToolPreviewContainer>
    )
}

export function ToolPreviewContainer({ className = '', children, ...props }) {
    return (
        <div
            className={cn(
                'flex text-sm flex-col w-full [&_pre]:text-[12px]',
                className,
            )}
            {...props}
        >
            {children}
        </div>
    )
}

export function ToolInvocationRenderer({
    part,
    index,
}: {
    part: any
    index: number
}) {
    const toolName = part.toolInvocation.toolName
    if (toolName === 'str_replace_editor') {
        return <EditorToolPreview key={index} {...part.toolInvocation} />
    }
    if (toolName === 'get_project_files') {
        return <FilesTreePreview key={index} {...part.toolInvocation} />
    }
    if (toolName === 'render_form') {
        return <RenderFormPreview key={index} {...part.toolInvocation} />
    }
    if (process.env.NODE_ENV === 'development') {
        return (
            <pre key={index}>
                {JSON.stringify(part.toolInvocation, null, 2)}
            </pre>
        )
    }
    return null
}
