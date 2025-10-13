import { CSSProperties, Fragment, useEffect, useMemo, useState } from 'react'

import { createIdGenerator, isToolUIPart } from 'ai'
import { notifyError } from '../lib/errors'
import {
  ToolPartInputAvailable,
  ToolPartInputStreaming,
  ToolPartOutputAvailable,
  uiStreamToUIMessages,
} from 'contesto/src/lib/process-chat'
import { ScrollArea } from 'docs-website/src/components/ui/scroll-area'

import {
  ChatAssistantMessage,
  ChatErrorMessage,
  ChatUserMessage,
} from 'contesto/src/chat/chat-message'
import {
  ChatProvider,
  ChatState,
  useChatContext,
} from 'contesto/src/chat/chat-provider'
import { ChatRecordButton } from 'contesto/src/chat/chat-record-button'
import { ChatAutocomplete, ChatTextarea } from 'contesto/src/chat/chat-textarea'
import { MarkdownRuntime } from 'docs-website/src/lib/markdown-runtime'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover'
import { Sheet, SheetContent } from '../components/ui/sheet'

import { ArrowUpIcon, Trash2Icon, XIcon } from 'lucide-react'
import { useLocation, useRouteLoaderData } from 'react-router'
import { FileSystemEmulator } from 'website/src/lib/file-system-emulator'
import { cn } from '../lib/cn'
import {
  docsApiClientWithDurableFetch,
  docsDurableFetchClient,
} from '../lib/docs-spiceflow-client'
import {
  generateChatId,
  loadChatMessages,
  saveChatMessages,
  useDocsState,
  usePersistentDocsState,
} from '../lib/docs-state'
import {
  createEditExecute,
  EditToolParamSchema,
  isStrReplaceParameterComplete,
} from '../lib/edit-tool'
import { env } from '../lib/env'
import { DocsUIMessage } from '../lib/types'
import { capitalize, spaceCase, throttle, truncateText } from '../lib/utils'
import type { Route } from '../routes/_catchall'
import { usePreservedNavigate } from './preserved-search-link'
import { MarkdownRendererProps, RenderFormPreview } from 'contesto'
import {
  ErrorPreview,
  EditorToolPreview,
  ToolPreviewContainer,
  Dot,
} from './chat-tool-previews'
import { ShowMore } from './show-more'
import { useDisableBodyScroll, useDocsJson } from '../lib/hooks'
import { RenderNode } from 'safe-mdx'
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'

