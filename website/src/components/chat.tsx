'use client'
import { RiAttachment2 } from '@remixicon/react'
import { createIdGenerator, UIMessage } from 'ai'
import { useState, useTransition } from 'react'
import { ChatMessage } from 'website/src/components/chat-message'

import { Button } from 'website/src/components/ui/button'
import { ScrollArea } from 'website/src/components/ui/scroll-area'

import { useStickToBottom } from 'use-stick-to-bottom'

import { fullStreamToUIMessages } from '../lib/process-chat'
import { apiClient } from '../lib/spiceflow-client'
import { chatStateContainer, useChatState } from '../lib/state'
import { Cards, Card } from 'fumadocs-ui/components/card'

import { CpuIcon, PanelsTopLeft, Database, Terminal } from 'lucide-react'

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
        description:
            'Handles logic like doc search and adapters.',
        className: '@max-lg:col-span-1',
    },
    {
        icon: <PanelsTopLeft className='text-blue-300' />,
        title: 'Fumadocs UI',
        description:
            'A modern theme for docs and components.',
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

    return (
        <div
            ref={ref}
            className='relative h-full flex flex-col grow pr-4 mt-6 space-y-6'
        >
            {messages.map((x) => {
                return <ChatMessage key={x.id} message={x} />
            })}
            <ChatCards />
        </div>
    )
}

function Footer() {
    const [text, setText] = useState('')
    const isPending = useChatState((x) => x.isChatGenerating)
    const messages = useChatState((x) => x?.messages || [])

    const handleSubmit = async () => {
        const generateId = createIdGenerator()
        useChatState.setState({ isChatGenerating: true })
        try {
            // Create user message
            const userMessage: UIMessage = {
                id: generateId(),
                content: '',
                role: 'user',
                parts: [{ type: 'text', text }],
            }

            // Call generateMessage with current messages plus user message
            const allMessages: UIMessage[] = [
                ...messages,
                userMessage,
                {
                    parts: [],
                    role: 'assistant',
                    content: '',
                    id: generateId(),
                    createdAt: new Date(),
                },
            ]
            setText('')
            useChatState.setState({ messages: allMessages })
            const { data: generator, error } =
                await apiClient.api.generateMessage.post({
                    messages: allMessages,
                })
            if (error) throw error
            // Clear the input

            for await (const newMessages of fullStreamToUIMessages({
                fullStream: generator,
                messages: allMessages,
                generateId,
            })) {
                useChatState.setState({ messages: newMessages })
            }
        } finally {
            useChatState.setState({ isChatGenerating: false })
        }
    }

    return (
        <div className='sticky bottom-0 pt-4 md:pt-8 pr-4 z-50 w-full'>
            <div className='max-w-3xl mx-auto bg-background rounded-[20px] '>
                <div className='relative rounded-[20px] border border-transparent bg-muted transition-colors focus-within:bg-muted/50 focus-within:border-input has-[:disabled]:cursor-not-allowed  [&:has(input:is(:disabled))_*]:pointer-events-none'>
                    <textarea
                        className='flex sm:min-h-[84px] w-full bg-transparent px-4 py-3 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none [resize:none]'
                        placeholder='Ask me anything...'
                        aria-label='Enter your prompt'
                        value={text}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
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
                                onClick={handleSubmit}
                                disabled={isPending || !text.trim()}
                            >
                                {isPending ? 'Loading...' : 'Generate'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
