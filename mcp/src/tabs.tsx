'use client'

import { Tabs, Tab } from 'fumadocs-ui/components/tabs'
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
import type { CoreMessage } from 'ai'
import { Chat } from './chat'

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
export function RightSideTabs({ messages, toolName }: ChatExampleProps) {
  return (
    <Tabs className='m-0 lg:w-[700px] ' items={['Chat', 'Responses']}>
      <Tab className='p-0' value='Chat'>
        <Chat />
      </Tab>
      <Tab className='' value='Responses'>
        <CodeBlock title=''>
          <Pre>
            <code className='p-3'>{JSON.stringify(messages, null, 2)}</code>
          </Pre>
        </CodeBlock>
      </Tab>
    </Tabs>
  )
}
