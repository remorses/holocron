'use client'

import { createIdGenerator, isToolUIPart, UIMessage, FileUIPart } from 'ai'
import { ChatAssistantMessage, ChatErrorMessage, ChatUserMessage } from 'contesto/src/chat/chat-message'
import { notifyError } from '../lib/errors'
import { ChatAutocomplete, ChatTextarea } from 'contesto/src/chat/chat-textarea'
import { isDocsJson } from 'docs-website/src/lib/utils'
import { DOCS_JSON_BASENAME } from 'docs-website/src/lib/constants'

import { CSSProperties, startTransition, useEffect, useMemo, useState } from 'react'

import { Dot, ToolPreviewContainer } from 'docs-website/src/components/chat-tool-previews'
import { TodoPreview } from 'docs-website/src/components/todo-tool-previews'
import { WebSearchFirecrawlPreview } from './web-search-firecrawl-preview'
import { WebSearchGooglePreview } from './web-search-google-preview'

import { Button } from 'website/src/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from 'website/src/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from 'website/src/components/ui/tooltip'
import { DiffStats, PrButton, SaveChangesButton } from './chat-buttons'
import { WelcomeMessage } from './chat-welcome'

import { ToolPartInputStreaming, ToolPartOutputAvailable, uiStreamToUIMessages } from 'contesto/src/lib/process-chat'
import { useShouldHideBrowser, useConfirmLeave } from '../lib/hooks'
import { apiClient, apiClientWithDurableFetch, durableFetchClient } from '../lib/spiceflow-client'
import { doFilesInDraftNeedPush, useWebsiteState } from '../lib/state'

import { jsxDedent, RenderFormPreview } from 'contesto'
import { ChatProvider, ChatState, useChatContext, useChatState } from 'contesto/src/chat/chat-provider'
import { ChatRecordButton } from 'contesto/src/chat/chat-record-button'
import { ChatSuggestionButton } from 'contesto/src/chat/chat-suggestion'
import { ChatUploadButton } from 'contesto/src/chat/chat-upload-button'
import {
  createEditExecute,
  EditToolParamSchema,
  GetPageContentArgs,
  isStrReplaceParameterComplete,
} from 'docs-website/src/lib/edit-tool'
import { FileSystemEmulator } from '../lib/file-system-emulator'
import {
  capitalize,
  escapeMdxSyntax,
  generateSlugFromPath,
  spaceCase,
  throttle,
  truncateText,
} from 'docs-website/src/lib/utils'
import { ArrowUpIcon, FilePlus2Icon, ImageIcon, ListTreeIcon, PaletteIcon } from 'lucide-react'
import React from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useLoaderData, useLocation, useParams, useRevalidator, useRouteLoaderData } from 'react-router'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from 'website/src/components/ui/command'
import { docsRpcClient } from '../lib/docs-setstate'
import { WebsiteUIMessage } from '../lib/types'
import { cn, safeJsoncParse, transcribeAudio, uploadFileToSite } from '../lib/utils'
import { Route } from '../routes/+types/org.$orgId.branch.$branchId.chat.$chatId._index'
import type { Route as BranchRoute } from '../routes/org.$orgId.branch.$branchId'
import { TruncatedText } from './truncated-text'
import { MessagePartRenderer } from 'docs-website/src/components/docs-chat'
import { useSearchParams } from 'react-router'

const setDocsJsonState = ({ values, githubFolder, previousValues }) => {
  console.log(`form values changed, sending state to docs iframe`)
  let githubPath = DOCS_JSON_BASENAME
  if (githubFolder) {
    githubPath = `${githubFolder}/${DOCS_JSON_BASENAME}`
  }

  const newJson = JSON.stringify(
    {
      ...previousValues,
      ...values,
    },
    null,
    2,
  )
  console.log(`updating ${DOCS_JSON_BASENAME}`, newJson)

  const newChanges = {
    [githubPath]: {
      content: newJson,
      githubPath,
    },
  }
  const newFilesInDraft = {
    ...useWebsiteState.getState().filesInDraft,
    ...newChanges,
  }
  useWebsiteState.setState({ filesInDraft: newFilesInDraft })
  docsRpcClient.setDocsState({
    // revalidate: true, // TODO
    state: { filesInDraft: newChanges },
  })
}

