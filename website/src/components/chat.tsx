'use client'
import {
    RiAttachment2,
    RiCodeSSlashLine,
    RiLeafLine,
    RiMicLine,
    RiShareCircleLine,
    RiShareLine,
    RiShining2Line,
} from '@remixicon/react'
import { createIdGenerator, UIMessage } from 'ai'
import { useState, useTransition } from 'react'
import { ChatMessage } from 'website/src/components/chat-message'

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from 'website/src/components/ui/breadcrumb'
import { Button } from 'website/src/components/ui/button'
import { ScrollArea } from 'website/src/components/ui/scroll-area'

import { useStickToBottom } from 'use-stick-to-bottom'

import { fullStreamToUIMessages } from '../lib/process-chat'
import { chatStateContainer, useChatState } from '../lib/state'
import { apiClient } from '../lib/spiceflow-client'

export default function Chat({}) {
    const { scrollRef, contentRef, scrollToBottom } = useStickToBottom()

    return (
        <ScrollArea
            ref={scrollRef}
            className=' [&>div>div]:h-full flex-1 h-full flex flex-col w-full grow shadow-md md:rounded-s-[inherit] min-[1024px]:rounded-e-3xl bg-background'
        >
            <div className='flex-1 flex flex-col h-full  px-4 md:px-5 '>
                {/* Chat */}
                <Messages ref={contentRef} />
                <Footer />
            </div>
        </ScrollArea>
    )
}

function Messages({ ref }) {
    const messages = useChatState((x) => x?.messages)

    return (
        <div ref={ref} className='relative flex h-full flex-col grow'>
            <div className='max-w-3xl w-full grow flex h-full flex-col mx-auto mt-6 space-y-6'>
                {messages.map((x) => {
                    return <ChatMessage key={x.id} message={x} />
                })}
            </div>
        </div>
    )
}

function Footer() {
    const [text, setText] = useState('')
    const [isPending, startTransition] = useTransition()
    const messages = useChatState((x) => x?.messages || [])

    const handleSubmit = () => {
        startTransition(async () => {
            const generateId = createIdGenerator()

            // Create user message
            const userMessage: UIMessage = {
                id: generateId(),
                content: '',
                role: 'user',
                parts: [{ type: 'text', text }],
            }

            // Call generateMessage with current messages plus user message
            const allMessages = [...messages, userMessage]
            chatStateContainer?.current?.setState({ messages: allMessages })
            const { data: generator, error } =
                await apiClient.api.generateMessage.post({
                    messages: allMessages,
                })
            if (error) throw error
            for await (const newMessages of fullStreamToUIMessages({
                fullStream: generator,
                messages: allMessages,
                generateId,
            })) {
                // Clear the input
                setText('')
                chatStateContainer?.current?.setState({ messages: newMessages })
            }
        })
    }

    return (
        <div className='sticky bottom-0 pt-4 md:pt-8 z-50'>
            <div className='max-w-3xl mx-auto bg-background rounded-[20px] pb-4 md:pb-8'>
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
                                <span className='sr-only'>Attach</span>
                            </Button>
                            <Button
                                variant='outline'
                                size='icon'
                                className='rounded-full size-8 border-none hover:bg-background hover:shadow-md transition-[box-shadow]'
                            >
                                <RiMicLine
                                    className='text-muted-foreground/70 size-5'
                                    size={20}
                                    aria-hidden='true'
                                />
                                <span className='sr-only'>Audio</span>
                            </Button>
                            <Button
                                variant='outline'
                                size='icon'
                                className='rounded-full size-8 border-none hover:bg-background hover:shadow-md transition-[box-shadow]'
                            >
                                <RiLeafLine
                                    className='text-muted-foreground/70 size-5'
                                    size={20}
                                    aria-hidden='true'
                                />
                                <span className='sr-only'>Action</span>
                            </Button>
                        </div>
                        {/* Right buttons */}
                        <div className='flex items-center gap-2'>
                            <Button
                                variant='outline'
                                size='icon'
                                className='rounded-full size-8 border-none hover:bg-background hover:shadow-md transition-[box-shadow]'
                            >
                                <svg
                                    xmlns='http://www.w3.org/2000/svg'
                                    width='16'
                                    height='16'
                                    fill='none'
                                >
                                    <g clipPath='url(#icon-a)'>
                                        <path
                                            fill='url(#icon-b)'
                                            d='m8 .333 2.667 5 5 2.667-5 2.667-2.667 5-2.667-5L.333 8l5-2.667L8 .333Z'
                                        />
                                        <path
                                            stroke='#451A03'
                                            strokeOpacity='.04'
                                            d='m8 1.396 2.225 4.173.072.134.134.071L14.604 8l-4.173 2.226-.134.071-.072.134L8 14.604l-2.226-4.173-.071-.134-.134-.072L1.396 8l4.173-2.226.134-.071.071-.134L8 1.396Z'
                                        />
                                    </g>
                                    <defs>
                                        <linearGradient
                                            id='icon-b'
                                            x1='8'
                                            x2='8'
                                            y1='.333'
                                            y2='15.667'
                                            gradientUnits='userSpaceOnUse'
                                        >
                                            <stop stopColor='#FDE68A' />
                                            <stop
                                                offset='1'
                                                stopColor='#F59E0B'
                                            />
                                        </linearGradient>
                                        <clipPath id='icon-a'>
                                            <path
                                                fill='#fff'
                                                d='M0 0h16v16H0z'
                                            />
                                        </clipPath>
                                    </defs>
                                </svg>
                                <span className='sr-only'>Generate</span>
                            </Button>
                            <Button
                                className='rounded-full h-8'
                                onClick={handleSubmit}
                                disabled={isPending || !text.trim()}
                            >
                                {isPending ? 'Loading...' : 'Ask Bart'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
