'use client'
import dedent from 'string-dedent'

import { createIdGenerator, isToolUIPart, UIMessage } from 'ai'
import {
    ChatAssistantMessage,
    ChatErrorMessage,
    ChatUserMessage,
} from 'contesto/src/chat/chat-message'
import { ChatAutocomplete, ChatTextarea } from 'contesto/src/chat/chat-textarea'
import { MarkdownRuntime as Markdown } from 'docs-website/src/lib/markdown-runtime'
import {
    Fragment,
    startTransition,
    useEffect,
    useMemo,
    useState,
} from 'react'

import {
    Dot,
    EditorToolPreview,
    ErrorPreview,
    ToolPreviewContainer,
} from 'website/src/components/chat-tool-previews'

import { Button } from 'website/src/components/ui/button'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from 'website/src/components/ui/popover'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from 'website/src/components/ui/tooltip'
import { DiffStats, PrButton, SaveChangesButton } from './chat-buttons'
import { WelcomeMessage } from './chat-welcome'

import {
    ToolPartInputStreaming,
    ToolPartOutputAvailable,
    uiStreamToUIMessages,
} from 'contesto/src/lib/process-chat'
import { useShouldHideBrowser } from '../lib/hooks'
import {
    apiClient,
    apiClientWithDurableFetch,
    durableFetchClient,
} from '../lib/spiceflow-client'
import { doFilesInDraftNeedPush, useWebsiteState } from '../lib/state'

import { jsxDedent, RenderFormPreview } from 'contesto'
import {
    ChatProvider,
    ChatState,
    useChatContext,
} from 'contesto/src/chat/chat-provider'
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
    escapeMdxSyntax,
    generateSlugFromPath,
    throttle,
    truncateText,
} from 'docs-website/src/lib/utils'
import {
    FilePlus2Icon,
    ImageIcon,
    ListTreeIcon,
    PaletteIcon,
} from 'lucide-react'
import React from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import {
    useLoaderData,
    useParams,
    useRevalidator,
    useRouteLoaderData,
} from 'react-router'
import { AnimatePresence, motion } from 'unframer'
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
import {
    capitalize,
    cn,
    safeJsoncParse,
    spaceCase,
    transcribeAudio,
    uploadFileToSite,
} from '../lib/utils'
import { Route } from '../routes/+types/org.$orgId.site.$siteId.chat.$chatId'
import type { Route as SiteRoute } from '../routes/org.$orgId.site.$siteId'
import { TruncatedText } from './truncated-text'

function keyForDocsJson({ chatId }) {
    return `fumabase.jsonc-${chatId}`
}

const setDocsJsonState = ({
    values,
    githubFolder,
    previousJsonString,
    chatId,
}) => {
    console.log(`form values changed, sending state to docs iframe`)
    let githubPath = 'fumabase.jsonc'
    if (githubFolder) {
        githubPath = `${githubFolder}/fumabase.jsonc`
    }

    const newJson = JSON.stringify(
        {
            ...safeJsoncParse(previousJsonString),
            ...values,
        },
        null,
        2,
    )
    console.log(`updating fumabase.jsonc`, newJson)

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
    localStorage.setItem(keyForDocsJson({ chatId }), newJson)
    docsRpcClient.setDocsState({
        state: { filesInDraft: newChanges },
    })
}

