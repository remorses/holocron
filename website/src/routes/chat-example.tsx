import { useEffect, useMemo, useState } from 'react'

import { Button } from 'website/src/components/ui/button'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from 'website/src/components/ui/command'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from 'website/src/components/ui/popover'
import { ScrollArea } from 'website/src/components/ui/scroll-area'
import { useStickToBottom } from 'use-stick-to-bottom'
import { fullStreamToUIMessages } from 'contesto/src/lib/process-chat'
import type { Route } from './+types/org.$orgId.site.$siteId.chat.$chatId'
import { createIdGenerator, UIMessage } from 'ai'

import { MarkdownRuntime as Markdown } from 'docs-website/src/lib/markdown-runtime'
import { startTransition } from 'react'
import { AnimatePresence, motion } from 'unframer'
import {
    ChatAssistantMessage,
    ChatErrorMessage,
    ChatUserMessage,
} from 'contesto/src/chat/chat-message'
import { ChatAutocomplete, ChatTextarea } from 'contesto/src/chat/chat-textarea'
import { ToolInvocationRenderer } from 'website/src/components/tools-preview'
import {
    ChatProvider,
    ChatState,
    useChatState,
} from 'contesto/src/chat/chat-provider'
import { ChatRecordButton } from 'contesto/src/chat/chat-record-button'
import { ChatUploadButton } from 'contesto/src/chat/chat-upload-button'
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from '../components/ui/drawer'
import { cn } from '../lib/cn'
import {
    apiClientWithDurableFetch,
    durableFetchClient,
} from '../lib/spiceflow-client'

export type { Route }

const CHAT_ID = 'cmclxgpov0057htrcyf12y6j2'

let exampleMessages: UIMessage[] = [
    {
        id: '1',
        role: 'user',
        parts: [
            {
                type: 'text',
                text: 'Hi, I want to get started with customizing my docs site. Any guidance?',
            },
        ],
        content: '',
        createdAt: new Date(),
    },
    {
        id: '2',
        role: 'assistant',
        parts: [
            {
                type: 'text',
                text: `
# Welcome to the Docs Customizer! 🚀

I'm here to help you set up and tailor your documentation site. Here’s a quick overview of what you can do:

- **Change the theme color**: Easily switch your site's primary color to match your branding.
- **Add new docs**: Create new pages and organize your content with simple commands.
- **Edit navigation**: Rearrange, add or remove navigation items for better UX.
- **Upload media**: Drag and drop images, icons, or attachments to enhance your documentation.
- **Customize footer**: Manage contact info, social links, and legal pages in just a few clicks.
- **Instant preview**: See live changes before publishing.
- **Supports Markdown**: Write content with __Markdown__, including code snippets:

\`\`\`tsx
import { MyComponent } from 'components'
export default function Page() {
  return <MyComponent />
}
\`\`\`

> *Tip*: You can ask me to "add analytics tracking," "add a FAQ page," or "edit the home page introduction."

Here are some more things you can do:

- **Install plugins**: Extend functionality with custom or community plugins.
- **Configure authentication**: Set up user roles and permissions for your docs.
- **Multi-language support**: Enable translations for global audiences.
- **Embed videos or iframes**: Enhance docs with rich media.
- **Automate deployments**: Connect with CI/CD pipelines for seamless publishing.
- **Collect user feedback**: Add feedback widgets or forms.

If you want details on any of these, just ask!

Let me know what you'd like to do first!
                `.trim(),
            },
        ],
        content: '',
        createdAt: new Date(),
    },
]

exampleMessages = []

export default function Page({ loaderData }: Route.ComponentProps) {
    const initialChatState = useMemo<Partial<ChatState>>(
        () => ({
            messages: exampleMessages,
            isGenerating: false,
        }),
        [loaderData],
    )
    return (
        <ChatProvider initialValue={initialChatState}>
            <div className=' h-full max-h-full  w-full  flex flex-col grow'>
                <DrawerDemo />
            </div>
        </ChatProvider>
    )
}

export function DrawerDemo() {
    return (
        <Drawer defaultOpen direction='right'>
            <div className='flex flex-col items-center justify-center h-full '>
                <DrawerTrigger asChild>
                    <Button variant='outline'>Open Drawer</Button>
                </DrawerTrigger>
            </div>
            <DrawerContent className=' min-w-[600px]'>
                <DrawerHeader>
                    <DrawerTitle>Chat</DrawerTitle>
                    <DrawerDescription>
                        Set your daily activity goal.
                    </DrawerDescription>
                </DrawerHeader>
                <div className='p-4 flex flex-col min-h-0 grow pb-0'>
                    <Chat />
                </div>
            </DrawerContent>
        </Drawer>
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
                'Hi, I am fumabase, I can help you with customizing your docs website or add new content. Here are some example things you can do:\n'
            }
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
                            markdown={'thinking:' + part.reasoning}
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
    'change theme color to blue',
    'update site logo with new design',
    'add a new doc page about getting started',
    'edit navigation menu structure',
    'configure footer links and social media',
    'set up custom 404 error page',
    'add search functionality to docs',
    'create a faq section',
    'setup custom domain configuration',
    'add analytics tracking code',
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
                                            {option}
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
    const durableUrl = `/api/generateMessage?chatId=${CHAT_ID}`

    useEffect(() => {
        durableFetchClient.isInProgress(durableUrl).then(({ inProgress }) => {
            if (inProgress) {
                submitMessageWithoutDelete()
            }
        })
    }, [])
    const transcribeAudio = async (audioFile: File): Promise<string> => {
        try {
            const formData = new FormData()
            formData.append('audio', audioFile)

            const response = await fetch('/api/transcribeAudio', {
                method: 'POST',
                body: formData,
            })

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
            await apiClientWithDurableFetch.api.generateMessage.post(
                {
                    messages: messages,
                    siteId: 'cmclq67zf0002htommqegrrw4',
                    branchId: 'cmclq68780003htome4ryjfg9',
                    currentSlug: '',
                    filesInDraft: {},
                    chatId: CHAT_ID,
                },
                { query: { chatId: CHAT_ID } },
            )
        if (error) throw error

        const stateIter = fullStreamToUIMessages({
            fullStream: generator,
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
    const url = `/api/generateMessage?chatId=${CHAT_ID}`

    const contextOptions = [
        '@/docs/README.md',
        '@/docs/setup.md',
        '@/docs/changelog.md',
        '@/docs/faq.md',
    ]

    async function onSubmit() {
        await durableFetchClient.delete(url)
        await submitMessageWithoutDelete()
    }
    return (
        <AnimatePresence mode='popLayout'>
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
                        mentionOptions={contextOptions}
                    />

                    <div className='flex items-center justify-between gap-2 p-3 py-2'>
                        <ChatUploadButton
                            accept='image/*,text/*,.pdf,.docx,.doc'
                            onFilesChange={(files) => {
                                // TODO: Wire uploaded files to messages
                                console.log('Files uploaded:', files)
                            }}
                        />
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