export function ChatDrawer({ loaderData }: { loaderData?: unknown }) {
  const chatId = usePersistentDocsState((x) => x.chatId)
  const location = useLocation()
  const navigate = usePreservedNavigate()

  // Get files from root loader data
  const rootLoaderData = useRouteLoaderData(
    'routes/_catchall',
  ) as Route.ComponentProps['loaderData']
  const files = rootLoaderData?.files || []

  const initialChatState = useMemo<Partial<ChatState>>(
    () => ({
      messages: loadChatMessages(chatId),
      abortController: new AbortController(),
      isGenerating: false,
    }),
    [chatId],
  )
  const drawerState = usePersistentDocsState((x) => x.drawerState)

  useDisableBodyScroll(drawerState === 'open')

  const submitMessageWithoutDelete = async ({
    messages,
    setMessages,
    abortController,
  }: Partial<ChatState>) => {
    const generateId = createIdGenerator()
    const currentSlug = location.pathname
    const currentOrigin =
      typeof window !== 'undefined' ? window.location.origin : ''

    const filesInDraft = useDocsState.getState()?.filesInDraft || {}
    console.log({ currentSlug, currentOrigin })
    try {
      const { data: generator, error } =
        await docsApiClientWithDurableFetch.holocronInternalAPI.generateMessage.post(
          {
            messages: messages as DocsUIMessage[],
            currentSlug: currentSlug,
            currentOrigin: currentOrigin,
            chatId: chatId,
            locale: 'en',
            filesInDraft: filesInDraft,
          },
          {
            query: {
              lastMessageId: messages![messages!.length - 1]!.id,
            },
            fetch: { signal: abortController?.signal },
          },
        )
      if (error) throw error

      async function getPageContent(githubPath: string) {
        if (typeof window === 'undefined') return ''
        let path = githubPath.startsWith('/') ? githubPath : '/' + githubPath
        const url = new URL(path, window.location.origin).toString()
        const res = await fetch(url)
        if (!res.ok) {
          throw new Error(
            `Failed to fetch page content for ${path}: ${res.statusText}`,
          )
        }
        const text = await res.text()
        return text
      }

      const onToolOutput = async (
        toolPart: ToolPartOutputAvailable<DocsUIMessage>,
      ) => {
        // Handle selectText tool output
        if (toolPart.type === 'tool-selectText') {
          if (toolPart.output?.error) {
            console.error('selectText error:', toolPart.output.error)
            return
          }

          const targetSlug = toolPart.output?.slug
          if (
            targetSlug &&
            typeof targetSlug === 'string' &&
            targetSlug !== location.pathname
          ) {
            await navigate(targetSlug)
          }
          usePersistentDocsState.setState({
            drawerState: 'minimized',
          })
          await new Promise((res) => setTimeout(res, 10))
          console.log('Highlighting lines:', toolPart.input)
          useDocsState.setState({
            highlightedLines: toolPart.input,
          })
        }

        // Handle goToPage tool output
        if (toolPart.type === 'tool-goToPage') {
          if (toolPart.output?.error) {
            console.error('goToPage error:', toolPart.output.error)
            return
          }

          const targetSlug = toolPart.output?.slug
          if (
            typeof targetSlug === 'string' &&
            targetSlug !== location.pathname
          ) {
            await navigate(targetSlug)
          }
        }
      }

      // Use throttle instead of debounce to ensure the function executes at regular intervals
      // and doesn't delay beyond the throttle period, which could cause it to override
      // the output-available call that comes later
      const onToolInputStreaming = throttle(
        50,
        async (
          toolPart:
            | ToolPartInputStreaming<DocsUIMessage>
            | ToolPartInputAvailable<DocsUIMessage>,
        ) => {
          if (toolPart.type === 'tool-strReplaceEditor') {
            const args: Partial<EditToolParamSchema> = toolPart.input as any
            if (args?.command === 'view' || args?.command === 'undo_edit') {
              return
            }
            if (!isStrReplaceParameterComplete(args)) {
              return
            }

            usePersistentDocsState.setState({
              drawerState: 'minimized',
            })

            // Create a temporary FileSystemEmulator for preview
            let updatedPagesCopy = { ...filesInDraft }
            const previewFileSystem = new FileSystemEmulator({
              filesInDraft: updatedPagesCopy,
              getPageContent,
              // No onFilesDraftChange callback for preview
            })
            const execute = createEditExecute({
              fileSystem: previewFileSystem,
            })

            await execute(args as any)
            console.log(
              'applying the setState update to the docs site',
              toolPart,
            )

            // Update docs state with new filesInDraft from the preview file system
            useDocsState.setState({
              filesInDraft: {
                ...previewFileSystem.getFilesInDraft(),
              },
            })
          }
        },
      )

      let finalMessages = messages
      for await (const newMessages of uiStreamToUIMessages<DocsUIMessage>({
        uiStream: generator,
        messages: messages as DocsUIMessage[],
        generateId,
        onToolOutput,
        onToolInput: onToolInputStreaming,
        onToolInputStreaming,
      })) {
        finalMessages = newMessages
        startTransition(() => {
          setMessages?.(newMessages)
        })
      }

      if (finalMessages && finalMessages.length > 0) {
        saveChatMessages(chatId, finalMessages)
      }
    } finally {
    }
  }

  const drawerContentStyle = (() => {
    if (drawerState === 'minimized') {
      return { transform: 'translateX(400px)' }
    }
    return {}
  })()

  const handleDrawerClick = (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (drawerState === 'minimized') {
      usePersistentDocsState.setState({ drawerState: 'open' })
      const textarea = document.querySelector('.chat-textarea') as HTMLElement
      if (textarea) {
        textarea.focus()
      }
    }
  }

  return (
    <ChatProvider
      initialValue={initialChatState}
      generateMessages={submitMessageWithoutDelete}
      onError={notifyError}
    >
      <AnimatePresence>
        {drawerState !== 'minimized' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className='fixed inset-0 bg-black/50 z-40'
            onClick={() => {
              usePersistentDocsState.setState({
                drawerState: 'closed',
              })
            }}
            aria-hidden='true'
          />
        )}
      </AnimatePresence>
      <Sheet
        onOpenChange={(open) => {
          console.log('Drawer open state changed:', open)
          if (drawerState === 'minimized') {
            return
          }
          usePersistentDocsState.setState({
            drawerState: open ? 'open' : 'closed',
          })
        }}
        open={drawerState !== 'closed'}
        modal={false}
      >
        <SheetContent
          className='bg-background lg:min-w-[600px] min-w-full'
          style={drawerContentStyle}
        >
          <ChatTopBar />
          <div
            onClick={handleDrawerClick}
            style={
              {
                '--show-more-bg': 'var(--color-background)',
              } as CSSProperties
            }
            className='p-4 flex flex-col min-h-0 grow pb-0'
          >
            <Chat />
          </div>
        </SheetContent>
      </Sheet>
    </ChatProvider>
  )
}

