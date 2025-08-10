'use client'
import dedent from 'string-dedent'

import { createIdGenerator, isToolUIPart, UIMessage } from 'ai'
import {
    ChatAssistantMessage,
    ChatErrorMessage,
    ChatUserMessage,
} from 'contesto/src/chat/chat-message'
import { ChatAutocomplete, ChatTextarea } from 'contesto/src/chat/chat-textarea'

import {
    CSSProperties,
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
} from 'docs-website/src/components/chat-tool-previews'

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
    capitalize,
    escapeMdxSyntax,
    generateSlugFromPath,
    spaceCase,
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
    cn,
    safeJsoncParse,
    transcribeAudio,
    uploadFileToSite,
} from '../lib/utils'
import { Route } from '../routes/+types/org.$orgId.site.$siteId.chat.$chatId._index'
import type { Route as SiteRoute } from '../routes/org.$orgId.site.$siteId'
import { TruncatedText } from './truncated-text'
import { MessagePartRenderer } from 'docs-website/src/components/docs-chat'
import { useSearchParams } from 'react-router'
import { keyForDocsJsonFormLocalStorage } from '../lib/constants'

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
    localStorage.setItem(keyForDocsJsonFormLocalStorage({ chatId }), newJson)
    docsRpcClient.setDocsState({
        // revalidate: true, // TODO
        state: { filesInDraft: newChanges },
    })
}

function getCurrentDocsJson({ chatId, siteBranch }) {
    // First check localStorage
    const persistedValues =
        typeof localStorage !== 'undefined'
            ? localStorage.getItem(keyForDocsJsonFormLocalStorage({ chatId }))
            : undefined

    // Then check filesInDraft
    const docsJsonString =
        Object.entries(useWebsiteState.getState()?.filesInDraft || {}).find(
            ([key]) => key.endsWith('fumabase.jsonc'),
        )?.[1]?.content || ''

    // Use persisted > filesInDraft > siteBranch.docsJson
    if (persistedValues) {
        return safeJsoncParse(persistedValues) || {}
    }
    if (docsJsonString) {
        return safeJsoncParse(docsJsonString) || {}
    }

    // Fall back to siteBranch.docsJson
    const docsJson = siteBranch?.docsJson
    if (!docsJson || typeof docsJson !== 'object' || Array.isArray(docsJson)) {
        return {}
    }
    return docsJson as Record<string, any>
}

function ChatForm({ children }: { children: React.ReactNode }) {
    const { chatId } = useParams()
    const { siteBranch, githubFolder } =
        useLoaderData() as Route.ComponentProps['loaderData']

    const formMethods = useForm({
        // https://chatgpt.com/share/689903d5-2624-800e-870c-a1e226fd230d
        // do not pass defaultValues here otherwise setValue calls will not trigger subscribe callback if value does not change. meaning the state is not updated for filesInDraft for fumabase.jsonc
        // reset() call instead will trigger subscribe callback so we can use it in useEffect instead
    })
    const { submit, messages, setMessages, setDraftText } = useChatContext()

    const isOnboardingChat = useShouldHideBrowser()

    const previousJsonString = useMemo(() => {
        return JSON.stringify(siteBranch.docsJson, null, 2)
    }, [siteBranch?.docsJson])

    useEffect(() => {
        if (isOnboardingChat) return
        const unSub = formMethods.subscribe({
            formState: { values: true },
            callback: () =>
                setDocsJsonState({
                    values: formMethods.getValues(),
                    previousJsonString,
                    githubFolder,
                    chatId,
                }),
        })

        return unSub
    }, [formMethods.subscribe, isOnboardingChat, chatId, previousJsonString])

    useEffect(() => {
        if (isOnboardingChat) return

        const data = getCurrentDocsJson({ chatId, siteBranch })
        console.log('fumabase.jsonc', data)

        if (!data || Object.keys(data).length === 0) return

        formMethods.reset(data, { keepDefaultValues: true })
        setDocsJsonState({
            values: data,
            githubFolder,
            previousJsonString,
            chatId,
        })
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
    const revalidator = useRevalidator()

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
                    parts: [
                        ...textParts,
                        ...reasoningParts,
                        ...toolParts,
                        ...sourceUrlParts,
                        ...fileParts,
                    ]
                        .flat()
                        .sort((a, b) => a.index - b.index)
                        // add step start messages. required for claude
                        .flatMap((part, index) => {
                            if (msg.role !== 'assistant') return [part]
                            if (index === 0)
                                return [{ type: 'step-start' }, part]
                            if (
                                part.type === 'text' ||
                                isToolUIPart(part as any)
                            ) {
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

        console.log('Using new initial chat state', state)
        return state
    }, [loaderData, searchParams])

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
            getPageContent,
            onFilesDraftChange: async () => {},
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

        try {
            for await (const newMessages of uiStreamToUIMessages<WebsiteUIMessage>(
                {
                    uiStream: generator,
                    messages: messages as WebsiteUIMessage[],
                    generateId,
                    onToolOutput,
                    onToolInputStreaming,
                },
            )) {
                if (abortController.signal.aborted) {
                    break
                }
                startTransition(() => {
                    setMessages(newMessages)
                })
            }
        } finally {
            console.log('finished streaming message response, revalidating')
            await revalidator.revalidate()
        }
    }

    return (
        <ChatProvider
            generateMessages={submitMessages}
            initialValue={initialChatState}
        >
            <div
                style={
                    {
                        '--show-more-bg': '#000',
                    } as CSSProperties
                }
                className='flex grow w-full max-w-[900px] flex-col gap-3 pr-2 pl-0 justify-center'
            >
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
    const siteData = useRouteLoaderData(
        'routes/org.$orgId.site.$siteId',
    ) as SiteRoute.ComponentProps['loaderData']
    const { siteId } = siteData

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
            <ChatAssistantMessage style={{ minHeight }} message={message}>
                {message.parts.map((part, index) => {
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
                                uploadFunction={async (file) => {
                                    const result = await uploadFileToSite(
                                        file,
                                        siteId,
                                    )
                                    return result.url
                                }}
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
                    if (
                        part.type === 'tool-updateFumabaseJsonc' &&
                        part.state === 'output-available'
                    ) {
                        return (
                            <RenderFormPreview
                                message={message}
                                key={index}
                                {...part}
                                showSubmitButton={hideBrowser}
                                uploadFunction={async (file) => {
                                    const result = await uploadFileToSite(
                                        file,
                                        siteId,
                                    )
                                    return result.url
                                }}
                            />
                        )
                    }
                    return (
                        <MessagePartRenderer part={part as any} key={index} />
                    )
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
    const [searchParams] = useSearchParams()

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
                                        return await uploadFileToSite(
                                            file,
                                            siteId,
                                        )
                                    }}
                                    accept='image/*,text/*,.pdf,.docx,.doc'
                                    onFilesChange={(files) => {
                                        // TODO: Wire uploaded files to messages
                                        console.log('Files uploaded:', files)
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
    )
}
