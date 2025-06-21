'use client'
import { memo } from 'react'
import memoize from 'micro-memoize'
import { RiAttachment2, RiRefreshLine } from '@remixicon/react'
import { createIdGenerator, UIMessage } from 'ai'
import {
    useState,
    useTransition,
    useEffect,
    startTransition,
    useMemo,
} from 'react'
import { ChatMessage } from 'website/src/components/chat-message'

import { Button } from 'website/src/components/ui/button'
import { ScrollArea } from 'website/src/components/ui/scroll-area'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from 'website/src/components/ui/dropdown-menu'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from 'website/src/components/ui/popover'

import { useStickToBottom } from 'use-stick-to-bottom'

import { fullStreamToUIMessages } from '../lib/process-chat'
import { apiClient } from '../lib/spiceflow-client'
import { useChatState } from '../lib/state'
import { Cards, Card } from 'fumadocs-ui/components/card'

import {
    CpuIcon,
    PanelsTopLeft,
    Database,
    Terminal,
    ChevronDown,
    GitBranch,
    AlertCircle,
    X,
} from 'lucide-react'
import {
    createEditExecute,
    EditToolParamSchema,
    isParameterComplete,
    FileUpdate,
} from '../lib/edit-tool'
import { docsRpcClient } from '../lib/docs-setstate'
import { Route } from '../routes/+types/org.$orgId.site.$siteId.chat.$chatId'
import { useLoaderData, useRevalidator } from 'react-router'
import { teeAsyncIterable } from '../lib/utils'
import { generateSlugFromPath } from 'docs-website/src/lib/utils'
import { flushSync } from 'react-dom'
import { DialogOverlay } from '@radix-ui/react-dialog'

export default function Chat({}) {
    const { scrollRef, contentRef, scrollToBottom } = useStickToBottom()

    return (
        <ScrollArea
            ref={scrollRef}
            className='[&>div>div]:grow max-w-full h-full flex flex-col grow bg-background'
        >
            <Messages ref={contentRef} />
            <Footer />
        </ScrollArea>
    )
}

type ChatCardItem = {
    icon: React.ReactNode
    title: string
    description: string
    className?: string
}

// Example data, could be moved outside or passed as props
const chatCardItems: ChatCardItem[] = [
    {
        icon: <CpuIcon className='text-purple-300' />,
        title: 'Fumadocs Core',
        description: 'Handles logic like doc search and adapters.',
        className: '@max-lg:col-span-1',
    },
    {
        icon: <PanelsTopLeft className='text-blue-300' />,
        title: 'Fumadocs UI',
        description: 'A modern theme for docs and components.',
        className: '@max-lg:col-span-1',
    },
]

// The component
function ChatCards({ items = chatCardItems }: { items?: ChatCardItem[] }) {
    return (
        <Cards className='mt-auto '>
            {items.map((item, idx) => (
                <Card
                    key={item.title + idx}
                    icon={item.icon}
                    title={item.title}
                    className={item.className}
                >
                    {item.description}
                </Card>
            ))}
        </Cards>
    )
}

function Messages({ ref }) {
    const messages = useChatState((x) => x?.messages)
    const lastError = useChatState((x) => x?.lastError)

    return (
        <div
            ref={ref}
            className='relative h-full flex flex-col grow pr-4 mt-6 space-y-6'
        >
            {messages.map((x) => {
                return <ChatMessage key={x.id} message={x} />
            })}
            {lastError && <ErrorMessage error={lastError} />}
            {!messages.length && <ChatCards />}
        </div>
    )
}

