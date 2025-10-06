'use client'

import { useState, useMemo } from 'react'
import { createIdGenerator, UIMessage } from 'ai'
import { ChatAssistantMessage, ChatErrorMessage, ChatUserMessage } from 'contesto/src/chat/chat-message'
import { ChatProvider, ChatState, useChatContext } from 'contesto/src/chat/chat-provider'
import { ChatTextarea } from 'contesto/src/chat/chat-textarea'
import { useStickToBottom } from 'contesto/src/lib/stick-to-bottom'
import { ChatRecordButton } from 'contesto/src/chat/chat-record-button'
import { ChatUploadButton } from 'contesto/src/chat/chat-upload-button'
import { Markdown } from 'contesto/src/lib/markdown'
import '../shadcn.css'
import { ScrollArea } from 'contesto/src/components/ui/scroll-area'

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
  },
]

const AUTOCOMPLETE_SUGGESTIONS = [
  'How can I help you today?',
  'What would you like to know?',
  'Tell me about your project',
  'I need help with...',
  'Can you explain...',
  'Show me how to...',
  'What are the best practices for...',
  'Compare different approaches',
  'Troubleshoot this issue',
  'Performance optimization tips',
]

export function Chat() {
  const initialChatState = useMemo<Partial<ChatState>>(
    () => ({
      messages: exampleMessages,
      isGenerating: false,
    }),
    [],
  )

  return (
    <ChatProvider initialValue={initialChatState} onError={(error, msg) => {
      console.error(msg || 'Error in MCP chat', error)
    }}>
      <div className='flex flex-col max-h-[700px] '>
        <div className='px-3 py-4 w-full min-h-0 max-w-full max-h-full relative overflow-y-auto '>
          <div className='flex flex-col gap-4 relative h-full justify-center'>
            <Messages />
            <WelcomeMessage />
            <Footer />
          </div>
        </div>
      </div>
    </ChatProvider>
  )
}

function WelcomeMessage() {
  const { messages } = useChatContext()
  if (messages?.length) return null

  return (
    <div className='text-center py-8'>
      <h2 className='text-2xl select-none font-semibold text-foreground mb-4'>Welcome to MCP Chat Demo</h2>
      <p className='text-muted-foreground select-none'>Start a conversation by typing a message below</p>
    </div>
  )
}

function Messages({ ref }) {
  const { messages } = useChatContext()

  if (!messages?.length) return null

  return (
    <div ref={ref} className='flex flex-col gap-6 pb-4'>
      {messages.map((message) => (
        <MessageRenderer key={message.id} message={message} />
      ))}
      <ChatErrorMessage />
    </div>
  )
}

function MessageRenderer({ message }: { message: UIMessage }) {
  const { isGenerating: isChatGenerating } = useChatContext()

  if (message.role === 'user') {
    return (
      <ChatUserMessage message={message}>
        {message.parts.map((part, index) => {
          if (part.type === 'text') {
            return (
              <Markdown
                key={index}
                markdown={part.text}
                isStreaming={isChatGenerating}
                className='prose max-w-none'
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
              key={index}
              markdown={part.text}
              isStreaming={isChatGenerating}
              className='prose max-w-none'
            />
          )
        }

        return null
      })}
    </ChatAssistantMessage>
  )
}

function Footer() {
  const { isGenerating: isPending, text } = useChatContext()

  const transcribeAudio = async (audioFile: File): Promise<string> => {
    console.log('Audio transcription not implemented yet', audioFile)
    return ''
  }

  const onSubmit = async () => {
    console.log('Chat submission not implemented yet')
  }

  return (
    <div className=' sticky bottom-0 z-50 w-full mt-2'>
      <div className='flex flex-col text-sm gap-3 p-2 border rounded-lg bg-card'>
        <ChatTextarea
          onSubmit={onSubmit}
          disabled={isPending}
          placeholder='Type your message...'
          className='min-h-[30px] p-2 text-sm resize-none'
          rows={1}
          autoFocus
        />

        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <ChatUploadButton
              accept='image/*,text/*,.pdf,.docx,.doc'
              onFilesChange={(files) => {
                console.log('Files uploaded:', files)
              }}
            />
            <ChatRecordButton transcribeAudio={transcribeAudio} />
          </div>

          <button
            onClick={onSubmit}
            disabled={isPending || !text.trim()}
            className='px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {isPending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
