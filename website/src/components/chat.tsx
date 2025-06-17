'use client'
import memoize from 'micro-memoize'
import { RiAttachment2 } from '@remixicon/react'
import { createIdGenerator, UIMessage } from 'ai'
import { useState, useTransition } from 'react'
import { ChatMessage } from 'website/src/components/chat-message'

import { Button } from 'website/src/components/ui/button'
import { ScrollArea } from 'website/src/components/ui/scroll-area'

import { useStickToBottom } from 'use-stick-to-bottom'

import { fullStreamToUIMessages } from '../lib/process-chat'
import { apiClient } from '../lib/spiceflow-client'
import { useChatState } from '../lib/state'
import { Cards, Card } from 'fumadocs-ui/components/card'

import { CpuIcon, PanelsTopLeft, Database, Terminal } from 'lucide-react'
import {
    createEditExecute,
    EditToolParamSchema,
    isParameterComplete,
    PageUpdate,
} from '../lib/edit-tool'
import { docsRpcClient } from '../lib/docs-setstate'
import { Route } from '../routes/+types/org.$orgId.site.$siteId'
import { useLoaderData } from 'react-router'

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

    return (
        <div
            ref={ref}
            className='relative h-full flex flex-col grow pr-4 mt-6 space-y-6'
        >
            {messages.map((x) => {
                return <ChatMessage key={x.id} message={x} />
            })}
            {!messages.length && <ChatCards />}
        </div>
    )
}

function Footer() {
    const [text, setText] = useState('')
    const isPending = useChatState((x) => x.isChatGenerating)
    const { siteId, tabId } =
        useLoaderData() as Route.ComponentProps['loaderData']
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
                    siteId,
                    tabId,
                })
            if (error) throw error
            // Clear the input
            //
            const updatedPages: Record<string, PageUpdate> = {}
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
                updatedPages,
                getPageContent,
            })
            for await (const newMessages of fullStreamToUIMessages({
                fullStream: generator,
                messages: allMessages,
                generateId,
            })) {
                const lastMessage = newMessages[newMessages.length - 1]
                const lastPart = lastMessage.parts[lastMessage.parts.length - 1]
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
                        const result = await execute(toolInvocation.args)
                        // TODO create new tree too, the tree must be recreated when
                        // - an icon is added to a page, meaning frontmatter changes
                        // - a page is created
                        // - a page is deleted
                        // creating a tree is slow, this means it should be done not too often.
                        // creating a toc is slow too. it should be done max every second, with debounce
                        console.log(`updating docs pages: `)
                        console.log(updatedPages)
                        docsRpcClient.setDocsState({
                            updatedPages,
                        })
                    }
                }

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
