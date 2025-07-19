'use client'

import { createIdGenerator, UIMessage } from 'ai'
import {
    ChatAssistantMessage,
    ChatErrorMessage,
    ChatUserMessage,
} from 'contesto/src/chat/chat-message'
import { ChatAutocomplete, ChatTextarea } from 'contesto/src/chat/chat-textarea'
import { MarkdownRuntime as Markdown } from 'docs-website/src/lib/markdown-runtime'
import memoize from 'micro-memoize'
import {
    memo,
    startTransition,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import { FormProvider, useForm } from 'react-hook-form'

import {
    EditorToolPreview,
    FilesTreePreview,
    ToolPreviewContainer,
} from 'website/src/components/tools-preview'

import { Button } from 'website/src/components/ui/button'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from 'website/src/components/ui/popover'
import { ScrollArea } from 'website/src/components/ui/scroll-area'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from 'website/src/components/ui/tooltip'

import { useStickToBottom } from 'use-stick-to-bottom'

import { uiStreamToUIMessages } from 'contesto/src/lib/process-chat'
import { shouldHideBrowser, useTemporaryState } from '../lib/hooks'
import {
    apiClient,
    apiClientWithDurableFetch,
    durableFetchClient,
} from '../lib/spiceflow-client'
import {
    doFilesInDraftNeedPush,
    State,
    useWebsiteState,
    WebsiteStateProvider,
} from '../lib/state'

import {
    ChatProvider,
    ChatState,
    useChatContext,
} from 'contesto/src/chat/chat-provider'
import { ChatRecordButton } from 'contesto/src/chat/chat-record-button'
import { ChatSuggestionButton } from 'contesto/src/chat/chat-suggestion'
import { ChatUploadButton } from 'contesto/src/chat/chat-upload-button'
import { teeAsyncIterable } from 'contesto/src/lib/utils'
import { FilesInDraft } from 'docs-website/src/lib/docs-state'
import { generateSlugFromPath } from 'docs-website/src/lib/utils'
import {
    AlertCircle,
    FilePlus2Icon,
    GitBranch,
    ImageIcon,
    ListTreeIcon,
    PaletteIcon,
    Save,
    X,
} from 'lucide-react'
import React from 'react'
import {
    href,
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
import {
    calculateLineChanges,
    createEditExecute,
    EditToolParamSchema,
    FileUpdate,
    isParameterComplete,
} from '../lib/edit-tool'
import { WebsiteUIMessage } from '../lib/types'
import { safeJsoncParse, slugKebabCaseKeepExtension } from '../lib/utils'
import { Route } from '../routes/+types/org.$orgId.site.$siteId.chat.$chatId'
import type { Route as SiteRoute } from '../routes/org.$orgId.site.$siteId'
import type { Route as ChatRoute } from '../routes/org.$orgId.site.$siteId.chat.$chatId'
import { RenderFormPreview } from './render-form-preview'

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

    const newChanges: FilesInDraft = {
        [githubPath]: {
            content: newJson,
            githubPath,
        },
    }
    const newFilesInDraft: FilesInDraft = {
        ...useWebsiteState.getState().filesInDraft,
        ...newChanges,
    }
    useWebsiteState.setState({ filesInDraft: newFilesInDraft })
    localStorage.setItem(keyForDocsJson({ chatId }), newJson)
    docsRpcClient.setDocsState({
        state: { filesInDraft: newChanges },
    })
}

export default function Chat({ ref }) {
    const loaderData = useLoaderData() as Route.ComponentProps['loaderData']
    const { chat, siteId, branchId } = loaderData
    const { chatId } = useParams()

    const formMethods = useForm({
        // values: initialDocsJsonData,
    })

    const { siteBranch, githubFolder } =
        useLoaderData() as Route.ComponentProps['loaderData']
    const previousJsonString = useMemo(() => {
        return JSON.stringify(siteBranch.docsJson, null, 2)
    }, [siteBranch?.docsJson])

    useEffect(() => {
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

        // setValue('root', data, {
        //     shouldDirty: true,
        //     shouldTouch: true,
        // })
    }, [chatId, previousJsonString])

    useEffect(() => {
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
    }, [chatId, previousJsonString])

    const initialChatState = useMemo<Partial<ChatState>>(
        () => ({
            messages: chat.messages.map((msg) => {
                const message: UIMessage = {
                    ...msg,
                    parts: [
                        ...(msg.textParts || []),
                        ...(msg.reasoningParts || []),
                        ...(msg.toolParts || []),
                        ...(msg.sourceUrlParts || []),
                        ...(msg.fileParts || []),
                    ]
                        .flat()
                        .sort((a, b) => a.index - b.index) as any,
                }
                return message
            }),
            isGenerating: false,
        }),
        [loaderData],
    )

    const revalidator = useRevalidator()
    const submitMessages = async ({
        messages,
        setMessages,
        abortController,
    }: ChatState) => {
        const generateId = createIdGenerator()

        const filesInDraft = useWebsiteState.getState()?.filesInDraft || {}
        const currentSlug = useWebsiteState.getState()?.currentSlug || ''

        try {
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
            async function getPageContent(x) {
                const { data, error } = await apiClient.api.getPageContent.post(
                    {
                        branchId,
                        githubPath: x.githubPath,
                    },
                )
                if (error) return ''
                return data?.content
            }
            const execute = createEditExecute({
                filesInDraft: filesInDraft,
                getPageContent,
            })
            // Split the async iterator into two: one for docs edit, one for state updates
            const [editIter, stateIter] = teeAsyncIterable(
                uiStreamToUIMessages<WebsiteUIMessage>({
                    uiStream: generator,
                    messages: messages as WebsiteUIMessage[],
                    generateId,
                }),
            )

            // First iteration: handle docs/edit-tool logic
            let isPostMessageBusy = false
            const processedToolCallIds = new Set<string>()

            async function updateDocsSite() {
                for await (const newMessages of editIter) {
                    try {
                        const lastMessage = newMessages[newMessages.length - 1]

                        if (lastMessage.role === 'assistant') {
                            // Process all tool parts that have output available and haven't been processed yet
                            for (const part of lastMessage.parts) {
                                if (
                                    part?.type === 'tool-strReplaceEditor' &&
                                    part.state === 'output-available' &&
                                    part.toolCallId &&
                                    !processedToolCallIds.has(part.toolCallId)
                                ) {
                                    processedToolCallIds.add(part.toolCallId)

                                    const args: Partial<EditToolParamSchema> =
                                        part.input as any
                                    if (args?.command === 'view') {
                                        continue
                                    }

                                    const currentSlug = generateSlugFromPath(
                                        args.path || '',
                                        githubFolder,
                                    )

                                    await execute(args as any)
                                    console.log(
                                        `applying the setState update to the docs site`,
                                        part,
                                    )

                                    let revalidate = args.command === 'create'

                                    try {
                                        await docsRpcClient.setDocsState({
                                            state: {
                                                filesInDraft: filesInDraft,
                                                isMarkdownStreaming: false,
                                                currentSlug,
                                            },
                                            revalidate,
                                            idempotenceKey: part.toolCallId,
                                        })
                                    } catch (e) {
                                        console.error('failed setDocsState', e)
                                    }
                                    useWebsiteState.setState({
                                        filesInDraft: { ...filesInDraft },
                                        currentSlug,
                                    })
                                }
                            }

                            // Handle streaming/preview state for the last tool part
                            const lastPart =
                                lastMessage.parts[lastMessage.parts.length - 1]
                            if (
                                lastPart?.type === 'tool-strReplaceEditor' &&
                                (lastPart.state === 'input-streaming' ||
                                    lastPart.state === 'input-available')
                            ) {
                                const args: Partial<EditToolParamSchema> =
                                    lastPart.input as any
                                if (args?.command === 'view') {
                                    continue
                                }
                                if (!isParameterComplete(args)) {
                                    continue
                                }
                                const currentSlug = generateSlugFromPath(
                                    args.path || '',
                                    githubFolder,
                                )

                                if (isPostMessageBusy) continue
                                let updatedPagesCopy = { ...filesInDraft }
                                const execute = createEditExecute({
                                    filesInDraft: updatedPagesCopy,
                                    getPageContent,
                                })
                                await execute(args as any)
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
                        }
                    } catch (e) {
                        console.error(e)
                    }
                }
            }
            updateDocsSite()

            for await (const newMessages of stateIter) {
                if (abortController.signal.aborted) {
                    break
                }
                startTransition(() => {
                    setMessages(newMessages)
                })
            }
        } finally {
        }

        await revalidator.revalidate()
    }

    return (
        <ChatProvider
            generateMessages={submitMessages}
            initialValue={initialChatState}
        >
            <form onSubmit={formMethods.handleSubmit(() => {})}>
                <FormProvider {...formMethods}>
                    <div className='flex grow min-h-0 flex-col gap-3 px-6 h-full justify-center'>
                        <Messages ref={ref} />
                        <WelcomeMessage />
                        <Footer />
                    </div>
                </FormProvider>
            </form>
        </ChatProvider>
    )
}

function WelcomeMessage() {
    const { messages } = useChatContext()
    if (messages.length) return null
    return (
        <ChatAssistantMessage
            className='-mt-[160px]'
            message={{
                role: 'assistant',
                id: '',
                parts: [],
            }}
        >
            <Markdown
                markdown='Hi, I am fumabase, I can help you with customizing your docs website or add new content. Here are some example things you can do:'
                className='prose-sm'
            />
            <div className='grid -mx-2 grid-cols-2 gap-3 mt-3'>
                <ChatSuggestionButton
                    icon={<PaletteIcon />}
                    userMessage='Change primary color'
                >
                    Change primary color
                </ChatSuggestionButton>
                <ChatSuggestionButton
                    icon={<ImageIcon />}
                    userMessage='Update site logo'
                >
                    Update site logo
                </ChatSuggestionButton>
                <ChatSuggestionButton
                    icon={<FilePlus2Icon />}
                    userMessage='Add a new doc page'
                >
                    Add a new doc page
                </ChatSuggestionButton>
                <ChatSuggestionButton
                    icon={<ListTreeIcon />}
                    userMessage='Edit navbar links'
                >
                    Edit navbar link
                </ChatSuggestionButton>
            </div>
        </ChatAssistantMessage>
    )
}

function Messages({ ref }) {
    const { messages } = useChatContext()

    if (!messages.length) return null
    return (
        <div
            ref={ref}
            className='relative text-sm h-full flex flex-col grow mt-6 gap-6'
        >
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
    const { isGenerating: isChatGenerating } = useChatContext()

    if (message.role === 'user') {
        return (
            <ChatUserMessage message={message}>
                {message.parts.map((part, index) => {
                    if (part.type === 'text') {
                        return (
                            <Markdown
                                key={index}
                                className='[&_p]:m-0 prose-sm'
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
        <ChatAssistantMessage className='' message={message}>
            {message.parts.map((part, index) => {
                if (part.type === 'text') {
                    return (
                        <Markdown
                            isStreaming={isChatGenerating}
                            key={index}
                            className='prose-sm '
                            markdown={part.text}
                        />
                    )
                }

                if (part.type === 'reasoning') {
                    return (
                        <Markdown
                            key={index}
                            className='prose-sm'
                            isStreaming={isChatGenerating}
                            markdown={'thinking:' + part.text}
                        />
                    )
                }
                if (part && 'errorText' in part && part.errorText) {
                    return (
                        <Markdown
                            key={index}
                            className='prose-sm text-red-600'
                            isStreaming={isChatGenerating}
                            markdown={`[${part.type}] ${part.errorText}`}
                        />
                    )
                }
                if (part.type === 'tool-strReplaceEditor') {
                    return <EditorToolPreview key={index} {...part} />
                }
                if (part.type === 'tool-getProjectFiles') {
                    return <FilesTreePreview key={index} {...part} />
                }
                if (part.type === 'tool-renderForm') {
                    return <RenderFormPreview key={index} {...part} />
                }
                if (part.type === 'tool-deletePages') {
                    const filePaths = part.input?.filePaths || []
                    return (
                        <ToolPreviewContainer key={index} {...part}>
                            <Markdown
                                markdown={`**🗑️ Deleting Pages:**\n\n${filePaths.map((path) => `- \`${path || ''}\``).join('\n')}`}
                                isStreaming={isChatGenerating}
                                className='prose-sm'
                            />
                        </ToolPreviewContainer>
                    )
                }
                if (
                    part.type.startsWith('tool-') &&
                    process.env.NODE_ENV === 'development'
                ) {
                    return (
                        <pre key={index}>{JSON.stringify(part, null, 2)}</pre>
                    )
                }

                if (part.type.startsWith('tool-')) {
                    return (
                        <ToolPreviewContainer key={index} {...part}>
                            <Markdown
                                markdown={`🔨 calling ${spaceCase(part.type.replace('tool-', ''))}`}
                                isStreaming={isChatGenerating}
                                className='prose-sm'
                            />
                        </ToolPreviewContainer>
                    )
                }
            })}
        </ChatAssistantMessage>
    )
}

function spaceCase(str: string): string {
    return str
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
        .replace(/^./, (m) => m.toUpperCase())
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

    const { chat, githubFolder, prUrl, mentionOptions, branchId } =
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
    const transcribeAudio = async (audioFile: File): Promise<string> => {
        try {
            const formData = new FormData()
            formData.append('audio', audioFile)

            const response = await fetch('/api/transcribeAudio', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                throw new Error('Transcription failed')
            }

            const { text } = await response.json()
            return text || ''
        } catch (error) {
            console.error('Transcription error:', error)
            return ''
        }
    }

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
                            <div className='justify-end flex grow'>
                                <PrButton />
                                <SaveChangesButton />
                            </div>
                        </div>

                        <div className='relative rounded-[20px] border bg-popover'>
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
                                            const idGenerator =
                                                createIdGenerator()
                                            const filename = encodeURIComponent(
                                                slugKebabCaseKeepExtension(
                                                    `${idGenerator()}-${file.name || 'file'}`,
                                                ),
                                            )
                                            const contentType =
                                                file.type ||
                                                'application/octet-stream'
                                            const { error, data } =
                                                await apiClient.api.createUploadSignedUrl.post(
                                                    {
                                                        siteId,
                                                        files: [
                                                            {
                                                                slug: filename,
                                                                contentType,
                                                                contentLength:
                                                                    file.size,
                                                            },
                                                        ],
                                                    },
                                                )
                                            if (error) throw error

                                            const [result] = data.files

                                            const uploadResp = await fetch(
                                                result.signedUrl,
                                                {
                                                    method: 'PUT',
                                                    headers: {
                                                        'Content-Type':
                                                            contentType,
                                                    },
                                                    body: file,
                                                },
                                            )

                                            if (!uploadResp.ok) {
                                                throw new Error(
                                                    'Failed to upload file to storage.',
                                                )
                                            }

                                            return {
                                                name: result.path,
                                                contentType,
                                                url: result.finalUrl,
                                            }
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

function PrButton({}) {
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [buttonText, setButtonText] = useTemporaryState('', 2000)
    const { messages, isGenerating: isChatGenerating } = useChatContext()

    const { chatId, chat, branchId } =
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

    const revalidator = useRevalidator()

    // Only show if site has GitHub installation AND repository configured
    if (!siteData.site.githubInstallations?.length) return null
    if (!siteData.site.githubOwner || !siteData.site.githubRepo) return null

    const isButtonDisabled: boolean = (() => {
        if (isLoading) {
            return true
        }
        if (isChatGenerating) {
            return true
        }
        if (errorMessage) {
            return true
        }

        // if (!hasNonPushedChanges) {
        //     return true
        // }
        return false
    })()

    const getTooltipMessage = (): string | null => {
        if (!hasNonPushedChanges) {
            return 'No unsaved changes to create PR'
        }
        if (isChatGenerating) {
            return 'Wait for chat to finish generating'
        }
        if (isLoading) {
            return 'Creating PR...'
        }
        if (errorMessage) {
            return 'Fix error before creating PR'
        }
        return null
    }

    const displayButtonText: string = (() => {
        if (buttonText) {
            return buttonText
        }
        if (isLoading) {
            return 'loading...'
        }
        if (chat.prNumber) {
            return `Push to PR #${chat.prNumber}`
        }
        return 'Create Github PR'
    })()

    const handleCreatePr = async () => {
        setIsLoading(true)
        try {
            const filesInDraft = useWebsiteState.getState()?.filesInDraft || {}

            const result = await apiClient.api.createPrSuggestionForChat.post({
                branchId,
                filesInDraft,
                chatId,
            })
            if (result.error) throw result.error

            await revalidator.revalidate()
            setButtonText('PR submitted')
        } catch (error) {
            console.error('Failed to create PR:', error)
            const message =
                error instanceof Error ? error.message : 'Failed to create PR'
            setErrorMessage(message)
        } finally {
            setIsLoading(false)
        }
    }
    if (!messages?.length) return null

    return (
        <div className='flex items-center gap-2'>
            <Popover
                onOpenChange={(x) => {
                    if (!x) setErrorMessage('')
                }}
                open={!!errorMessage}
            >
                <PopoverTrigger asChild>
                    <div className=''>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant='default'
                                    onClick={handleCreatePr}
                                    disabled={isButtonDisabled}
                                    size={'sm'}
                                    className='bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50'
                                >
                                    <div className='flex items-center gap-2'>
                                        <GitBranch className='size-4' />
                                        {displayButtonText}
                                    </div>
                                </Button>
                            </TooltipTrigger>
                            {Boolean(
                                isButtonDisabled && getTooltipMessage(),
                            ) && (
                                <TooltipContent>
                                    {getTooltipMessage()}
                                </TooltipContent>
                            )}
                        </Tooltip>
                    </div>
                </PopoverTrigger>

                {!!errorMessage && (
                    <div
                        style={{
                            pointerEvents: 'auto',
                        }}
                        className='fixed inset-0 z-50 bg-black/20 transition-all duration-100'
                    />
                )}

                <PopoverContent className='w-full min-w-[200px] z-50 max-w-[400px]'>
                    <div className='flex items-start gap-3 '>
                        <AlertCircle className='size-5 text-destructive mt-0.5 flex-shrink-0' />
                        <div className='grow'>
                            <h4 className='font-medium  mb-1'>Error</h4>
                            <p className='text-sm '>{errorMessage}</p>
                        </div>
                        <Button
                            variant='ghost'
                            size='sm'
                            className='p-1 h-auto hover:text-destructive hover:bg-destructive/10'
                            onClick={() => setErrorMessage('')}
                        >
                            <X className='size-4' />
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}

function SaveChangesButton({}) {
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [buttonText, setButtonText] = useTemporaryState('', 2000)
    const { messages, isGenerating: isChatGenerating } = useChatContext()

    const { chatId, branchId } =
        useLoaderData() as Route.ComponentProps['loaderData']
    const siteData = useRouteLoaderData(
        'routes/org.$orgId.site.$siteId',
    ) as SiteRoute.ComponentProps['loaderData']

    const filesInDraft = useWebsiteState((x) => x?.filesInDraft || {})
    const lastPushedFiles = useWebsiteState((x) => x.lastPushedFiles)
    const hasNonPushedChanges = useMemo(() => {
        return doFilesInDraftNeedPush(filesInDraft, lastPushedFiles)
    }, [filesInDraft, lastPushedFiles])

    const revalidator = useRevalidator()

    // Only show if site has NO GitHub installation
    if (!!siteData.site.githubInstallations?.length) return null

    // Only show if there are files in draft with content
    const hasFilesWithContent = Object.values(filesInDraft).some(file => file?.content?.trim())
    if (!hasFilesWithContent) return null

    const isButtonDisabled: boolean = (() => {
        if (isLoading) {
            return true
        }
        if (isChatGenerating) {
            return true
        }
        if (errorMessage) {
            return true
        }

        // if (!hasNonPushedChanges) {
        //     return true
        // }
        return false
    })()

    const getTooltipMessage = (): string | null => {
        if (!hasNonPushedChanges) {
            return 'No unsaved changes'
        }
        if (isChatGenerating) {
            return 'Wait for chat to finish generating'
        }
        if (isLoading) {
            return 'Saving changes...'
        }
        if (errorMessage) {
            return 'Fix error before saving'
        }
        return null
    }

    const displayButtonText: string = (() => {
        if (buttonText) {
            return buttonText
        }
        if (isLoading) {
            return 'loading...'
        }
        return 'Save Changes'
    })()

    const handleSaveChanges = async () => {
        setIsLoading(true)
        try {
            const filesInDraft = useWebsiteState.getState()?.filesInDraft || {}

            const result = await apiClient.api.saveChangesForChat.post({
                branchId,
                filesInDraft,
                chatId,
            })
            if (result.error) throw result.error

            await revalidator.revalidate()
            setButtonText('Changes saved')
        } catch (error) {
            console.error('Failed to save changes:', error)
            const message =
                error instanceof Error ? error.message : 'Failed to save changes'
            setErrorMessage(message)
        } finally {
            setIsLoading(false)
        }
    }
    if (!messages?.length) return null

    return (
        <div className='flex items-center gap-2'>
            <Popover
                onOpenChange={(x) => {
                    if (!x) setErrorMessage('')
                }}
                open={!!errorMessage}
            >
                <PopoverTrigger asChild>
                    <div className=''>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant='default'
                                    onClick={handleSaveChanges}
                                    disabled={isButtonDisabled}
                                    size={'sm'}
                                    className='bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50'
                                >
                                    <div className='flex items-center gap-2'>
                                        <Save className='size-4' />
                                        {displayButtonText}
                                    </div>
                                </Button>
                            </TooltipTrigger>
                            {Boolean(
                                isButtonDisabled && getTooltipMessage(),
                            ) && (
                                <TooltipContent>
                                    {getTooltipMessage()}
                                </TooltipContent>
                            )}
                        </Tooltip>
                    </div>
                </PopoverTrigger>

                {!!errorMessage && (
                    <div
                        style={{
                            pointerEvents: 'auto',
                        }}
                        className='fixed inset-0 z-50 bg-black/20 transition-all duration-100'
                    />
                )}

                <PopoverContent className='w-full min-w-[200px] z-50 max-w-[400px]'>
                    <div className='flex items-start gap-3 '>
                        <AlertCircle className='size-5 text-destructive mt-0.5 flex-shrink-0' />
                        <div className='grow'>
                            <h4 className='font-medium  mb-1'>Error</h4>
                            <p className='text-sm '>{errorMessage}</p>
                        </div>
                        <Button
                            variant='ghost'
                            size='sm'
                            className='p-1 h-auto hover:text-destructive hover:bg-destructive/10'
                            onClick={() => setErrorMessage('')}
                        >
                            <X className='size-4' />
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}


interface DiffStatsProps {
    filesInDraft: Record<string, FileUpdate>
    hasNonPushedChanges?: boolean
    className?: string
}

export const DiffStats = memo(function DiffStats({
    filesInDraft,
    className = '',
}: DiffStatsProps) {
    const { branchId } = useLoaderData() as Route.ComponentProps['loaderData']

    const getPageContent = useMemo(() => {
        return memoize(async (githubPath: string) => {
            const { data, error } = await apiClient.api.getPageContent.post({
                branchId,
                githubPath,
            })
            if (error) return ''
            return data?.content || ''
        })
    }, [branchId])

    const computedStats = useMemo(() => {
        const computeStatsForFile = async (file: FileUpdate) => {
            const originalContent = await getPageContent(file.githubPath)
            const currentContent = file.content || ''
            return calculateLineChanges(originalContent, currentContent)
        }

        return Object.entries(filesInDraft).map(async ([path, file]) => {
            const stats = await computeStatsForFile(file)
            return {
                path,
                file,
                addedLines: stats.addedLines,
                deletedLines: stats.deletedLines,
            }
        })
    }, [filesInDraft, getPageContent])

    const [resolvedStats, setResolvedStats] = useState<
        Array<{
            path: string
            file: FileUpdate
            addedLines: number
            deletedLines: number
        }>
    >([])

    useEffect(() => {
        Promise.all(computedStats).then(setResolvedStats)
    }, [computedStats])

    // Only include files that have additions or deletions
    const changedFiles = resolvedStats.filter(
        ({ addedLines, deletedLines }) => addedLines > 0 || deletedLines > 0,
    )
    const fileCount = changedFiles.length

    // Don't render if no files have diff
    if (fileCount === 0) {
        return null
    }

    const totalAdded = changedFiles.reduce(
        (sum, { addedLines }) => sum + addedLines,
        0,
    )
    const totalDeleted = changedFiles.reduce(
        (sum, { deletedLines }) => sum + deletedLines,
        0,
    )

    return (
        <div
            className={`text-xs flex gap-2 text-muted-foreground px-2 py-1 rounded-md ${className}`}
        >
            <div>
                edited <span className='font-medium'>{fileCount}</span> file
                {fileCount !== 1 ? 's' : ''}
            </div>
            <div>
                <>
                    {' '}
                    <span className='text-green-600 font-medium'>
                        +{totalAdded || 0}
                    </span>
                </>

                <>
                    ,{' '}
                    <span className='text-red-600 font-medium'>
                        -{totalDeleted}
                    </span>
                </>
            </div>
        </div>
    )
})
