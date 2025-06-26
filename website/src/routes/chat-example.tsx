import { useEffect, useMemo } from 'react'
import { Button } from 'website/src/components/ui/button'
import { ScrollArea } from 'website/src/components/ui/scroll-area'

import { useStickToBottom } from 'use-stick-to-bottom'

import { fullStreamToUIMessages } from '../lib/process-chat'
import { apiClient } from '../lib/spiceflow-client'

import { DocsJsonType } from 'docs-website/src/lib/docs-json'
import {
    AlertTriangleIcon,
    FilePlus2Icon,
    ImageIcon,
    Link2Icon,
    ListTreeIcon,
    PaletteIcon,
} from 'lucide-react'

import { docsRpcClient } from '../lib/docs-setstate'
import { ChatSuggestionButton } from '../components/chat/chat-suggestion'
import type { Route } from './+types/org.$orgId.site.$siteId.chat.$chatId'

import { RiAttachment2 } from '@remixicon/react'
import { createIdGenerator, UIMessage } from 'ai'
import { Markdown } from 'docs-website/src/lib/markdown'
import { startTransition, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
    ChatAssistantMessage,
    ChatErrorMessage,
    ChatUserMessage,
} from 'website/src/components/chat/chat-message'
import { ChatTextarea } from 'website/src/components/chat/chat-textarea'
import { ToolInvocationRenderer } from 'website/src/components/tools-preview'
import {
    ChatProvider,
    ChatState,
    useChatState,
} from '../components/chat/chat-provider'

export type { Route }

export default function Page({ loaderData }: Route.ComponentProps) {
    const initialChatState = useMemo<ChatState>(
        () => ({
            messages: [],
            isChatGenerating: false,
        }),
        [loaderData],
    )
    return (
        <ChatProvider initialValue={initialChatState}>
            <div className=' h-full max-h-full  w-full  flex flex-col grow'>
                <Chat />
            </div>
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
            className='[&>div>div]:grow relative w-[700px] items-stretch rounded border mx-auto max-h-full flex flex-col grow '
        >
            <Messages ref={contentRef} />
            <Footer />
        </ScrollArea>
    )
}

function Messages({ ref }) {
    const messages = useChatState((x) => x?.messages)

    return (
        <div ref={ref} className=' w-full  flex flex-col grow px-4 mt-6 gap-6'>
            {!messages.length && (
                <ChatAssistantMessage
                    message={{
                        role: 'assistant',
                        id: '',
                        content: '',
                        parts: [
                            {
                                type: 'text',
                                text: 'Hi, I am fumadocs, I can help you with customizing your docs website or add new content. Here are some example things you can do:',
                            },
                        ],
                    }}
                >
                    <Markdown
                        markdown='Hi, I am fumadocs, I can help you with customizing your docs website or add new content. Here are some example things you can do:'
                        isStreaming={false}
                    />
                </ChatAssistantMessage>
            )}
            {messages.map((message) => {
                return <MessageRenderer key={message.id} message={message} />
            })}
            <ChatErrorMessage />
            {/* {!messages.length && <ChatCards />} */}
        </div>
    )
}

function MessageRenderer({ message }: { message: UIMessage }) {
    const isChatGenerating = useChatState((x) => x.isChatGenerating)

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

function Footer() {
    const [text, setText] = useState('')

    const isPending = useChatState((x) => x.isChatGenerating)

    const handleSubmit = async () => {
        const messages = useChatState.getState()?.messages
        const generateId = createIdGenerator()

        const { data: generator, error } =
            await apiClient.api.generateMessage.post({
                messages: messages,
                siteId: 'cmbvdu95n00041yyp88tfgyxt',
                tabId: 'main',
                currentSlug: '',
                filesInDraft: {},
                chatId: 'cmcci07p90033ieypfhp8lhna',
            })
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

    return (
        <div className='sticky bottom-0 pt-4 md:pt-8 p-4 z-50 w-full'>
            <div className='max-w-3xl mx-auto space-y-3'>
                <div className='flex flex-col gap-2 '>
                    <div className='relative rounded-[20px] border bg-muted'>
                        <ChatTextarea
                            value={text}
                            onChange={setText}
                            autocompleteSuggestions={AUTOCOMPLETE_SUGGESTIONS}
                            onSubmit={() => handleSubmit()}
                            disabled={false}
                            placeholder='Ask me anything...'
                            className='flex sm:min-h-[84px] w-full bg-transparent px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/70 outline-none resize-none'
                            mentionOptions={[
                                '@/docs/README.md',
                                '@/docs/setup.md',
                                '@/docs/changelog.md',
                                '@/docs/faq.md',
                            ]}
                        />

                        <div className='flex items-center justify-between gap-2 p-3'>
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
