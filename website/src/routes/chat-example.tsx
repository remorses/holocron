import { useMemo } from 'react'

import { Button } from 'website/src/components/ui/button'
import { ScrollArea } from 'website/src/components/ui/scroll-area'

import { useStickToBottom } from 'use-stick-to-bottom'

import { fullStreamToUIMessages } from '../lib/process-chat'
import { apiClient } from '../lib/spiceflow-client'

import type { Route } from './+types/org.$orgId.site.$siteId.chat.$chatId'

import { RiAttachment2 } from '@remixicon/react'
import { createIdGenerator, UIMessage } from 'ai'
import { Markdown } from 'docs-website/src/lib/markdown'
import { startTransition, useState } from 'react'
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
import {
    Drawer,
    DrawerTrigger,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
    DrawerFooter,
    DrawerClose,
} from '../components/ui/drawer'
import { cn } from '../lib/cn'

export type { Route }

const messages: UIMessage[] = [
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

export default function Page({ loaderData }: Route.ComponentProps) {
    const initialChatState = useMemo<ChatState>(
        () => ({
            messages,
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
        <Drawer direction='right'>
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
                'Hi, I am fumadocs, I can help you with customizing your docs website or add new content. Here are some example things you can do:\n'
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
            {/* {!messages.length && <ChatCards />} */}
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

function Footer() {
    const [text, setText] = useState('')

    const isPending = useChatState((x) => x.isGenerating)

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
        <div
            className={cn(
                'sticky bottom-4 mt-4 z-50 w-full rounded-[20px] border bg-muted flex flex-col gap-2 max-w-3xl mx-auto space-y-3',
            )}
        >
            <ChatTextarea
                value={text}
                onChange={setText}
                autocompleteSuggestions={AUTOCOMPLETE_SUGGESTIONS}
                onSubmit={() => handleSubmit()}
                disabled={false}
                placeholder='Ask me anything...'
                className={cn(
                    'flex sm:min-h-[84px] w-full bg-transparent px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/70 outline-none resize-none',
                )}
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
    )
}