function ChatTopBar() {
  const { setMessages, stop } = useChatContext()
  const clearChat = (e) => {
    stop()
    const newChatId = generateChatId()
    usePersistentDocsState.setState({ chatId: newChatId })
    setMessages([])
    const textarea = document.querySelector('.chat-textarea') as HTMLElement
    if (textarea) {
      textarea.focus()
    }
  }

  const closeDrawer = () => {
    usePersistentDocsState.setState({ drawerState: 'closed' })
  }

  return (
    <div className='flex items-center justify-between p-4 border-b'>
      <div className='font-semibold'>Chat</div>
      <div className='flex items-center gap-2'>
        <Button
          variant='ghost'
          size='sm'
          onClick={clearChat}
          className='h-8 w-8 p-0'
        >
          <Trash2Icon className='h-4 w-4' />
        </Button>
        <Button
          variant='ghost'
          size='sm'
          onClick={closeDrawer}
          className='h-8 w-8 p-0'
        >
          <XIcon className='h-4 w-4' />
        </Button>
      </div>
    </div>
  )
}

function Chat({ }) {
  return (
    <ScrollArea className='[&>div>div]:grow -mr-4 [scrollbar-gutter:stable_both-edges] pr-4 relative items-stretch rounded max-h-full flex flex-col grow justify-center '>
      <div className='flex flex-col gap-4 relative h-full justify-center'>
        <Messages />
        <WelcomeMessage />
        <Footer />
      </div>
    </ScrollArea>
  )
}

export const renderChatNode: RenderNode = (node, transform) => {
  // TODO only enable colored bold in chat?
  if (node.type === 'strong') {
    return (
      <span className='dark:text-purple-200 font-mono'>
        {node.children?.map((child) => transform(child))}
      </span>
    )
  }
  if (node.type === 'thematicBreak') {
    return (
      <hr className='my-[4em] border-t border-border' />
    )
  }
  if (node.type === 'link') {
    return (
      <a
        href={node.url}
        target="_blank"
        rel="noopener noreferrer"
        className='underline text-blue-600 font-mono  dark:text-blue-300'
      >
        {node.children?.map((child) => transform(child))}
      </a>
    )
  }

  if (node.type === 'emphasis') {
    return (
      <span className='dark:text-emerald-200 font-mono'>
        {node.children?.map((child) => transform(child))}
      </span>
    )
  }
  if (node.type === 'delete') {
    return (
      <span className='dark:text-red-200 font-mono line-through'>
        {node.children?.map((child) => transform(child))}
      </span>
    )
  }
  if (node.type === 'inlineCode') {
    return (
      <span className='dark:text-red-200 dark:bg-red-950/30 px-[0.2em] rounded font-mono text-[0.9em]'>
        {node.value}
      </span>
    )
  }
  if (node.type === 'paragraph') {
    return (
      <p className='block my-[1em]'>
        {node.children?.map((child) => transform(child))}
      </p>
    )
  }

  if (node.type === 'heading') {
    return (
      <h2 className='block [&+*]:mt-0 font-mono dark:text-rose-300 mb-[1em]  mt-[0.5em]'>
        {node.children?.map((child) => transform(child))}
      </h2>
    )
  }

  if (node.type === 'list') {
    return (
      <div className='mb-[1em]'>
        {node.children?.map((child) => transform(child))}
      </div>
    )
  }

  if (node.type === 'listItem') {
    return (
      <div className='flex flex-row my-[0.5em]'>
        <span className='mr-[0.6em] inline-block align-top'>▪︎</span>
        <span className='[&>p]:my-0'>
          {node.children?.map((child) => transform(child))}
        </span>
      </div>
    )
  }
  if (node.type === 'table') {
    return (
      <table className="prose text-sm dark:prose-invert my-[1em] w-full overflow-auto">
        {node.children?.map((child) => transform(child))}
      </table>
    )
  }


  if (node.type === 'code') {
    const language = node.lang || ''

    const html = node.data?.['html']
    const props = {
      title: '',
      ...(node.data?.hProperties ?? {}),

      lang: language,
    }

    return (
      <div className='prose'>
        <CodeBlock {...props}>
          <Pre>
            {html ? (
              <div
                className='content'
                dangerouslySetInnerHTML={{ __html: html }}
              ></div>
            ) : (
              node.value
            )}
          </Pre>
        </CodeBlock>
      </div>
    )
  }
}