function ErrorMessage({
    error,
}: {
    error: { messageId: string; error: string; userInput: string }
}) {
    const handleRetry = () => {
        // Clear the error and retry - the user message is already in the messages
        useChatState.setState({ lastError: undefined })
        // Trigger retry without user input since message is already there
        const event = new CustomEvent('chatRegenerate')
        window.dispatchEvent(event)
    }

    return (
        <div className='flex items-start max-w-full w-full gap-4 min-w-0 leading-relaxed'>
            <div className='space-y-4 w-full'>
                <div className='bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/50 rounded-lg p-4'>
                    <div className='flex items-start gap-3'>
                        <div className='flex-1'>
                            <h4 className='text-sm font-medium text-red-800 dark:text-red-200 mb-1'>
                                Failed to generate response
                            </h4>
                            <p className='text-sm text-red-700 dark:text-red-300'>
                                {error.error}
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

function Footer() {
    const [text, setText] = useState('')
    const isPending = useChatState((x) => x.isChatGenerating)

    const { siteId, chat, tabId, prUrl } =
        useLoaderData() as Route.ComponentProps['loaderData']
    const messages = useChatState((x) => x?.messages || [])

    const handleSubmit = async ({ inputText }: { inputText?: string } = {}) => {
        const messages = useChatState.getState()?.messages
        const submitText = inputText || text
        if (!submitText.trim() && messages.length === 0) return
        const generateId = createIdGenerator()
        flushSync(() => {
            useChatState.setState({
                isChatGenerating: true,
                lastError: undefined,
            })
        })

        const assistantMessageId = generateId()
        const userMessageId = generateId()

        try {
            let allMessages: UIMessage[]
            const now = new Date()

            if (!submitText.trim()) {
                // For regenerate, use existing messages and just add new assistant message
                allMessages = [
                    ...messages,
                    {
                        parts: [],
                        role: 'assistant',
                        content: '',
                        id: assistantMessageId,
                        createdAt: now,
                    },
                ]
            } else {
                // Create user message for new requests
                const userMessage: UIMessage = {
                    id: userMessageId,
                    content: '',
                    role: 'user',
                    createdAt: new Date(now.getTime() - 1),
                    parts: [{ type: 'text', text: submitText }],
                }

                allMessages = [
                    ...messages,
                    userMessage,
                    {
                        parts: [],
                        role: 'assistant',
                        content: '',
                        id: assistantMessageId,
                        createdAt: now,
                    },
                ]
                setText('') // Clear input for new requests
            }

            const docsState = useChatState.getState()?.docsState
            const filesInDraft = docsState?.filesInDraft || {}
            const currentSlug = docsState?.currentSlug || ''
            useChatState.setState({ messages: allMessages })

            const { data: generator, error } =
                await apiClient.api.generateMessage.post({
                    messages: allMessages,
                    siteId,
                    tabId,
                    currentSlug,
                    filesInDraft,
                    chatId: chat.chatId,
                })
            if (error) throw error
            // Clear the input
            //

            const getPageContent = memoize(
                async function getPageContent(x) {
                    const { data, error } =
                        await apiClient.api.getPageContent.post({
                            tabId,
                            githubPath: x.githubPath,
                        })
                    if (error) return ''
                    return data?.content
                },
                { transformKey: (x) => x.map((l) => JSON.stringify(l)) },
            )
            const execute = createEditExecute({
                filesInDraft: filesInDraft,
                getPageContent,
            })
            // Split the async iterator into two: one for docs edit, one for state updates
            const [editIter, stateIter] = teeAsyncIterable(
                fullStreamToUIMessages({
                    fullStream: generator,
                    messages: allMessages,
                    generateId,
                }),
            )

            // First iteration: handle docs/edit-tool logic
            let isPostMessageBusy = false
            async function updateDocsSite() {
                for await (const newMessages of editIter) {
                    const lastMessage = newMessages[newMessages.length - 1]
                    const lastPart =
                        lastMessage.parts[lastMessage.parts.length - 1]
                    if (
                        lastMessage.role === 'assistant' &&
                        lastPart?.type === 'tool-invocation'
                    ) {
                        const toolInvocation = lastPart.toolInvocation
                        if (toolInvocation.toolName === 'str_replace_editor') {
                            const args: Partial<EditToolParamSchema> =
                                toolInvocation.args
                            if (args?.command === 'view') {
                                continue
                            }
                            if (!isParameterComplete(args)) {
                                continue
                            }
                            const currentSlug = generateSlugFromPath(
                                args.path || '',
                                '/',
                            )
                            if (toolInvocation.state === 'partial-call') {
                                if (isPostMessageBusy) continue
                                let updatedPagesCopy = { ...filesInDraft }
                                const execute = createEditExecute({
                                    filesInDraft: updatedPagesCopy,
                                    getPageContent,
                                })
                                await execute(toolInvocation.args)
                                isPostMessageBusy = true
                                docsRpcClient
                                    .setDocsState({
                                        filesInDraft: updatedPagesCopy,
                                        currentSlug,
                                        isMarkdownStreaming: true,
                                    })
                                    .then(() => {
                                        isPostMessageBusy = false
                                    })
                            } else if (toolInvocation.state === 'result') {
                                await execute(toolInvocation.args)
                                console.log(
                                    `applying the setState update to the docs site`,
                                    toolInvocation,
                                )

                                await docsRpcClient.setDocsState(
                                    {
                                        filesInDraft: filesInDraft,
                                        isMarkdownStreaming: false,
                                        currentSlug,
                                    },
                                    toolInvocation.toolCallId,
                                )
                                useChatState.setState({
                                    docsState: { filesInDraft, currentSlug },
                                })
                            }
                        }
                    }
                }
            }
            updateDocsSite()

            // Second iteration: update chat state
            for await (const newMessages of stateIter) {
                startTransition(() => {
                    useChatState.setState({ messages: newMessages })
                })
            }
        } catch (error) {
            // Remove only the failed assistant message, keep user message
            const currentMessages = useChatState.getState().messages || []
            const messagesWithoutAssistant = currentMessages.filter(
                (msg) => msg.id !== assistantMessageId,
            )
            useChatState.setState({
                messages: messagesWithoutAssistant,
                lastError: {
                    messageId: assistantMessageId,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'An unexpected error occurred',
                    userInput: submitText,
                },
            })
        } finally {
            useChatState.setState({ isChatGenerating: false })
        }
    }
    // Listen for regenerate events
    useEffect(() => {
        const handleChatRegenerate = () => {
            // Generate a new assistant response
            handleSubmit()
        }

        window.addEventListener('chatRegenerate', handleChatRegenerate)
        return () => {
            window.removeEventListener('chatRegenerate', handleChatRegenerate)
        }
    }, [handleSubmit])

    const docsState = useChatState((x) => x.docsState)
    const filesInDraft = docsState?.filesInDraft || {}
    const hasFilesInDraft = Object.keys(filesInDraft).length > 0
    const updatedLines = useMemo(() => {
        return Object.values(filesInDraft).reduce(
            (sum, file) =>
                sum + (file.addedLines || 0) + (file.deletedLines || 0),
            0,
        )
    }, [filesInDraft])
    const showCreatePR = updatedLines && hasFilesInDraft

    return (
        <div className='sticky bottom-0 pt-4 md:pt-8 pr-4 z-50 w-full'>
            <div className='max-w-3xl mx-auto space-y-3'>
                <div className='flex flex-col gap-2 '>
                    <div className='flex gap-1 items-center'>
                        {showCreatePR && (
                            <DiffStats filesInDraft={filesInDraft} />
                        )}
                        {prUrl && (
                            <a
                                href={prUrl}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-xs text-accent-foreground underline'
                            >
                                view pr
                            </a>
                        )}
                        <div className='grow'></div>
                        {showCreatePR && (
                            <div className='flex justify-end'>
                                <PrButton />
                            </div>
                        )}
                    </div>
                    <div className='relative rounded-[20px] border border-transparent bg-muted transition-colors focus-within:bg-muted/50 focus-within:border-input has-[:disabled]:cursor-not-allowed  [&:has(input:is(:disabled))_*]:pointer-events-none'>
                        <textarea
                            className='flex sm:min-h-[84px] w-full bg-transparent px-4 py-3 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none [resize:none]'
                            placeholder='Ask me anything...'
                            aria-label='Enter your prompt'
                            value={text}
                            onKeyDown={(e) => {
                                if (
                                    e.key === 'Enter' &&
                                    (e.metaKey || e.ctrlKey)
                                ) {
                                    e.preventDefault()
                                    if (!isPending && text.trim()) {
                                        handleSubmit()
                                    }
                                }
                            }}
                            onChange={(e) => setText(e.target.value)}
                        />
                        {/* Textarea buttons */}
                        <div className='flex items-center justify-between gap-2 p-3'>
                            {/* Left buttons */}
                            <div className='flex items-center gap-2'>
                                <Button
                                    variant='outline'
                                    size='icon'
                                    className='rounded-full size-8 border-none hover:bg-background hover:shadow-md transition-[box-shadow]'
                                >
                                    <RiAttachment2
                                        className='text-muted-foreground/70 size-5'
                                        size={20}
                                        aria-hidden='true'
                                    />
                                </Button>
                            </div>
                            {/* Right buttons */}
                            <div className='flex items-center gap-2'>
                                <Button
                                    className='rounded-full h-8'
                                    onClick={() => handleSubmit()}
                                    disabled={isPending || !text.trim()}
                                >
                                    {isPending ? 'Loading...' : 'Generate'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function PrButton() {
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    const { siteId, prUrl, chatId, chat } =
        useLoaderData() as Route.ComponentProps['loaderData']

    const filesInDraft = useChatState((x) => x.docsState?.filesInDraft || {})
    const isChatGenerating = useChatState((x) => x.isChatGenerating)
    // Reset githubResultUrl when a new chat generation starts
    useEffect(() => {
        if (isChatGenerating) setPrUrl('')
    }, [isChatGenerating])

    const revalidator = useRevalidator()

    const handleCreatePr = async () => {
        setIsLoading(true)
        try {
            const files = Object.entries(filesInDraft).map(
                ([filePath, { content }]) => ({
                    filePath,
                    content: content || '',
                }),
            )

            const result = await apiClient.api.createPrSuggestionForChat.post({
                siteId,
                files,
                chatId,
            })
            if (result.error) throw result.error

            await revalidator.revalidate()
        } catch (error) {
            console.error('Failed to create PR:', error)
            const message =
                error instanceof Error ? error.message : 'Failed to create PR'
            setErrorMessage(message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className='flex items-center gap-2'>
            <Popover
                onOpenChange={(x) => {
                    if (!x) setErrorMessage('')
                }}
                open={!!errorMessage}
            >
                <PopoverTrigger>
                    <DropdownMenu>
                        <Button
                            variant='default'
                            onClick={handleCreatePr}
                            disabled={
                                isLoading || isChatGenerating || !!errorMessage
                            }
                            size={'sm'}
                            className='bg-purple-600 hover:bg-purple-700 text-white'
                        >
                            <div className='flex items-center gap-2'>
                                <GitBranch className='size-4' />
                                {isLoading
                                    ? 'loading...'
                                    : chat.prNumber
                                      ? `Push to PR #${chat.prNumber}`
                                      : 'Create Github PR'}
                            </div>
                            {/* <ChevronDown className='size-4 ml-1' /> */}
                        </Button>
                        <DropdownMenuContent
                            align='end'
                            className='min-w-[200px]'
                        ></DropdownMenuContent>
                    </DropdownMenu>
                </PopoverTrigger>

                {!!errorMessage && (
                    <div
                        style={{
                            pointerEvents: 'auto',
                        }}
                        className='fixed inset-0 z-50 bg-black/10 backdrop-blur-xs transition-all duration-100'
                    />
                )}

                <PopoverContent className='w-full max-w-[400px]'>
                    <div className='flex items-start gap-3 '>
                        <AlertCircle className='size-5 mt-0.5 flex-shrink-0' />
                        <div className='grow'>
                            <h4 className='font-medium  mb-1'>Error</h4>
                            <p className='text-sm '>{errorMessage}</p>
                        </div>
                        <Button
                            variant='ghost'
                            size='sm'
                            className='p-1 h-auto hover:text-destructive hover:bg-destructive/10'
                            onClick={() => setErrorMessage('')}
                        >
                            <X className='size-4' />
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}

interface DiffStatsProps {
    filesInDraft: Record<string, FileUpdate>
    className?: string
}

export const DiffStats = memo(function DiffStats({
    filesInDraft,
    className = '',
}: DiffStatsProps) {
    // Only include files that have additions or deletions
    const changedFiles = Object.entries(filesInDraft).filter(
        ([, file]) =>
            (file.addedLines || 0) > 0 || (file.deletedLines || 0) > 0,
    )
    const fileCount = changedFiles.length

    // Don't render if no files have diff
    if (fileCount === 0) {
        return null
    }

    const totalAdded = changedFiles.reduce(
        (sum, [, file]) => sum + (file.addedLines || 0),
        0,
    )
    const totalDeleted = changedFiles.reduce(
        (sum, [, file]) => sum + (file.deletedLines || 0),
        0,
    )

    return (
        <div
            className={`text-xs flex gap-2 text-muted-foreground px-2 py-1 rounded-md ${className}`}
        >
            <div>
                edited <span className='font-medium'>{fileCount}</span> file
                {fileCount !== 1 ? 's' : ''}
            </div>
            <div>
                {totalAdded > 0 && (
                    <>
                        {' '}
                        <span className='text-green-600 font-medium'>
                            +{totalAdded}
                        </span>
                    </>
                )}
                {totalDeleted > 0 && (
                    <>
                        ,{' '}
                        <span className='text-red-600 font-medium'>
                            -{totalDeleted}
                        </span>
                    </>
                )}
            </div>
        </div>
    )
})