function ChatForm({ children, disabled }) {
  const { chatId } = useParams()
  const { siteBranch, githubFolder } = useLoaderData() as Route.ComponentProps['loaderData']
  const { submit, messages, setMessages, setDraftText } = useChatContext()

  const formMethods = useForm({
    disabled,
    // https://chatgpt.com/share/689903d5-2624-800e-870c-a1e226fd230d
    // do not pass defaultValues here otherwise setValue calls will not trigger subscribe callback if value does not change. meaning the state is not updated for filesInDraft for docs json
    // reset() call instead will trigger subscribe callback so we can use it in useEffect instead
  })

  const isOnboardingChat = useShouldHideBrowser()

  const docsJsonString = useWebsiteState((state) => {
    return Object.entries(state.filesInDraft || {}).find(([key]) => isDocsJson(key))?.[1]?.content || ''
  })

  const currentDocsJson = useMemo(() => {
    function getCurrentDocsJson({ siteBranch }) {
      // Use filesInDraft > siteBranch.docsJson
      if (docsJsonString) {
        return safeJsoncParse(docsJsonString) || {}
      }

      // Fall back to siteBranch.docsJson
      const docsJson = siteBranch?.docsJson
      if (!docsJson || typeof docsJson !== 'object') {
        return {}
      }
      return docsJson
    }
    return getCurrentDocsJson({ siteBranch })
  }, [docsJsonString, siteBranch])

  useEffect(() => {
    if (isOnboardingChat) return
    if (disabled) return
    const unSub = formMethods.subscribe({
      formState: { values: true },
      callback: () =>
        setDocsJsonState({
          values: formMethods.getValues(),
          githubFolder,
          previousValues: currentDocsJson,
        }),
    })

    return unSub
  }, [disabled, formMethods.subscribe, isOnboardingChat, currentDocsJson, githubFolder])

  // reset the form values on the first visit with the docs json values. it also resets the form values when the docs json file is updated via the strReplaceEditor tool
  useEffect(() => {
    if (isOnboardingChat) return
    if (disabled) return

    console.log(DOCS_JSON_BASENAME, currentDocsJson)

    if (!currentDocsJson || Object.keys(currentDocsJson).length === 0) return

    formMethods.reset(currentDocsJson, { keepDefaultValues: true })
  }, [disabled, isOnboardingChat, currentDocsJson, githubFolder])

  return (
    <form
      className='flex flex-col grow'
      onSubmit={formMethods.handleSubmit(() => {
        if (disabled) return
        if (isOnboardingChat) {
          const currentValues = formMethods.getValues()

          // Format values as key: value pairs instead of JSON
          const formattedMessage = Object.entries(currentValues)
            .filter(([, value]) => value !== '' && value != null)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n')

          setDraftText(formattedMessage)
          submit()
        }
      })}
    >
      <FormProvider {...formMethods}>{children}</FormProvider>
    </form>
  )
}

