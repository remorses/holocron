import { cn } from 'website/src/lib/utils'
import {
    TooltipProvider,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from 'website/src/components/ui/tooltip'
import {
    RiCodeSSlashLine,
    RiBookLine,
    RiLoopRightFill,
    RiCheckLine,
} from '@remixicon/react'
import { UIMessage } from 'ai'
import { memo } from 'react'
import { Markdown } from './ui/markdown'
import { useChatState } from '../lib/state'

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
        message.parts.every((x) => x.type === 'text' && !x.text.trim())
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
                            return <Markdown key={index}>{part.text}</Markdown>
                        }

                        if (part.type === 'reasoning') {
                            return (
                                <Markdown className='opacity-70' key={index}>
                                    {'thinking:' + part.reasoning}
                                </Markdown>
                            )
                        }
                    })}
                </div>
                {message.role !== 'user' && !isChatGenerating && (
                    <MessageActions />
                )}
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
