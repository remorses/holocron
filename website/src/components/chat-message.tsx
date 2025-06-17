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

type ChatMessageProps = {
    message: UIMessage
    children?: React.ReactNode
}
function LoadingSpinner() {
    return (
        <div className='mt-2 ml-2 w-3 h-3 bg-white opacity-0 rotate-45 animate-[assistant-spinner-spin_1.7s_ease-in-out_infinite]'></div>
    )
}

export const ChatMessage = memo(function ChatMessage({
    message,
    children,
}: ChatMessageProps) {
    console.log(`rendering message ${message.id}`)
    const isChatGenerating = useChatState((x) => x.isChatGenerating)
    const isEmpty =
        message.parts.length === 0 ||
        (message.parts.length <= 2 &&
            message.parts.every((x) => x.type === 'text' && !x.text.trim()))
    if (isChatGenerating && isEmpty) {
        return <LoadingSpinner />
    }
    // return <LoadingSpinner />
    return (
        <article
            className={cn(
                'flex items-start max-w-full gap-4 min-w-0 leading-relaxed',
                message.role === 'user' && 'justify-end',
            )}
        >
            <div
                className={cn(
                    message.role === 'user'
                        ? 'bg-muted px-4 py-3 rounded-xl'
                        : 'space-y-4 max-w-full',
                )}
            >
                <div className=' prose text-sm dark:prose-invert'>
                    <p className='sr-only'>
                        {message.role === 'user' ? 'You' : 'Bart'} said:
                    </p>
                    {message.parts.map((part, index) => {
                        if (part.type === 'tool-invocation') {
                            // part.toolInvocation.state
                            if (
                                part.toolInvocation.toolName ===
                                'str_replace_editor'
                            ) {
                                return (
                                    <EditorMessagePreview
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

function EditorMessagePreview({
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
    return null
}
