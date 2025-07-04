'use client'

import { Tabs, Tab } from 'fumadocs-ui/components/tabs'
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
import type { CoreMessage } from 'ai'

export interface ChatExampleProps {
    /**
     * Chat messages to display
     */
    messages: CoreMessage[]

    /**
     * Tool name for context
     */
    toolName: string
}

/**
 * Component for displaying chat examples - needs client side for interactive tabs
 */
export function ChatExample({ messages, toolName }: ChatExampleProps) {
    return (
        <Tabs className='m-0 lg:w-[700px]' items={['Chat', 'Responses']}>
            <Tab value='Chat'>
                <div className='gap-2 flex flex-col grow h-full overflow-y-auto'>
                    {messages.map((message, index) => (
                        <div
                            key={index}
                            className={`p-2 rounded text-sm ${
                                message.role === 'user'
                                    ? 'bg-fd-primary/10 ml-4'
                                    : message.role === 'assistant'
                                      ? 'bg-fd-secondary mr-4'
                                      : 'bg-fd-muted/50'
                            }`}
                        >
                            <div className='font-medium text-xs mb-1 opacity-70'>
                                {message.role}
                            </div>
                            <div>
                                {typeof message.content === 'string'
                                    ? message.content
                                    : Array.isArray(message.content)
                                      ? message.content
                                            .map((part) =>
                                                part.type === 'text'
                                                    ? part.text
                                                    : `[${part.type}]`,
                                            )
                                            .join(' ')
                                      : '[complex content]'}
                            </div>
                        </div>
                    ))}
                </div>
            </Tab>
            <Tab value='Responses'>
                <CodeBlock title=''>
                    <Pre>
                        <code className='p-3'>
                            {JSON.stringify(messages, null, 2)}
                        </code>
                    </Pre>
                </CodeBlock>
            </Tab>
        </Tabs>
    )
}
