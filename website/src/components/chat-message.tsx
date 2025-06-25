import { flushSync } from 'react-dom'
import {
    RiBookLine,
    RiCheckLine,
    RiCodeSSlashLine,
    RiLoopRightFill,
    RiEditLine,
    RiCheckLine as RiSaveLine,
    RiCloseLine,
} from '@remixicon/react'
import { UIMessage, IdGenerator } from 'ai'
import { memo, useRef, useState } from 'react'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from 'website/src/components/ui/tooltip'
import { cn } from 'website/src/lib/utils'
import { Markdown } from 'docs-website/src/lib/markdown'

import { useChatState } from '../lib/state'
import { EditToolParamSchema } from '../lib/edit-tool'
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
import { Button } from './ui/button'
import { useClickOutside } from '../lib/hooks'
import { RenderFormPreview } from './render-form-preview'

type ChatMessageProps = {
    message: UIMessage
    children: React.ReactNode
}

type EditingUserMessageProps = {
    message: UIMessage
}

function LoadingSpinner() {
    // This will animate the dots: . .. ... . .. ... etc.
    // We use a span for each sequence, only one visible at a time via keyframes.
    // Inline style for keyframes to avoid external CSS dependencies.
    return (
        <span className='ml-2 mt-2 inline-flex h-3 select-none font-mono text-base text-muted-foreground'>
            <style>
                {`
                    @keyframes chatDot1 {
                        0%, 74% { opacity: 0; }
                        10%, 24% { opacity: 1; }
                        75%, 100% { opacity: 0; }
                    }
                    @keyframes chatDot2 {
                        0%, 24% { opacity: 0; }
                        25%, 49% { opacity: 1; }
                        50%, 100% { opacity: 0; }
                    }
                    @keyframes chatDot3 {
                        0%, 49% { opacity: 0; }
                        50%, 74% { opacity: 1; }
                        75%, 100% { opacity: 0; }
                    }
                `}
            </style>
            <span style={{ animation: 'chatDot1 1.2s linear infinite' }}>
                .
            </span>
            <span
                style={{ animation: 'chatDot2 1.2s linear infinite' }}
                className='ml-0.5'
            >
                .
            </span>
            <span
                style={{ animation: 'chatDot3 1.2s linear infinite' }}
                className='ml-0.5'
            >
                .
            </span>
        </span>
    )
}
function isMessageAlmostEmpty(message: UIMessage) {
    if (message.parts.length === 0) {
        return true
    }
    if (message.parts.length >= 3) {
        return false
    }
    const allText = message.parts.every(
        (x) => x.type === 'text' || x.type === 'step-start',
    )

    if (!allText) {
        return false
    }
    const content = message.parts.reduce(
        (acc, part) => acc + (part['text'] || ''),
        '',
    )
    if (content.length < 10) {
        return true
    }

    return false
}

export const ChatMessage = memo(function ChatMessage({
    message,
    children,
}: ChatMessageProps) {
    const isChatGenerating = useChatState((x) => x.isChatGenerating)
    const isLastAssistantMessage = useChatState(
        (x) =>
            x.messages.length > 0 &&
            x.messages[x.messages.length - 1]?.id === message.id &&
            message.role === 'assistant',
    )
    
    if (
        isLastAssistantMessage &&
        isChatGenerating &&
        isMessageAlmostEmpty(message)
    ) {
        return <LoadingSpinner />
    }

    return (
        <article
            className={cn(
                'flex items-start max-w-full w-full gap-4 min-w-0 leading-relaxed',
                message.role === 'user' && 'justify-end',
            )}
        >
            <div
                className={cn(
                    'max-w-full relative group/message',
                    message.role === 'user'
                        ? 'bg-muted px-4 py-3 rounded-xl'
                        : 'space-y-4 w-full',
                )}
            >
                <div className='prose text-sm w-full max-w-full dark:prose-invert'>
                    {children}
                </div>
            </div>
        </article>
    )
})

