import {
    RiBookLine,
    RiCheckLine,
    RiCodeSSlashLine,
    RiLoopRightFill,
} from '@remixicon/react'
import { UIMessage } from 'ai'
import { memo } from 'react'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from 'website/src/components/ui/tooltip'
import { cn } from 'website/src/lib/utils'
import { Markdown } from 'docs-website/src/lib/safe-mdx'

import { useChatState } from '../lib/state'
import { EditToolParamSchema } from '../lib/edit-tool'
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'

type ChatMessageProps = {
    message: UIMessage
    children?: React.ReactNode
}
function LoadingSpinner() {
    return (
        <div className='mt-2 ml-2 w-3 h-3 bg-white opacity-0 rotate-45 animate-[assistant-spinner-spin_1.7s_ease-in-out_infinite]'></div>
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
    // console.log(`rendering message ${message.id}`)
    const isChatGenerating = useChatState((x) => x.isChatGenerating)

    // Add isLastMessage
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
    // return <LoadingSpinner />
    return (
        <article
            className={cn(
                'flex items-start max-w-full w-full gap-4 min-w-0 leading-relaxed',
                message.role === 'user' && 'justify-end',
            )}
        >
            <div
                className={cn(
                    'max-w-full',
                    message.role === 'user'
                        ? 'bg-muted px-4 py-3 rounded-xl'
                        : 'space-y-4  w-full',
                )}
            >
                <div className='prose text-sm w-full max-w-full dark:prose-invert'>
                    <p className='sr-only'>
                        {message.role === 'user' ? 'You' : 'Bart'} said:
                    </p>
                    {message.parts.map((part, index) => {
                        if (part.type === 'tool-invocation') {
                            const toolName = part.toolInvocation.toolName
                            if (toolName === 'str_replace_editor') {
                                return (
                                    <EditorToolPreview
                                        {...part.toolInvocation}
                                    />
                                )
                            }
                            if (toolName === 'get_project_files') {
                                return (
                                    <FilesTreePreview
                                        {...part.toolInvocation}
                                    />
                                )
                            }
                            return (
                                <pre key={index}>
                                    {JSON.stringify(
                                        part.toolInvocation,
                                        null,
                                        2,
                                    )}
                                </pre>
                            )
                        }

                        if (part.type === 'text') {
                            if (message.role === 'user') {
                                return part.text
                            }
                            return <Markdown key={index} markdown={part.text} />
                        }

                        if (part.type === 'reasoning') {
                            return (
                                <Markdown
                                    key={index}
                                    markdown={'thinking:' + part.reasoning}
                                />
                            )
                        }
                    })}
                </div>
                {/* {message.role !== 'user' && !isChatGenerating && (
                    <MessageActions />
                )} */}
            </div>
        </article>
    )
})

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

function EditorToolPreview({
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
    const code = args?.new_str || ''
    const command = args?.command
    if (command === 'view') {
        return (
            <ToolPreviewContainer>
                reading {args?.path} {args?.view_range || ''}
            </ToolPreviewContainer>
        )
    }
    if (command === 'create') {
        return (
            <ToolPreviewContainer>
                <div>
                    <strong>Create file:</strong> {args?.path}
                    <Pre className='mt-2'>{args?.path}</Pre>
                </div>
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

    if (!code) return null
    const markdown =
        '```mdx' + ` title="${command} ${args?.path || ''}" \n` + code + '\n```'
    return (
        <ToolPreviewContainer className='py-0'>
            <Markdown markdown={markdown} />
        </ToolPreviewContainer>
    )
}

function FilesTreePreview({
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
    const code = result || '\n'
    if (!code) return null
    const markdown = '```sh' + ` title="file tree" \n` + code + '\n```'
    return (
        <ToolPreviewContainer className='py-0'>
            <Markdown markdown={markdown} />
        </ToolPreviewContainer>
    )
}

function ToolPreviewContainer({ className = '', children, ...props }) {
    return (
        <div
            className={cn(
                'border p-2 py-2 my-6 bg-muted rounded-lg flex flex-col w-full',
                className,
            )}
            {...props}
        >
            {children}
        </div>
    )
}
