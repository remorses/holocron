import { useEffect, useMemo, useRef, useState } from 'react'

import { createIdGenerator, UIMessage } from 'ai'
import { uiStreamToUIMessages } from 'contesto/src/lib/process-chat'
import { ScrollArea } from 'docs-website/src/components/ui/scroll-area'
import { useStickToBottom } from 'use-stick-to-bottom'

import {
    ChatAssistantMessage,
    ChatErrorMessage,
    ChatUserMessage,
} from 'contesto/src/chat/chat-message'
import {
    ChatProvider,
    ChatState,
    useChatState,
} from 'contesto/src/chat/chat-provider'
import { ChatRecordButton } from 'contesto/src/chat/chat-record-button'
import { ChatAutocomplete, ChatTextarea } from 'contesto/src/chat/chat-textarea'
import { ChatUploadButton } from 'contesto/src/chat/chat-upload-button'
import { MarkdownRuntime as Markdown } from 'docs-website/src/lib/markdown-runtime'
import { startTransition } from 'react'
import { AnimatePresence, motion } from 'unframer'
import { Button } from '../components/ui/button'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '../components/ui/command'
import { Sheet, SheetContent } from '../components/ui/sheet'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '../components/ui/popover'

import { cn } from '../lib/cn'
import {
    docsApiClientWithDurableFetch,
    docsDurableFetchClient,
} from '../lib/docs-spiceflow-client'
import {
    useDocsState,
    usePersistentDocsState,
    generateChatId,
    saveChatMessages,
    loadChatMessages,
} from '../lib/docs-state'
import { useRouteLoaderData, useLocation, useNavigate } from 'react-router'
import type { Route } from '../routes/_catchall'
import { env } from '../lib/env'
import { Trash2Icon, XIcon } from 'lucide-react'
import { DocsUIMessage } from '../lib/types'
import { teeAsyncIterable } from 'contesto/src/lib/utils'
import { highlightText } from '../lib/highlight-text'

export function ChatDrawer({ loaderData }: { loaderData?: unknown }) {
    const chatId = usePersistentDocsState((x) => x.chatId)
    const initialChatState = useMemo<Partial<ChatState>>(
        () => ({
            messages: loadChatMessages(chatId),
            isGenerating: false,
        }),
        [loaderData, chatId],
    )
    const drawerState = usePersistentDocsState((x) => x.drawerState)

    const drawerContentStyle = (() => {
        if (drawerState === 'minimized') {
            return { transform: 'translateX(400px)' }
        }
        return {}
    })()

    const handleDrawerClick = (e) => {
        e.stopPropagation()
        e.preventDefault()
        if (drawerState === 'minimized') {
            usePersistentDocsState.setState({ drawerState: 'open' })
        }
    }

    return (
        <ChatProvider initialValue={initialChatState}>
            <AnimatePresence>
                {drawerState !== 'minimized' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className='fixed inset-0 bg-black/20 z-40'
                        onClick={() => {
                            usePersistentDocsState.setState({
                                drawerState: 'closed',
                            })
                        }}
                        aria-hidden='true'
                    />
                )}
            </AnimatePresence>
            <Sheet
                onOpenChange={(open) => {
                    console.log('Drawer open state changed:', open)
                    if (drawerState === 'minimized') {
                        return
                    }
                    usePersistentDocsState.setState({
                        drawerState: open ? 'open' : 'closed',
                    })
                }}
                open={drawerState !== 'closed'}
                modal={false}
            >
                <SheetContent
                    className='bg-background lg:min-w-[600px] min-w-full'
                    style={drawerContentStyle}
                >
                    <ChatTopBar />
                    <div
                        onClick={handleDrawerClick}
                        className='p-4 flex flex-col min-h-0 grow pb-0'
                    >
                        <Chat />
                    </div>
                </SheetContent>
            </Sheet>
        </ChatProvider>
    )
}

