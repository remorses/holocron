import {
    RiBookLine,
    RiCheckLine,
    RiCodeSSlashLine,
    RiEditLine,
    RiLoopRightFill,
    RiRefreshLine,
} from '@remixicon/react'
import { UIMessage } from 'ai'
import { memo, RefObject, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '../components/ui/tooltip.js'
import { cn } from '../lib/cn.js'

import { Button } from '../components/ui/button.js'
import { useChatState } from './chat-provider.js'
import { motion } from 'framer-motion'

function ChatLoadingSpinner() {
    // This will animate the dots: . .. ... . .. ... etc.
    // We use a span for each sequence, only one visible at a time via keyframes.
    // Inline style for keyframes to avoid external CSS dependencies.
    return (
        <span className='ml-2 mt-2 inline-flex h-3 select-none text-base text-muted-foreground'>
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
        (x) =>
            x.type === 'reasoning' ||
            x.type === 'text' ||
            x.type === 'step-start',
    )

    if (!allText) {
        return false
    }
    const content = message.parts.reduce(
        (acc, part) => acc + ((part as any)['text'] || ''),
        '',
    )
    if (content.length < 10) {
        return true
    }

    return false
}

export const ChatAssistantMessage = memo(function ChatMessage({
    message,
    children,
    style,
    className,
}: {
    message: UIMessage
    className?: string
    style?: React.CSSProperties
    children: React.ReactNode
}) {
    const isChatGenerating = useChatState((x) => x.isGenerating)
    const isLastAssistantMessage = useChatState(
        (x) =>
            x.messages.length > 0 &&
            x.messages[x.messages.length - 1]?.id === message.id &&
            message.role === 'assistant',
    )

    let content = children
    if (
        isLastAssistantMessage &&
        isChatGenerating &&
        isMessageAlmostEmpty(message)
    ) {
        content = <ChatLoadingSpinner />
    }

    return (
        <article
            style={style}
            data-message-id={message.id}
            className={cn(
                'flex items-start select-text max-w-full w-full gap-4 min-w-0 leading-relaxed',
                message.role === 'user' && 'justify-end',
                className,
            )}
        >
            <div
                className={cn(
                    'max-w-full relative group/message',
                    'space-y-4 w-full',
                )}
            >
                {content}
            </div>
        </article>
    )
})

const EditingUserMessage = memo(function EditingUserMessage({
    message,
}: {
    message: UIMessage
}) {
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
        <article
            data-message-id={message.id}
            className='flex items-start max-w-full w-full gap-4 min-w-0 leading-relaxed justify-end'
        >
            <div className='max-w-full relative group/message  grow px-4 py-3 rounded-xl'>
                <motion.div
                    className='inset-0 bg-muted absolute rounded-xl'
                    layout
                    layoutId={message.id}
                />
                <motion.div
                    layout='position'
                    layoutId={`content-${message.id}`}
                    className='prose isolate w-full max-w-full dark:prose-invert'
                >
                    <div ref={editingBox} className='space-y-2 w-full'>
                        <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    if (editText.trim()) {
                                        handleEditSave()
                                    }
                                }
                                if (e.key === 'Escape') {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleEditCancel()
                                }
                            }}
                            className='w-full min-h-0 min-w-[100px] p-px focus-visible:outline-none bg-transparent rounded-md  resize-none focus:outline-none'
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
                </motion.div>
            </div>
        </article>
    )
})

export function ChatUserMessage({
    children,
    message,
    className,
}: {
    children: React.ReactNode
    message: UIMessage
    className?: string
}) {
    const editingMessageId = useChatState((x) => x.editingMessageId)
    const messageId = message.id
    const isEditing = editingMessageId === messageId
    const messageRef = useRef<HTMLElement>(null)
    const [scrollStyle, setScrollStyle] = useState<React.CSSProperties>({})

    const MESSAGE_HEIGHT_THRESHOLD = 100 // Height threshold for considering a message "too tall"

    useEffect(() => {
        if (messageRef.current) {
            const height = messageRef.current.offsetHeight
            if (height > MESSAGE_HEIGHT_THRESHOLD) {
                // For tall messages, set negative scroll-margin-top to show only top portion
                const scrollMarginTop = -(height - 30)
                setScrollStyle({ scrollMarginTop: `${scrollMarginTop}px` })
            } else {
                // For normal messages, use the default scroll-mt-6 (24px)
                setScrollStyle({ scrollMarginTop: '24px' })
            }
        }
    }, [children])

    const handleEditStart = () => {
        useChatState.setState({ editingMessageId: messageId })
    }

    if (message.role === 'user' && isEditing) {
        return <EditingUserMessage message={message} />
    }

    return (
        <article
            ref={messageRef}
            data-message-id={message.id}
            className={cn(
                'flex items-start max-w-full w-full gap-4 min-w-0 leading-relaxed justify-end',
                className,
            )}
            style={scrollStyle}
        >
            <div className=' max-w-[80%] relative group/message  px-4 py-2 rounded-xl'>
                <motion.div
                    className='inset-0 bg-muted absolute rounded-xl'
                    layout
                    layoutId={message.id}
                />
                <div className='absolute hidden group-hover/message:block -top-2 -right-2'>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant='outline'
                                size='icon'
                                className='rounded-full size-6 border-none bg-background shadow-md hover:bg-muted'
                                onClick={handleEditStart}
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
                <motion.div
                    layoutId={`content-${message.id}`}
                    layout='position'
                    className='full isolate max-w-full'
                >
                    {children}
                </motion.div>
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

const ChatMessageActions = memo(function MessageActions() {
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

function truncateText(text: string, maxLength: number = 500): string {
    if (!text?.length || text?.length <= maxLength) {
        return text
    }
    return text.slice(0, maxLength).trimEnd() + '...'
}

export function ChatErrorMessage() {
    const error = truncateText(
        useChatState((x) => x?.assistantErrorMessage) || '',
    )

    const handleRetry = () => {
        // Clear the error and retry - the user message is already in the messages
        useChatState.setState({ assistantErrorMessage: undefined })
        // Trigger retry without user input since message is already there
        const event = new CustomEvent('chatRegenerate')
        window.dispatchEvent(event)
    }
    if (!error) return null
    return (
        <div className='flex items-start max-w-full w-full gap-4 min-w-0 leading-relaxed'>
            <div className='space-y-4 w-full'>
                <div className='bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/50 rounded-lg p-4'>
                    <div className='flex items-start gap-3'>
                        <div className='flex-1 select-text'>
                            <h4 className=' font-medium text-red-800 dark:text-red-200 mb-1'>
                                Failed to generate response
                            </h4>
                            <p className='break-all text-red-700 dark:text-red-300'>
                                {error}
                            </p>
                        </div>
                        <Button
                            variant='outline'
                            size='sm'
                            onClick={handleRetry}
                            className='border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/50'
                        >
                            <RiRefreshLine className='w-4 h-4 mr-1' />
                            Retry
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function useClickOutside<T extends HTMLElement>(
    ref: RefObject<T | null>,
    onAway: (e: MouseEvent | TouchEvent) => void,
) {
    useEffect(() => {
        const listener = (e: MouseEvent | TouchEvent) => {
            if (!ref.current || ref.current.contains(e.target as Node)) return
            onAway(e)
        }

        document.addEventListener('mousedown', listener)
        document.addEventListener('touchstart', listener)

        return () => {
            document.removeEventListener('mousedown', listener)
            document.removeEventListener('touchstart', listener)
        }
    }, [ref, onAway])
}