export default function Chat({ ref }: { ref?: React.RefObject<HTMLDivElement> }) {
  const loaderData = useLoaderData() as Route.ComponentProps['loaderData']
  const { chat, siteId, branchId } = loaderData
  const revalidator = useRevalidator()
  const location = useLocation()

  const [searchParams] = useSearchParams()
  const initialChatState = useMemo(() => {
    // Get prompt from URL search params
    const promptFromUrl = searchParams.get('prompt') || ''

    const state: Partial<ChatState> = {
      // Set initial draftText from URL prompt if it exists
      draftText: promptFromUrl,
      messages: chat.messages.map((msg) => {
        const {
          textParts = [],
          reasoningParts = [],
          toolParts = [],
          sourceUrlParts = [],
          fileParts = [],
          ...rest
        } = msg

        const message: UIMessage = {
          ...rest,
          parts: [...textParts, ...reasoningParts, ...toolParts, ...sourceUrlParts, ...fileParts]
            .flat()
            .sort((a, b) => a.index - b.index)
            // add step start messages. required for claude
            .flatMap((part, index) => {
              if (msg.role !== 'assistant') return [part]
              if (index === 0) return [{ type: 'step-start' }, part]
              if (part.type === 'text' || isToolUIPart(part as any)) {
                return [{ type: 'step-start' }, part]
              } else {
                return [part]
              }
            }) as any,
        }
        return message
      }),
      isGenerating: false,
    }

    // console.log('Using new initial chat state', state)
    return state
  }, [loaderData.chatId,])

  const submitMessages = async ({ messages, setMessages, abortController }: ChatState) => {
    const generateId = createIdGenerator()

    const filesInDraft = useWebsiteState.getState()?.filesInDraft || {}
    const currentSlug = useWebsiteState.getState()?.currentSlug || ''
    const { githubFolder } = loaderData

    // Set generating state to true when starting
    useWebsiteState.setState({ isChatGenerating: true })

    const { data: generator, error } = await apiClientWithDurableFetch.api.generateMessage.post(
      {
        messages: messages as WebsiteUIMessage[],
        siteId,
        branchId,
        currentSlug,
        filesInDraft,
        githubFolder,
        chatId: chat.chatId,
      },
      {
        query: {
          lastMessageId: messages[messages.length - 1]?.id,
        },
        fetch: { signal: abortController.signal },
      },
    )
    if (error) {
      // Set generating state to false on error
      useWebsiteState.setState({ isChatGenerating: false })
      throw error
    }
    async function getPageContent(githubPath: string) {
      const { data, error } = await apiClient.api.getPageContent.post({
        branchId,
        githubPath: githubPath,
      })
      if (error) return ''
      return data?.content
    }
    const globalFileSystem = new FileSystemEmulator({
      filesInDraft,
      baseDir: githubFolder || undefined,
      getPageContent,
      onFilesDraftChange: async () => { },
    })
    const execute = createEditExecute({
      fileSystem: globalFileSystem,
    })

    let isPostMessageBusy = false

    const onToolOutput = async (toolPart: ToolPartOutputAvailable<WebsiteUIMessage>) => {
      const args: Partial<EditToolParamSchema> = toolPart.input as any

      if (toolPart.type === 'tool-strReplaceEditor') {
        if (args?.command === 'view') {
          return
        }

        const currentSlug = generateSlugFromPath(args.path || '', githubFolder)

        await execute(args as any)
        console.log(`applying the setState update to the docs site`, toolPart)

        let revalidate = args.command === 'create'
        useWebsiteState.setState({
          filesInDraft: { ...filesInDraft },
          currentSlug,
        })
        try {
          await docsRpcClient.setDocsState({
            state: {
              filesInDraft: filesInDraft,
              isMarkdownStreaming: false,
              currentSlug,
            },
            revalidate,
            idempotenceKey: toolPart.toolCallId,
          })
        } catch (e) {
          console.error('failed setDocsState', e)
        }
      }

      // Handle selectText tool output
      if (toolPart.type === 'tool-selectText') {
        if (toolPart.output?.error) {
          console.error('selectText error:', toolPart.output.error)
          return
        }

        const targetSlug = toolPart.output?.slug
        if (targetSlug && typeof targetSlug === 'string') {
          const currentSlug = targetSlug

          try {
            await docsRpcClient.setDocsState({
              state: {
                currentSlug,
                highlightedLines: toolPart.input,
              },
            })
          } catch (e) {
            console.error('failed to set highlight state:', e)
          }
        }
      }
      if (toolPart.type === 'tool-goToPage') {
        if (toolPart.output?.error) {
          console.error('goToPage error:', toolPart.output.error)
          return
        }

        const targetSlug = toolPart.output?.slug
        if (typeof targetSlug === 'string' && targetSlug !== location.pathname) {
          try {
            useWebsiteState.setState({
              currentSlug,
            })
            await docsRpcClient.setDocsState({
              state: {
                currentSlug,
              },
            })
          } catch (e) {
            console.error('failed to set highlight state:', e)
          }
        }
      }
    }

    // Use throttle instead of debounce to ensure the function executes at regular intervals
    // and doesn't delay beyond the throttle period, which could cause it to override
    // the output-available call that comes later
    const onToolInputStreaming = throttle(100, async (toolPart: ToolPartInputStreaming<WebsiteUIMessage>) => {
      if (toolPart.type === 'tool-strReplaceEditor') {
        const args: Partial<EditToolParamSchema> = toolPart.input as any
        if (args?.command === 'view') {
          return
        }
        if (!isStrReplaceParameterComplete(args)) {
          return
        }
        const currentSlug = generateSlugFromPath(args.path || '', githubFolder)

        if (isPostMessageBusy) return
        // Create a temporary FileSystemEmulator for preview
        let updatedPagesCopy = { ...filesInDraft }
        const previewFileSystem = new FileSystemEmulator({
          filesInDraft: updatedPagesCopy,
          baseDir: githubFolder || undefined,
          getPageContent,
        })
        const localExecute = createEditExecute({
          fileSystem: previewFileSystem,
        })
        await localExecute(args as any)
        isPostMessageBusy = true
        try {
          docsRpcClient
            .setDocsState({
              state: {
                filesInDraft: updatedPagesCopy,
                currentSlug,
                isMarkdownStreaming: true,
              },
            })
            .catch((e) => {
              console.error(e)
            })
            .finally(() => {
              isPostMessageBusy = false
            })
        } catch (e) { }
      }
    })

    try {
      for await (const newMessages of uiStreamToUIMessages<WebsiteUIMessage>({
        uiStream: generator,
        messages: messages as WebsiteUIMessage[],
        generateId,
        onToolOutput,
        onToolInputStreaming,
      })) {
        if (abortController.signal.aborted) {
          break
        }
        startTransition(() => {
          setMessages(newMessages)
        })
      }
      console.log('finished streaming message response, revalidating')
      // only revalidate on success. if we revalidate on error loader will return empty chat, because chat is still not saved
      await revalidator.revalidate()
    } finally {
      useWebsiteState.setState({ isChatGenerating: false })
    }
  }

  return (
    <ChatProvider generateMessages={submitMessages} initialValue={initialChatState} onError={notifyError}>
      <div
        style={
          {
            '--show-more-bg': 'var(--color-root-background)',
          } as CSSProperties
        }
        className='flex text-sm grow w-full max-w-[900px] flex-col gap-3 pr-2 pl-0 justify-center'
      >
        <Messages ref={ref} />
        <WelcomeMessage />
        <Footer />
      </div>
    </ChatProvider>
  )
}