function ChatTopBar() {
    const clearChat = () => {
        const newChatId = generateChatId()
        usePersistentDocsState.setState({ chatId: newChatId })
        useChatState.setState({ messages: [] })
    }

    const closeDrawer = () => {
        usePersistentDocsState.setState({ drawerState: 'closed' })
    }

    return (
        <div className='flex items-center justify-between p-4 border-b'>
            <div className='font-semibold'>Chat</div>
            <div className='flex items-center gap-2'>
                <Button
                    variant='ghost'
                    size='sm'
                    onClick={clearChat}
                    className='h-8 w-8 p-0'
                >
                    <Trash2Icon className='h-4 w-4' />
                </Button>
                <Button
                    variant='ghost'
                    size='sm'
                    onClick={closeDrawer}
                    className='h-8 w-8 p-0'
                >
                    <XIcon className='h-4 w-4' />
                </Button>
            </div>
        </div>
    )
}

function Chat({}) {
    const { scrollRef, contentRef } = useStickToBottom({
        initial: 'instant',
    })

    return (
        <ScrollArea
            ref={scrollRef as any}
            className='[&>div>div]:grow -mr-4 pr-4 relative items-stretch rounded max-h-full flex flex-col grow justify-center '
        >
            <div className='flex flex-col gap-4 relative h-full justify-center'>
                <Messages ref={contentRef} />
                <WelcomeMessage />
                <Footer />
            </div>
        </ScrollArea>
    )
}

function WelcomeMessage() {
    const messages = useChatState((x) => x?.messages)
    if (messages?.length) return null
    return (
        <Markdown
            markdown={
                'Hi, I am fumabase, I can help you search and explain the docs\n'
            }
            className='text-2xl text-center text-balance font-semibold'
            isStreaming={false}
        />
    )
}

function Messages({ ref }) {
    const messages = useChatState((x) => x?.messages)

    if (!messages.length) return null
    return (
        <div ref={ref} className={cn('w-full flex flex-col grow gap-6')}>
            {messages.map((message) => {
                return (
                    <MessageRenderer
                        key={message.id}
                        message={message as DocsUIMessage}
                    />
                )
            })}
            <ChatErrorMessage />
        </div>
    )
}

function MessageRenderer({ message }: { message: DocsUIMessage }) {
    const isChatGenerating = useChatState((x) => x.isGenerating)

    if (message.role === 'user') {
        return (
            <ChatUserMessage message={message}>
                {message.parts.map((part, index) => {
                    if (part.type === 'text') {
                        return (
                            <Markdown
                                key={index}
                                className='[&_p]:m-0'
                                isStreaming={isChatGenerating}
                                markdown={part.text}
                            />
                        )
                    }
                    return null
                })}
            </ChatUserMessage>
        )
    }

    return (
        <ChatAssistantMessage message={message}>
            {message.parts.map((part, index) => {
                if (part.type === 'text') {
                    return (
                        <Markdown
                            isStreaming={isChatGenerating}
                            key={index}
                            markdown={part.text}
                        />
                    )
                }

                if (part.type === 'reasoning') {
                    return (
                        <Markdown
                            key={index}
                            isStreaming={isChatGenerating}
                            markdown={'thinking: ' + part.text}
                        />
                    )
                }

                if (part.type === 'tool-searchDocs') {
                    return (
                        <div
                            key={index}
                            className='text-sm text-muted-foreground'
                        >
                            <Markdown
                                isStreaming={isChatGenerating}
                                markdown={`🔍 Searching docs: ${part.input?.terms?.join(', ') || 'unknown'}`}
                            />
                        </div>
                    )
                }

                if (part.type === 'tool-goToPage') {
                    return (
                        <div
                            key={index}
                            className='text-sm text-muted-foreground'
                        >
                            <Markdown
                                isStreaming={isChatGenerating}
                                markdown={`📄 Navigating to: ${part.input?.slug || 'unknown'}`}
                            />
                        </div>
                    )
                }

                if (part.type === 'tool-getCurrentPage') {
                    return (
                        <div
                            key={index}
                            className='text-sm text-muted-foreground'
                        >
                            <Markdown
                                isStreaming={isChatGenerating}
                                markdown={`📍 Getting current page`}
                            />
                        </div>
                    )
                }

                if (part.type === 'tool-fetchUrl') {
                    return (
                        <div
                            key={index}
                            className='text-sm text-muted-foreground'
                        >
                            <Markdown
                                isStreaming={isChatGenerating}
                                markdown={`🌐 Fetching: ${part.input?.url || 'unknown'}`}
                            />
                        </div>
                    )
                }
                if (part.type === 'tool-selectText') {
                    if (!part.input) return null
                    return (
                        <div
                            key={index}
                            className='text-sm text-muted-foreground'
                        >
                            <Markdown
                                isStreaming={isChatGenerating}
                                markdown={`🔎 Selecting lines  ${part.input?.slug}:${part.input?.startLine || 0}:${part.input?.endLine || ''}`}
                            />
                        </div>
                    )
                }

                if (
                    part.type.startsWith('tool-') &&
                    process.env.NODE_ENV === 'development'
                ) {
                    return (
                        <pre key={index} className='text-xs p-2 rounded'>
                            {JSON.stringify(part, null, 2)}
                        </pre>
                    )
                }

                return null
            })}
        </ChatAssistantMessage>
    )
}

