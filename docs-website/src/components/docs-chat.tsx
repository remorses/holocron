import { useEffect, useMemo, useState } from 'react'

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
import { Drawer, DrawerContent } from '../components/ui/drawer'
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
import { useDocsState, usePersistentDocsState } from '../lib/docs-state'
import { useRouteLoaderData } from 'react-router'
import type { Route } from '../root'
import { env } from '../lib/env'

export function ChatDrawer({ loaderData }: { loaderData?: any }) {
    const initialChatState = useMemo<Partial<ChatState>>(
        () => ({
            messages: [],
            isGenerating: false,
        }),
        [loaderData],
    )
    const isChatOpen = useDocsState((x) => x.isChatOpen)

    return (
        <ChatProvider initialValue={initialChatState}>
            <Drawer
                onOpenChange={(open) => {
                    useDocsState.setState({ isChatOpen: open })
                }}
                open={isChatOpen}
                direction='right'
            >
                <DrawerContent className='bg-background min-w-[600px]'>
                    {/* <DrawerHeader>
                        <DrawerTitle>Fumabase Chat</DrawerTitle>
                        <DrawerDescription>
                            Chat with the docs
                        </DrawerDescription>
                    </DrawerHeader> */}
                    <div className='p-4 flex flex-col min-h-0 grow pb-0'>
                        <Chat />
                    </div>
                </DrawerContent>
            </Drawer>
        </ChatProvider>
    )
}

function Chat({}) {
    const { scrollRef, contentRef } = useStickToBottom({
        initial: 'instant',
    })

    return (
        <ScrollArea
            ref={scrollRef}
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
                return <MessageRenderer key={message.id} message={message} />
            })}
            <ChatErrorMessage />
        </div>
    )
}

function MessageRenderer({ message }: { message: UIMessage }) {
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
                if (part.type === 'tool-invocation') {
                    return <ToolInvocationRenderer part={part} index={index} />
                }

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
                            markdown={'thinking:' + part.text}
                        />
                    )
                }

                return null
            })}
        </ChatAssistantMessage>
    )
}

// Static autocomplete suggestions for first message
const AUTOCOMPLETE_SUGGESTIONS = [
    'How do I get started with Fumabase?',
    'Explain the configuration options',
    'Show me deployment examples',
    'What are the API endpoints?',
    'How do I customize themes?',
    'Troubleshoot common issues',
    'Compare with other solutions',
    'Best practices for setup',
    'Integration examples',
    'Performance optimization tips',
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
    const durableUrl = `/api/generateMessage?chatId=${chatId}`

    // Get files from root loader data
    const rootLoaderData = useRouteLoaderData(
        'root',
    ) as Route.ComponentProps['loaderData']
    const files = rootLoaderData?.files || []

    useEffect(() => {
        docsDurableFetchClient
            .isInProgress(durableUrl)
            .then(({ inProgress }) => {
                if (inProgress) {
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

    const submitMessageWithoutDelete = async () => {
        const messages = useChatState.getState()?.messages
        const generateId = createIdGenerator()

        const { data: generator, error } =
            await docsApiClientWithDurableFetch.api.generateMessage.post(
                {
                    messages: messages,
                    currentSlug: '',
                    chatId: chatId,
                    locale: 'en',
                },
                { query: { chatId: chatId } },
            )
        if (error) throw error

        const stateIter = uiStreamToUIMessages({
            uiStream: generator,
            messages: messages,
            generateId,
        })

        // Second iteration: update chat state
        for await (const newMessages of stateIter) {
            startTransition(() => {
                useChatState.setState({ messages: newMessages })
            })
        }
    }
    const url = `/api/generateMessage?chatId=${chatId}`

    // Generate context options from actual files
    const contextOptions = files
        .filter((file) => file.type === 'page')
        .map((file) => `@${file.path.replace(/\.mdx\?$/, '')}`)

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
                        ' w-full rounded-[10px] border bg-background flex flex-col max-w-3xl mx-auto space-y-3',
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
                        <Button
                            className='rounded-md h-8'
                            onClick={onSubmit}
                            disabled={isPending || !text.trim()}
                        >
                            {isPending ? 'Loading...' : 'Generate'}
                        </Button>
                    </div>
                </motion.div>
                <ChatAutocomplete
                    autocompleteSuggestions={AUTOCOMPLETE_SUGGESTIONS}
                />
            </div>
        </AnimatePresence>
    )
}

export function ToolInvocationRenderer({
    part,
    index,
}: {
    part: any
    index: number
}) {
    const isChatGenerating = useChatState((x) => x.isGenerating)

    if (process.env.NODE_ENV === 'development') {
        return (
            <div key={index} className='text-sm'>
                <Markdown
                    isStreaming={isChatGenerating}
                    markdown={`🔧 Tool: ${part.toolInvocation?.toolName || 'unknown'}`}
                />
            </div>
        )
    }
    return null
}
