import { memo } from 'react'
import { MarkdownRuntime as Markdown } from '../lib/markdown-runtime'
import { cn } from '../lib/cn'
import { EditToolParamSchema } from '../lib/edit-tool'
import { escapeMdxSyntax, truncateText } from '../lib/utils'

// Types for docs tool parts
export interface DocsToolPart {
    type: string
    input?: any
    output?: any
    state?: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
    toolCallId?: string
    errorText?: string
}

export interface EditorToolPart extends DocsToolPart {
    type: 'tool-strReplaceEditor'
    input?: any
}

export function Dot() {
    return '•'
}


export function EditorToolPreview({
    input: args,
    state,
    toolCallId,
    output: result,
}: EditorToolPart) {
    let code = args?.new_str || args?.file_text || ''
    if (code && typeof code === 'object') {
        code = code?.['error'] || JSON.stringify(code, null, 2)
    }
    const command = args?.command
    if (typeof result === 'object' && 'error' in result && result.error) {
        const escapedError = escapeMdxSyntax(String(result.error))
        const truncatedError = truncateText(escapedError, 300)
        return (
            <ToolPreviewContainer>
                <Dot/> Error: {truncatedError}
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
                    isStreaming={false}
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
                <Markdown isStreaming={false} markdown={markdown} />
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
                <Markdown isStreaming={false} markdown={markdown} />
            </ToolPreviewContainer>
        )
    }
    let markdown = ''
    markdown += `Replacing content into \`${args?.path}\`\n`
    if (state === 'output-available') {
        let diff = result || ''

        if (result && typeof result === 'object') {
            diff = result?.error || JSON.stringify(result, null, 2)
        }
        markdown +=
            '````diff' + ` title=" ${args?.path || ''}" \n` + diff + '\n````'
        return (
            <ToolPreviewContainer className='py-0'>
                <Markdown isStreaming={false} markdown={markdown} />
            </ToolPreviewContainer>
        )
    }
    markdown += '````mdx' + ` title=" ${args?.path || ''}" \n` + code + '\n````'
    return (
        <ToolPreviewContainer className='py-0'>
            <Markdown isStreaming={false} markdown={markdown} />
        </ToolPreviewContainer>
    )
}

export function ToolPreviewContainer({ className = '', children, ...props }) {
    return (
        <div
            className={cn('text-sm w-full [&_pre]:text-[12px]', className)}
            {...props}
        >
            {children}
        </div>
    )
}