function Messages({ ref }) {
  const { messages, stop } = useChatContext()

  const location = useLocation()
  useEffect(() => {
    return () => stop?.()
  }, [location.pathname])

  if (!messages.length) return null
  return (
    <div ref={ref} className='flex flex-col grow mt-6 gap-6'>
      {messages.map((message) => {
        return <MessageRenderer key={message.id} message={message as any} />
      })}
      <ChatErrorMessage />
      {/* {!messages.length && <ChatCards />} */}
    </div>
  )
}

function MessageRenderer({ message }: { message: WebsiteUIMessage }) {
  const { isGenerating: isChatGenerating, messages } = useChatContext()
  const hideBrowser = useShouldHideBrowser()
  const branchData = useRouteLoaderData(
    'routes/org.$orgId.branch.$branchId',
  ) as BranchRoute.ComponentProps['loaderData']
  const { siteId } = branchData

  const isLastMessage = messages[messages.length - 1]?.id === message.id
  if (message.role === 'user') {
    return (
      <ChatUserMessage className='my-4 text-[16px]' message={message}>
        {message.parts.map((part, index) => {

          if (part.type === 'text') {
            return <span key={index}>{part.text}</span>
          }

          // Display file attachments
          if (part.type === 'file') {
            const isImage = part.mediaType?.startsWith('image/')
            if (isImage) {
              return <img key={index} src={part.url} alt={part.filename} className='max-w-sm rounded-lg mt-2' />
            }
            return (
              <div key={index} className='flex items-center gap-2 mt-2 p-2 bg-muted rounded'>
                <span className='text-sm'>{part.filename}</span>
              </div>
            )
          }

          return null
        })}
      </ChatUserMessage>
    )
  }

  let minHeight = isLastMessage ? 'calc(-248px + 100dvh)' : '0px'


  return (
    <ChatForm disabled={messages[messages.length - 1]?.id !== message.id}>
      <ChatAssistantMessage style={{ minHeight }} message={message}>
        {message.parts.map((part, index) => {
          // console.log('part.toolCallId', part.toolCallId)
          if (part.type === 'tool-renderForm' && part.state === 'output-available') {
            return (
              <RenderFormPreview
                key={part.toolCallId}
                message={message}
                {...part}
                showSubmitButton={hideBrowser}
                uploadFunction={async (file) => {
                  const result = await uploadFileToSite(file, siteId)
                  return result.url
                }}
              />
            )
          }
          if (part.type === 'tool-deletePages') {
            const filePaths = part.input?.filePaths || []
            return (
              <ToolPreviewContainer key={part.toolCallId}>
                <Dot /> Deleting Pages:{' '}
                {filePaths.map((path) => (
                  <span key={path}>
                    <code>{path || ''},</code>
                  </span>
                ))}{' '}
              </ToolPreviewContainer>
            )
          }
          if (part.type === 'tool-updateHolocronJsonc' && part.state === 'output-available') {
            return (
              <RenderFormPreview
                message={message}
                key={part.toolCallId}
                {...part}
                showSubmitButton={hideBrowser}
                uploadFunction={async (file) => {
                  const result = await uploadFileToSite(file, siteId)
                  return result.url
                }}
              />
            )
          }
          if ((part.type === 'tool-todowrite' || part.type === 'tool-todoread') && part.state !== 'output-error') {
            return <TodoPreview key={part.toolCallId} part={part} message={message} index={index} />
          }
          if (part.type === 'tool-webSearchFirecrawl' && part.state === 'output-available') {
            return <WebSearchFirecrawlPreview key={part.toolCallId} part={part} />
          }
          if (part.type === 'tool-googleSearch' && part.state === 'output-available') {
            return <WebSearchGooglePreview key={part.toolCallId} part={part} />
          }
          return <MessagePartRenderer part={part as any} key={('toolCallId' in part && part.toolCallId) ? part.toolCallId : index} />
        })}
      </ChatAssistantMessage>
    </ChatForm>
  )
}