export function ChatMarkdown({ ...rest }: MarkdownRendererProps) {
  return (
    <MarkdownRuntime
      addMarkdownLineNumbers={false}
      renderNode={renderChatNode}
      isStreaming={true}
      {...rest}
      extension='md'
      className={cn(' leading-relaxed', rest.className)}
    />
  )
}

function WelcomeMessage() {
  const { messages } = useChatContext()
  const docsJson = useDocsJson()
  const assistantName = docsJson?.poweredBy?.name || 'Holocron'
  if (messages?.length) return null
  return (
    <ChatMarkdown
      markdown={
        `Hi, I am ${assistantName}, I can help you search and explain the docs\n`
      }
      className='text-2xl select-none text-center text-balance font-semibold'
      isStreaming={false}
    />
  )
}

function Messages({ ref }: { ref?: React.Ref<HTMLDivElement> }) {
  const { messages } = useChatContext()

  if (!messages.length) return null
  return (
    <div ref={ref} className={cn('w-full flex flex-col grow gap-6')}>
      {messages.map((message) => {
        return (
          <MessageRenderer
            key={message.id}
            message={message as DocsUIMessage}
          />
        )
      })}
      <ChatErrorMessage />
    </div>
  )
}
function MessageRenderer({ message }: { message: DocsUIMessage }) {
  const { isGenerating: isChatGenerating, messages } = useChatContext()

  const isLastMessage = messages[messages.length - 1]?.id === message.id
  if (message.role === 'user') {
    return (
      <ChatUserMessage className='my-4 text-[16px]' message={message}>
        {message.parts.map((part, index) => {
          if (part.type === 'text') {
            return part.text
          }
          return null
        })}
      </ChatUserMessage>
    )
  }

  let minHeight = isLastMessage ? 'calc(-248px + 100dvh)' : '0px'

  return (
    <ChatAssistantMessage style={{ minHeight }} className='' message={message}>
      {message.parts.map((part, index) => (
        <MessagePartRenderer key={index} part={part} />
      ))}
    </ChatAssistantMessage>
  )
}

export function MessagePartRenderer({
  part,
}: {
  part: DocsUIMessage['parts'][0]
}) {
  const { isGenerating: isChatGenerating, messages } = useChatContext()

  if (part.type === 'text') {
    return (
      <ChatMarkdown
        isStreaming={isChatGenerating}
        className=''
        markdown={part.text}
      />
    )
  }

  if (part.type === 'reasoning') {
    if (!part.text) return null
    return (
      <ShowMore>
        <div className='flex flex-row text-sm  opacity-80 tracking-wide gap-[1ch]'>
          <Dot />
          <ChatMarkdown
            isStreaming={isChatGenerating}
            className=''
            markdown={part.text}
          />
        </div>
      </ShowMore>
    )
  }
  if (part && 'errorText' in part && part.errorText) {
    return (
      <ToolPreviewContainer>
        <Dot /> {part.type}
        <ErrorPreview error={part.errorText} />
      </ToolPreviewContainer>
    )
  }
  if (part.type === 'tool-strReplaceEditor') {
    return <EditorToolPreview {...part} />
  }
  if (part.type === 'tool-getProjectFiles') {
    const code = part.output || '\n'

    if (!code) return null

    return (
      <ShowMore>
        <ToolPreviewContainer>
          <Dot toolCallId={part.toolCallId} /> Getting file structure
          <br />
          <ChatMarkdown
            isStreaming={isChatGenerating}
            className='pt-[1em] block'
            markdown={`\`\`\`sh lineNumbers=true\n${code}\n\`\`\``}
          />
        </ToolPreviewContainer>
      </ShowMore>
    )
  }
  if (part.type === 'tool-jsInterpreter') {
    const code = part.input?.code || '\n'
    const title = part.input?.title
    if (!code) return null
    const output = String(part.output || '')
    return (
      <ShowMore>
        <ToolPreviewContainer>
          <Dot toolCallId={part.toolCallId} /> Running JavaScript
          <br />
          <ChatMarkdown
            isStreaming={isChatGenerating}
            className='pt-[1em] block'
            markdown={`\`\`\`js title="${title}" lineNumbers=true\n${code}\n\`\`\``}
          />
          {output && (
            <ChatMarkdown
              isStreaming={isChatGenerating}
              className='block'
              markdown={`\`\`\`txt title="output logs"\n${output}\n\`\`\``}
            />
          )}
        </ToolPreviewContainer>
      </ShowMore>
    )
  }

  if (part.type === 'tool-selectText') {
    if (!part.input) return null
    return (
      <ToolPreviewContainer>
        <Dot /> Selecting lines {part.input?.slug}:{part.input?.startLine || 0}-
        {part.input?.endLine || ''}
      </ToolPreviewContainer>
    )
  }
  // if (
  //     part.type.startsWith('tool-') &&
  //     process.env.NODE_ENV === 'development'
  // ) {
  //     return (
  //         <pre>
  //             {JSON.stringify(part, null, 2)}
  //         </pre>
  //     )
  // }

  if (isToolUIPart(part) && part.state !== 'input-streaming') {
    const toolName = part.type.replace('tool-', '')
    const callArg = stringifyArgs(part.input)
    let error = part.errorText
    return (
      <ToolPreviewContainer className='text-[13px]'>
        <Dot />{' '}
        <span className='dark:text-purple-300'>
          {capitalize(spaceCase(toolName))}
        </span>{' '}
        {!!callArg && (
          <div className='flex flex-row gap-2'>
            <div className='shrink-0'>⎿</div>
            <div className=''>
              <span className='whitespace-pre-wrap'>{callArg}</span>
            </div>
          </div>
        )}
        {error && <ErrorPreview error={error} />}
      </ToolPreviewContainer>
    )
  }
  return null
}