export const EditingUserMessage = memo(function EditingUserMessage({
    message,
}: EditingUserMessageProps) {
    const [editText, setEditText] = useState(() => {
        return message.parts
            .filter((part) => part.type === 'text')
            .map((part) => part['text'])
            .join('')
    })
    const editingBox = useRef<HTMLDivElement>(null)
    
    const handleEditCancel = () => {
        useChatState.setState({ editingMessageId: undefined })
    }

    const handleEditSave = () => {
        const messages = useChatState.getState().messages || []
        const updatedMessages = messages.map((msg) => {
            if (msg.id === message.id) {
                return {
                    ...msg,
                    parts: msg.parts.map((part) =>
                        part.type === 'text'
                            ? { ...part, text: editText }
                            : part,
                    ),
                    content: editText,
                }
            }
            return msg
        })

        const messageIndex = updatedMessages.findIndex(
            (msg) => msg.id === message.id,
        )
        const messagesUpToEdit = updatedMessages.slice(0, messageIndex + 1)

        flushSync(() => {
            useChatState.setState({
                messages: messagesUpToEdit,
                editingMessageId: undefined,
            })
        })
        const event = new CustomEvent('chatRegenerate')
        window.dispatchEvent(event)
    }
    
    useClickOutside(editingBox, handleEditCancel)

    return (
        <article className='flex items-start max-w-full w-full gap-4 min-w-0 leading-relaxed justify-end'>
            <div className='max-w-full relative group/message grow bg-muted px-4 py-3 rounded-xl'>
                <div className='prose text-sm w-full max-w-full dark:prose-invert'>
                    <div
                        ref={editingBox}
                        className='space-y-2 w-full'
                    >
                        <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    if (editText.trim()) {
                                        handleEditSave()
                                    }
                                }
                                if (e.key === 'Escape') {
                                    e.preventDefault()
                                    handleEditCancel()
                                }
                            }}
                            className='w-full min-h-0 min-w-[100px] p-px focus-visible:outline-none bg-transparent rounded-md text-sm resize-none focus:outline-none'
                            autoFocus
                        />
                        <div className='flex items-center gap-2 justify-end'>
                            <Button
                                size='sm'
                                onClick={handleEditSave}
                                disabled={!editText.trim()}
                            >
                                Save
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    )
})

export function UserMessageWithEditButton({
    message,
    onEditStart,
    children,
}: {
    message: UIMessage
    onEditStart: () => void
    children: React.ReactNode
}) {
    return (
        <article className='flex items-start max-w-full w-full gap-4 min-w-0 leading-relaxed justify-end'>
            <div className='max-w-full relative group/message bg-muted px-4 py-3 rounded-xl'>
                <div className='absolute hidden group-hover/message:block -top-2 -right-2'>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant='outline'
                                size='icon'
                                className='rounded-full size-6 border-none bg-background shadow-md hover:bg-muted'
                                onClick={onEditStart}
                            >
                                <RiEditLine className='size-3' />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent
                            side='top'
                            className='px-2 py-1 text-xs'
                        >
                            <p>Edit message</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
                <div className='prose text-sm w-full max-w-full dark:prose-invert'>
                    {children}
                </div>
            </div>
        </article>
    )
}

type ActionButtonProps = {
    icon: React.ReactNode
    label: string
}
const ActionButton = memo(function ActionButton({
    icon,
    label,
}: ActionButtonProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button className='relative text-muted-foreground/80 hover:text-foreground transition-colors size-8 flex items-center justify-center before:absolute before:inset-y-1.5 before:left-0 before:w-px before:bg-border dark:before:bg-border/50 first:before:hidden first-of-type:rounded-s-lg last-of-type:rounded-e-lg focus-visible:z-10 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring/70 dark:text-muted-foreground/70 dark:bg-gray-900/70 dark:hover:text-white'>
                    {icon}
                    <span className='sr-only'>{label}</span>
                </button>
            </TooltipTrigger>
            <TooltipContent side='bottom' className='dark px-2 py-1 text-xs'>
                <p>{label}</p>
            </TooltipContent>
        </Tooltip>
    )
})

const MessageActions = memo(function MessageActions() {
    return (
        <div className='relative inline-flex bg-white dark:bg-zinc-900 rounded-md border border-black/[0.08] dark:border-white/[0.08] shadow-sm -space-x-px'>
            <TooltipProvider delayDuration={0}>
                <ActionButton
                    icon={<RiCodeSSlashLine size={16} />}
                    label='Show code'
                />
                <ActionButton
                    icon={<RiBookLine size={16} />}
                    label='Bookmark'
                />
                <ActionButton
                    icon={<RiLoopRightFill size={16} />}
                    label='Refresh'
                />
                <ActionButton
                    icon={<RiCheckLine size={16} />}
                    label='Approve'
                />
            </TooltipProvider>
        </div>
    )
})

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
    const isChatGenerating = useChatState((x) => x.isChatGenerating)
    let code = args?.new_str || args?.file_text || ''
    if (code && typeof code === 'object') {
        code = code?.['error'] || JSON.stringify(code, null, 2)
    }
    const command = args?.command
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
    const isChatGenerating = useChatState((x) => x.isChatGenerating)
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