function ChatForm({ children }: { children: React.ReactNode }) {
    const { chatId } = useParams()
    const formMethods = useForm({})
    const { submit, messages, setMessages, setDraftText } = useChatContext()

    const { siteBranch, githubFolder } =
        useLoaderData() as Route.ComponentProps['loaderData']
    const isOnboardingChat = useShouldHideBrowser()

    const previousJsonString = useMemo(() => {
        return JSON.stringify(siteBranch.docsJson, null, 2)
    }, [siteBranch?.docsJson])

    useEffect(() => {
        if (isOnboardingChat) return
        const persistedValues =
            typeof localStorage !== 'undefined'
                ? localStorage.getItem(keyForDocsJson({ chatId }))
                : undefined
        const docsJsonString =
            Object.entries(useWebsiteState.getState()?.filesInDraft || {}).find(
                ([key]) => key.endsWith('fumabase.jsonc'),
            )?.[1]?.content || ''
        const data = safeJsoncParse(persistedValues || docsJsonString) || null
        if (persistedValues) {
            console.log(`localStorage fumabase.jsonc: `, data)
        } else {
            console.log('fumabase.jsonc', data)
        }
        if (!data) return

        formMethods.reset(data, { keepDefaultValues: true })
        setDocsJsonState({
            values: data,
            githubFolder,
            previousJsonString,
            chatId,
        })
    }, [isOnboardingChat, chatId, previousJsonString])

    useEffect(() => {
        if (isOnboardingChat) return
        const unSub = formMethods.subscribe({
            formState: { values: true },
            callback: ({ values, defaultValues }) =>
                setDocsJsonState({
                    values: { ...defaultValues, ...values },
                    previousJsonString,
                    githubFolder,
                    chatId,
                }),
        })

        return unSub
    }, [isOnboardingChat, chatId, previousJsonString])

    return (
        <form
            className='flex flex-col grow'
            onSubmit={formMethods.handleSubmit(() => {
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

export default function Chat({
    ref,
}: {
    ref?: React.RefObject<HTMLDivElement>
}) {
    const loaderData = useLoaderData() as Route.ComponentProps['loaderData']
    const { chat, siteId, branchId } = loaderData

    const initialChatState = useMemo<Partial<ChatState>>(() => {
        const state = {
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
                    parts: [
                        ...textParts,
                        ...reasoningParts,
                        ...toolParts,
                        ...sourceUrlParts,
                        ...fileParts,
                    ]
                        .flat()
                        .sort((a, b) => a.index - b.index) as any,
                }
                return message
            }),
            isGenerating: false,
        }

        console.log('Using new initial chat state', state)
        return state
    }, [loaderData])

    const revalidator = useRevalidator()
    const submitMessages = async ({
        messages,
        setMessages,
        abortController,
    }: ChatState) => {
        const generateId = createIdGenerator()

        const filesInDraft = useWebsiteState.getState()?.filesInDraft || {}
        const currentSlug = useWebsiteState.getState()?.currentSlug || ''
        const { githubFolder } = loaderData

        const { data: generator, error } =
            await apiClientWithDurableFetch.api.generateMessage.post(
                {
                    messages: messages as WebsiteUIMessage[],
                    siteId,
                    branchId,
                    currentSlug,
                    filesInDraft,
                    chatId: chat.chatId,
                },
                {
                    query: {
                        lastMessageId: messages[messages.length - 1]?.id,
                    },
                    fetch: { signal: abortController.signal },
                },
            )
        if (error) throw error
        console.log(generator)
        async function getPageContent(githubPath: string) {
            const { data, error } = await apiClient.api.getPageContent.post({
                branchId,
                githubPath: githubPath,
            })
            if (error) return ''
            return data?.content
        }
        // Create global FileSystemEmulator for tool execution
        const globalFileSystem = new FileSystemEmulator({
            filesInDraft,
            getPageContent,
            onFilesDraftChange: async () => {
                // Update the global state whenever files change
                // useWebsiteState.setState({
                //     filesInDraft: filesInDraft,
                // })
            },
        })
        const execute = createEditExecute({
            fileSystem: globalFileSystem,
        })

        let isPostMessageBusy = false

        const onToolOutput = async (
            toolPart: ToolPartOutputAvailable<WebsiteUIMessage>,
        ) => {
            const args: Partial<EditToolParamSchema> = toolPart.input as any

            if (toolPart.type === 'tool-strReplaceEditor') {
                if (args?.command === 'view') {
                    return
                }

                const currentSlug = generateSlugFromPath(
                    args.path || '',
                    githubFolder,
                )

                await execute(args as any)
                console.log(
                    `applying the setState update to the docs site`,
                    toolPart,
                )

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
        }

        // Use throttle instead of debounce to ensure the function executes at regular intervals
        // and doesn't delay beyond the throttle period, which could cause it to override
        // the output-available call that comes later
        const onToolInputStreaming = throttle(
            100,
            async (toolPart: ToolPartInputStreaming<WebsiteUIMessage>) => {
                if (toolPart.type === 'tool-strReplaceEditor') {
                    const args: Partial<EditToolParamSchema> =
                        toolPart.input as any
                    if (args?.command === 'view') {
                        return
                    }
                    if (!isStrReplaceParameterComplete(args)) {
                        return
                    }
                    const currentSlug = generateSlugFromPath(
                        args.path || '',
                        githubFolder,
                    )

                    if (isPostMessageBusy) return
                    // Create a temporary FileSystemEmulator for preview
                    let updatedPagesCopy = { ...filesInDraft }
                    const previewFileSystem = new FileSystemEmulator({
                        filesInDraft: updatedPagesCopy,
                        getPageContent,
                        // No onFilesDraftChange callback for preview
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
                    } catch (e) {}
                }
            },
        )

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
            console.log(newMessages.at(-1))
            startTransition(() => {
                setMessages(newMessages)
            })
        }
        console.log('finished streaming message response, revalidating')
        await revalidator.revalidate()
    }

    return (
        <ChatProvider
            generateMessages={submitMessages}
            initialValue={initialChatState}
        >
            <div className='flex grow w-full max-w-[900px] flex-col gap-3 pr-2 pl-0 justify-center'>
                <Messages ref={ref} />
                <WelcomeMessage />
                <Footer />
            </div>
        </ChatProvider>
    )
}



function Messages({ ref }) {
    const { messages } = useChatContext()

    if (!messages.length) return null
    return (
        <div ref={ref} className='flex flex-col grow mt-6 gap-6'>
            {messages.map((message) => {
                return (
                    <MessageRenderer
                        key={message.id}
                        message={message as any}
                    />
                )
            })}
            <ChatErrorMessage />
            {/* {!messages.length && <ChatCards />} */}
        </div>
    )
}

function MessageRenderer({ message }: { message: WebsiteUIMessage }) {
    const { isGenerating: isChatGenerating, messages } = useChatContext()
    const hideBrowser = useShouldHideBrowser()

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
        <ChatForm>
            <ChatAssistantMessage
                style={{ minHeight }}
                className=' whitespace-pre-wrap'
                message={message}
            >
                {message.parts.map((part, index) => {
                    if (part.type === 'text') {
                        return (
                            <div
                                key={index}
                                className='flex flex-row tracking-wide gap-1'
                            >
                                {/*<Dot />*/}
                                <Markdown
                                    isStreaming={isChatGenerating}
                                    key={index}
                                    className=''
                                    markdown={part.text}
                                />
                            </div>
                        )
                    }

                    if (part.type === 'reasoning') {
                        if (!part.text) return null
                        return (
                            <div
                                key={index}
                                className='flex flex-row opacity-80 tracking-wide gap-[1ch]'
                            >
                                <Dot />
                                <TruncatedText isStreaming={isChatGenerating}>
                                    <Markdown
                                        isStreaming={isChatGenerating}
                                        key={index}
                                        className='prose-sm'
                                        markdown={part.text}
                                    />
                                </TruncatedText>
                            </div>
                        )
                    }
                    if (part && 'errorText' in part && part.errorText) {
                        return (
                            <Fragment key={index}>
                                <Dot /> {part.type}
                                <ErrorPreview error={part.errorText} />
                            </Fragment>
                        )
                    }
                    if (part.type === 'tool-strReplaceEditor') {
                        return <EditorToolPreview key={index} {...part} />
                    }
                    if (part.type === 'tool-getProjectFiles') {
                        const code = part.output || '\n'

                        if (!code) return null

                        return (
                            <ToolPreviewContainer>
                                <Dot toolCallId={part.toolCallId} /> Getting
                                file structure
                                <br />
                                <Markdown
                                    isStreaming={isChatGenerating}
                                    className='pt-[1em] block'
                                    markdown={`<ShowMore>\n\`\`\`sh lineNumbers=true\n${code}\n\`\`\`\n</ShowMore>`}
                                />
                            </ToolPreviewContainer>
                        )
                    }
                    if (
                        part.type === 'tool-renderForm' &&
                        part.state === 'output-available'
                    ) {
                        return (
                            <RenderFormPreview
                                key={index}
                                message={message}
                                {...part}
                                showSubmitButton={hideBrowser}
                            />
                        )
                    }
                    if (part.type === 'tool-updateFumabaseJsonc') {
                        return (
                            <RenderFormPreview
                                message={message}
                                key={index}
                                {...part}
                                showSubmitButton={hideBrowser}
                            />
                        )
                    }
                    if (part.type === 'tool-deletePages') {
                        const filePaths = part.input?.filePaths || []
                        return (
                            <ToolPreviewContainer key={index}>
                                <Dot /> Deleting Pages:{' '}
                                {filePaths.map((path) => (
                                    <span key={path}>
                                        <code>{path || ''},</code>
                                    </span>
                                ))}{' '}
                            </ToolPreviewContainer>
                        )
                    }
                    if (part.type === 'tool-selectText') {
                        if (!part.input) return null
                        return (
                            <ToolPreviewContainer key={index}>
                                <Dot /> Selecting lines ${part.input?.slug}:$
                                {part.input?.startLine || 0}-$
                                {part.input?.endLine || ''}
                            </ToolPreviewContainer>
                        )
                    }
                    // if (
                    //     part.type.startsWith('tool-') &&
                    //     process.env.NODE_ENV === 'development'
                    // ) {
                    //     return (
                    //         <pre key={index}>
                    //             {JSON.stringify(part, null, 2)}
                    //         </pre>
                    //     )
                    // }

                    if (
                        isToolUIPart(part) &&
                        part.state !== 'input-streaming'
                    ) {
                        const toolName = part.type.replace('tool-', '')
                        const callArg = truncateText(stringifyArgs(part.input))
                        let error = part.errorText
                        return (
                            <ToolPreviewContainer key={index}>
                                <Dot /> {capitalize(spaceCase(toolName))}(
                                {callArg})
                                {error && <ErrorPreview error={error} />}
                            </ToolPreviewContainer>
                        )
                    }
                })}
            </ChatAssistantMessage>
        </ChatForm>
    )
}

function stringifyArgs(obj: any): string {
    if (!obj || typeof obj !== 'object') return JSON.stringify(obj)
    return Object.entries(obj)
        .map(([key, value]) => {
            let strValue = JSON.stringify(value)
            if (typeof strValue === 'string' && strValue.length > 300) {
                strValue = strValue.slice(0, 300) + '...'
            }
            return `${key}=${strValue}`
        })
        .join(', ')
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
                        <CommandInput
                            placeholder='Search context...'
                            className='h-9'
                        />
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
                                        <span className='truncate'>
                                            {option.startsWith('@')
                                                ? option.slice(1)
                                                : option}
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
    const { isGenerating: isPending, draftText: text } = useChatContext()

    const { chat, chatId, githubFolder, prUrl, mentionOptions, branchId } =
        useLoaderData() as Route.ComponentProps['loaderData']
    const siteData = useRouteLoaderData(
        'routes/org.$orgId.site.$siteId',
    ) as SiteRoute.ComponentProps['loaderData']
    const { siteId } = siteData

    const filesInDraft = useWebsiteState((x) => x?.filesInDraft || {})
    const lastPushedFiles = useWebsiteState((x) => x.lastPushedFiles)
    const hasNonPushedChanges = useMemo(() => {
        return doFilesInDraftNeedPush(filesInDraft, lastPushedFiles)
    }, [filesInDraft, lastPushedFiles])
    const { stop, submit, messages } = useChatContext()
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
        <AnimatePresence mode='popLayout'>
            <motion.div
                layoutId='textarea'
                className='sticky bottom-0 pt-4 z-50 w-full'
            >
                <div className='space-y-3'>
                    <div className='flex flex-col gap-2 '>
                        <div className='flex gap-1 empty:hidden justify-start items-center bg-black p-1 rounded-md'>
                            {showCreatePR && (
                                <DiffStats
                                    filesInDraft={filesInDraft}
                                    hasNonPushedChanges={hasNonPushedChanges}
                                />
                            )}
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
                                    contextOptions={mentionOptions || []}
                                />
                            </div>
                            <ChatTextarea
                                ref={textareaRef}
                                disabled={false}
                                placeholder='Ask me anything...'
                                className=''
                                mentionOptions={mentionOptions || []}
                            />
                            {/* Textarea buttons */}
                            <div className='flex items-center justify-between gap-2 p-3'>
                                {/* Left buttons */}
                                <div className='flex items-center gap-2'>
                                    <ChatUploadButton
                                        onUpload={async (file) => {
                                            return await uploadFileToSite(file, siteId)
                                        }}
                                        accept='image/*,text/*,.pdf,.docx,.doc'
                                        onFilesChange={(files) => {
                                            // TODO: Wire uploaded files to messages
                                            console.log(
                                                'Files uploaded:',
                                                files,
                                            )
                                        }}
                                    />
                                    <ChatRecordButton
                                        transcribeAudio={transcribeAudio}
                                    />
                                </div>
                                {/* Right buttons */}
                                <div className='flex items-center gap-2'>
                                    {isPending ? (
                                        <Button
                                            className='rounded-full h-8'
                                            onClick={stop}
                                            variant='outline'
                                        >
                                            Stop
                                        </Button>
                                    ) : (
                                        <Button
                                            className='rounded-full h-8'
                                            onClick={submit}
                                            disabled={!text?.trim()}
                                        >
                                            Generate
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <ChatAutocomplete
                    autocompleteSuggestions={AUTOCOMPLETE_SUGGESTIONS}
                />
            </motion.div>
        </AnimatePresence>
    )
}