// Static autocomplete suggestions for first message
const AUTOCOMPLETE_SUGGESTIONS = [
  'change theme accent color to red',
  'update site logo with new design',
  'add a new doc page about getting started',
  'configure footer links with 2 columns of 2 links each',
  'create a faq section in the index page',
  'add a custom domain',
]
function ContextButton({
  contextOptions,
  textareaRef,
}: {
  contextOptions: string[]
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}) {
  const [open, setOpen] = useState(false)
  const { draftText, setDraftText } = useChatContext()
  const handleContextSelect = (selectedValue: string) => {
    if (!selectedValue) return

    const currentText = draftText || ''
    const newText = currentText + (currentText ? ' ' : '') + selectedValue
    setDraftText(newText)
    setOpen(false)
    // Focus the textarea if provided
    if (textareaRef?.current) {
      textareaRef.current.focus()
    }
  }

  if (!contextOptions.length) {
    return null
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
                {contextOptions.map((option: string) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => {
                      handleContextSelect(option)
                    }}
                    className='max-w-full my-[2px]'
                  >
                    <span className='truncate'>{option.startsWith('@') ? option.slice(1) : option}</span>
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
  const { isGenerating: isPending, draftText: text, stop, submit, messages } = useChatContext()
  const { chat, chatId, githubFolder, prUrl, projectPagesFilenames, branchId } =
    useLoaderData() as Route.ComponentProps['loaderData']
  const branchData = useRouteLoaderData(
    'routes/org.$orgId.branch.$branchId',
  ) as BranchRoute.ComponentProps['loaderData']
  const { siteId } = branchData

  const filesInDraft = useWebsiteState((x) => x?.filesInDraft || {})
  const lastPushedFiles = useWebsiteState((x) => x.lastPushedFiles)
  const hasNonPushedChanges = useMemo(() => {
    return doFilesInDraftNeedPush(filesInDraft, lastPushedFiles)
  }, [filesInDraft, lastPushedFiles])

  // Block navigation when there are unsaved changes
  useConfirmLeave({
    when: hasNonPushedChanges,
    message: 'You have unsaved changes. Are you sure you want to leave?'
  })

  useEffect(() => {
    const lastMessageId = messages[messages!.length - 1]?.id || ''
    const durableUrl = `/api/generateMessage?lastMessageId=${lastMessageId}`

    if (!lastMessageId) return
    durableFetchClient.isInProgress(durableUrl).then(({ inProgress }) => {
      if (inProgress) {
        submit()
      }
    })
  }, [])
  useEffect(() => {
    if (textareaRef?.current) {
      textareaRef.current.focus()
    }
  }, [chatId])

  const hasFilesInDraft = Object.keys(filesInDraft).length > 0

  const showCreatePR = hasFilesInDraft || prUrl
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  return (
    <div className='sticky bottom-0 pt-4 z-50 w-full'>
      <div className='space-y-3'>
        <div className='flex flex-col gap-2 '>
          <div className='flex gap-1 empty:hidden justify-start items-center bg-root-background p-1 rounded-md'>
            {showCreatePR && <DiffStats filesInDraft={filesInDraft} hasNonPushedChanges={hasNonPushedChanges} />}
            {prUrl && (
              <a
                href={prUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='text-xs text-accent-foreground underline'
              >
                view pr
              </a>
            )}

            <PrButton className='ml-auto' />
            <SaveChangesButton className='ml-auto' />
          </div>

          <div className='relative rounded-[20px] bg-popover'>
            <div className='flex'>
              <ContextButton
                textareaRef={textareaRef}
                contextOptions={projectPagesFilenames?.map((f) => `@${f}`) || []}
              />
            </div>
            <ChatTextarea
              ref={textareaRef}
              disabled={false}
              placeholder='Ask me anything...'
              className=''
              mentionOptions={projectPagesFilenames?.map((f) => `@${f}`) || []}
            />
            {/* Textarea buttons */}
            <div className='flex items-center justify-between gap-2 p-3'>
              {/* Left buttons */}
              <div className='grow'></div>
              {/*<div className='flex items-center gap-2'>
                                <ChatUploadButton
                                    onUpload={async (file) => {
                                        return await uploadFileToSite(
                                            file,
                                            siteId,
                                        )
                                    }}
                                    accept='image/*,text/*,.pdf,.docx,.doc'
                                    onFilesChange={(files) => {
                                        // Convert uploaded files to file parts for AI SDK
                                        const fileParts: FileUIPart[] =
                                            files.map((file) => ({
                                                type: 'file',
                                                filename: file.name,
                                                mediaType: file.contentType,
                                                url: file.url,
                                            }))
                                        useChatState.setState({
                                            attachedFiles: fileParts,
                                        })
                                    }}
                                />
                                <ChatRecordButton
                                    transcribeAudio={transcribeAudio}
                                />
                            </div>*/}
              {/* Right buttons */}
              <div className='flex items-center gap-2'>
                {isPending ? (
                  <Button className='rounded-full h-8' onClick={stop} variant='outline'>
                    Stop
                  </Button>
                ) : (
                  <Button
                    className='rounded-full h-8 w-8 p-0'
                    onClick={submit}
                    disabled={!text?.trim()}
                    size='icon'
                    variant={!text?.trim() ? 'outline' : 'default'}
                  >
                    <ArrowUpIcon className='size-4' />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <ChatAutocomplete autocompleteSuggestions={AUTOCOMPLETE_SUGGESTIONS} />
    </div>
  )
}