// Static autocomplete suggestions for first message
const AUTOCOMPLETE_SUGGESTIONS = [
    'Explain this page',
    'Summarize the current section',
    'What are the key concepts here?',
    'Show me usage examples',
    'How do I configure this?',
    'Troubleshoot related issues',
    'Compare with similar features',
    'Best practices for setup',
    'Show integration tips',
    'How can I optimize performance?',
]

function ContextButton({ contextOptions }) {
    const [open, setOpen] = useState(false)

    const handleContextSelect = (selectedValue) => {
        if (!selectedValue) return

        const currentText = useChatState.getState().text || ''
        const newText = currentText + (currentText ? ' ' : '') + selectedValue
        useChatState.setState({ text: newText })
        setOpen(false)
    }

    return (
        <div className='ml-2 my-2 self-start'>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant='ghost' className='border'>
                        @ Add context
                    </Button>
                </PopoverTrigger>
                <PopoverContent className='p-0 max-w-full' align='start'>
                    <Command>
                        <CommandInput
                            placeholder='Search context...'
                            className='h-9'
                        />
                        <CommandList>
                            <CommandEmpty>No context found.</CommandEmpty>
                            <CommandGroup>
                                {contextOptions.map((option) => (
                                    <CommandItem
                                        key={option}
                                        value={option}
                                        onSelect={() => {
                                            handleContextSelect(option)
                                        }}
                                        className='max-w-full'
                                    >
                                        <span className='truncate'>
                                            {option.replace(/^@\//, '')}
                                        </span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    )
}

function Footer() {
    const isPending = useChatState((x) => x.isGenerating)
    const text = useChatState((x) => x.text || '')
    const chatId = usePersistentDocsState((x) => x.chatId)
    const location = useLocation()
    const currentSlug = location.pathname
    const durableUrl = `/api/generateMessage?chatId=${chatId}`
    const abortControllerRef = useRef<AbortController | null>(null)

    // Get files from root loader data
    const rootLoaderData = useRouteLoaderData(
        'routes/_catchall',
    ) as Route.ComponentProps['loaderData']
    const files = rootLoaderData?.files || []

    useEffect(() => {
        docsDurableFetchClient.isInProgress(durableUrl).then((res) => {
            console.log('isInProgress response:', res)
            if (res.inProgress) {
                submitMessageWithoutDelete()
            }
        })
    }, [])
    const transcribeAudio = async (audioFile: File): Promise<string> => {
        try {
            const formData = new FormData()
            formData.append('audio', audioFile)

            const response = await fetch(
                new URL('/api/transcribeAudio', env.PUBLIC_URL).toString(),
                {
                    method: 'POST',
                    body: formData,
                },
            )

            if (!response.ok) {
                throw new Error('Transcription failed')
            }

            const { text } = await response.json()
            return text || ''
        } catch (error) {
            console.error('Transcription error:', error)
            return ''
        }
    }

    const navigate = useNavigate()

    const submitMessageWithoutDelete = async () => {
        const messages = useChatState.getState()?.messages as DocsUIMessage[]
        const generateId = createIdGenerator()
        const controller = new AbortController()
        abortControllerRef.current = controller
        const currentOrigin =
            typeof window !== 'undefined' ? window.location.origin : ''

        try {
            const { data: generator, error } =
                await docsApiClientWithDurableFetch.api.generateMessage.post(
                    {
                        messages: messages,
                        currentSlug: currentSlug,
                        currentOrigin: currentOrigin,
                        chatId: chatId,
                        locale: 'en',
                    },
                    {
                        query: { chatId: chatId },
                        fetch: { signal: controller.signal },
                    },
                )
            if (error) throw error

            const [effectsIter, stateIter] = teeAsyncIterable(
                uiStreamToUIMessages<DocsUIMessage>({
                    uiStream: generator,
                    messages: messages,
                    generateId,
                }),
            )
            async function updateDocsSite() {
                for await (const newMessages of effectsIter) {
                    try {
                        const lastMessage = newMessages[newMessages.length - 1]
                        const lastPart =
                            lastMessage.parts[lastMessage.parts.length - 1]
                        if (
                            lastMessage.role === 'assistant' &&
                            lastPart?.type === 'tool-selectText' &&
                            lastPart.state === 'output-available'
                        ) {
                            if (lastPart.output.error) {
                                continue
                            }
                            const targetSlug = lastPart.output?.slug
                            if (
                                targetSlug &&
                                typeof targetSlug === 'string' &&
                                targetSlug !== location.pathname
                            ) {
                                await navigate(targetSlug)
                            }
                            usePersistentDocsState.setState({
                                drawerState: 'minimized',
                            })
                            await new Promise((res) => setTimeout(res, 10))
                            highlightText(lastPart.input)
                        }
                        if (
                            lastMessage.role === 'assistant' &&
                            lastPart?.type === 'tool-goToPage' &&
                            lastPart.state === 'output-available'
                        ) {
                            if (lastPart.output.error) {
                                continue
                            }
                            const targetSlug = lastPart.output?.slug
                            if (
                                typeof targetSlug === 'string' &&
                                targetSlug !== location.pathname
                            ) {
                                await navigate(targetSlug)
                            }
                        }
                    } catch (error) {
                        console.error('Error in updateDocsSite loop:', error)
                    }
                }
            }
            updateDocsSite()

            // Second iteration: update chat state
            for await (const newMessages of stateIter) {
                if (controller.signal.aborted) {
                    break
                }
                startTransition(() => {
                    useChatState.setState({ messages: newMessages })
                })
            }

            // Save final messages to persistent storage
            const finalMessages = useChatState.getState().messages
            if (finalMessages && finalMessages.length > 0) {
                saveChatMessages(chatId, finalMessages)
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Generation aborted')
            } else {
                throw error
            }
        } finally {
            abortControllerRef.current = null
        }
    }
    const url = `/api/generateMessage?chatId=${chatId}`

    // Generate context options from actual files
    const contextOptions = files
        .filter((file) => file.type === 'page')
        .map((file) => `@${file.path.replace(/\.mdx\?$/, '')}`)

    const stopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
    }

    async function onSubmit() {
        await docsDurableFetchClient.delete(url)
        await submitMessageWithoutDelete()
    }
    return (
        <AnimatePresence custom={false} onExitComplete={() => {}}>
            <div className=' sticky bottom-4 z-50 w-full mt-4'>
                <motion.div
                    layoutId='textarea'
                    className={cn(
                        ' w-full mt-4 rounded-[10px] border bg-background flex flex-col max-w-3xl mx-auto space-y-3',
                    )}
                >
                    <ContextButton contextOptions={contextOptions} />
                    <ChatTextarea
                        onSubmit={onSubmit}
                        disabled={false}
                        placeholder='Ask me anything...'
                        className={cn('')}
                        autoFocus
                        mentionOptions={contextOptions}
                    />

                    <div className='flex items-center justify-between gap-2 p-3 py-2'>
                        {/* <ChatUploadButton
                            accept='image/*,text/*,.pdf,.docx,.doc'
                            onFilesChange={(files) => {
                                // TODO: Wire uploaded files to messages
                                console.log('Files uploaded:', files)
                            }}
                        /> */}
                        <ChatRecordButton transcribeAudio={transcribeAudio} />
                        <div className='grow'></div>
                        {isPending ? (
                            <Button
                                className='rounded-md h-8'
                                onClick={stopGeneration}
                                variant='outline'
                            >
                                Stop
                            </Button>
                        ) : (
                            <Button
                                className='rounded-md h-8'
                                onClick={onSubmit}
                                disabled={!text.trim()}
                            >
                                Generate
                            </Button>
                        )}
                    </div>
                </motion.div>
                <ChatAutocomplete
                    autocompleteSuggestions={AUTOCOMPLETE_SUGGESTIONS}
                />
            </div>
        </AnimatePresence>
    )
}