function stringifyArgs(obj: any): string {
  if (!obj || typeof obj !== 'object') return ''
  return Object.entries(obj)
    .map(([key, value]) => {
      let strValue = JSON.stringify(value)
      if (typeof strValue === 'string' && strValue.length > 300) {
        strValue = strValue.slice(0, 50) + '...'
      }
      return `${key}=${strValue}`
    })
    .join('\n')
}

// Static autocomplete suggestions for first message
const AUTOCOMPLETE_SUGGESTIONS = [
  'Explain this page',
  'Summarize the current section',
  'What are the key concepts here?',
  'Show me usage examples',
  'How do I configure this?',
  'Troubleshoot related issues',
  'Compare with similar features',
  'Best practices for setup',
  'Show integration tips',
  'How can I optimize performance?',
]

function ContextButton({ contextOptions }) {
  const [open, setOpen] = useState(false)
  const { draftText, setDraftText } = useChatContext()

  const handleContextSelect = (selectedValue) => {
    if (!selectedValue) return

    const currentText = draftText || ''
    const newText = currentText + (currentText ? ' ' : '') + selectedValue
    setDraftText(newText)
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
            <CommandInput placeholder='Search context...' className='h-9' />
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
  const { isGenerating, draftText, submit, stop } = useChatContext()
  const chatId = usePersistentDocsState((x) => x.chatId)

  const rootLoaderData = useRouteLoaderData(
    'routes/_catchall',
  ) as Route.ComponentProps['loaderData']
  const files = rootLoaderData?.files || []

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
      notifyError(error, 'Transcription error')
      return ''
    }
  }

  const { messages } = useChatContext()
  useEffect(() => {
    const lastMessageId = messages[messages.length - 1]?.id || ''
    if (!lastMessageId) return
    const durableUrl = `/api/generateMessage?lastMessageId=${lastMessageId}`
    docsDurableFetchClient.isInProgress(durableUrl).then((res) => {
      console.log('isInProgress response:', res)
      if (res.inProgress) {
        submit()
      }
    })
  }, [chatId])

  // Generate context options from actual files
  const contextOptions = files
    .filter((file) => file.type === 'page')
    .map((file) => `@${file.path.replace(/\.mdx\?$/, '')}`)

  return (
    <>
      <div className=' sticky bottom-4 z-50 w-full mt-4'>
        <div
          className={cn(
            ' w-full mt-4 rounded-[10px] border bg-background flex flex-col max-w-3xl mx-auto space-y-3',
          )}
        >
          <ContextButton contextOptions={contextOptions} />
          <ChatTextarea
            disabled={false}
            placeholder='Ask me anything...'
            className={cn('chat-textarea')}
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
            {isGenerating ? (
              <Button
                className='rounded-md h-8'
                onClick={stop}
                variant='outline'
              >
                Stop
              </Button>
            ) : (
              <Button
                className='rounded-md h-8 w-8 p-0'
                onClick={submit}
                disabled={!draftText?.trim()}
                size='icon'
                variant={!draftText?.trim() ? 'outline' : 'default'}
              >
                <ArrowUpIcon className='size-4' />
              </Button>
            )}
          </div>
        </div>
        <ChatAutocomplete autocompleteSuggestions={AUTOCOMPLETE_SUGGESTIONS} />
      </div>
    </>
  )
}
