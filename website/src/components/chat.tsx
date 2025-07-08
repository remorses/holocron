'use client'

import { createIdGenerator, isToolUIPart, UIMessage } from 'ai'
import { MarkdownRuntime as Markdown } from 'docs-website/src/lib/markdown-runtime'
import { memo, startTransition, useEffect, useMemo, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import {
    ChatAssistantMessage,
    ChatErrorMessage,
    ChatUserMessage,
} from 'contesto/src/chat/chat-message'
import { ChatAutocomplete, ChatTextarea } from 'contesto/src/chat/chat-textarea'
import {
    EditorToolPreview,
    FilesTreePreview,
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

import { useTemporaryState } from '../lib/hooks'
import { uiStreamToUIMessages } from 'contesto/src/lib/process-chat'
import {
    apiClient,
    apiClientWithDurableFetch,
    durableFetchClient,
} from '../lib/spiceflow-client'
import { doFilesInDraftNeedPush, useWebsiteState } from '../lib/state'

import { FilesInDraft } from 'docs-website/src/lib/docs-state'
import { generateSlugFromPath } from 'docs-website/src/lib/utils'
import {
    AlertCircle,
    FilePlus2Icon,
    GitBranch,
    ImageIcon,
    ListTreeIcon,
    PaletteIcon,
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
import { ChatRecordButton } from 'contesto/src/chat/chat-record-button'
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
import {
    safeJsoncParse,
    slugKebabCaseKeepExtension,
    teeAsyncIterable,
} from '../lib/utils'
import { Route } from '../routes/+types/org.$orgId.site.$siteId.chat.$chatId'
import type { Route as SiteRoute } from '../routes/org.$orgId.site.$siteId'
import { useChatState } from 'contesto/src/chat/chat-provider'
import { ChatSuggestionButton } from 'contesto/src/chat/chat-suggestion'
import { ChatUploadButton } from 'contesto/src/chat/chat-upload-button'
import { WebsiteUIMessage } from '../lib/types'
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
            ...calculateLineChanges(previousJsonString, newJson),
        },
    }
    const newFilesInDraft: FilesInDraft = {
        ...useWebsiteState.getState().filesInDraft,
        ...newChanges,
    }
    useWebsiteState.setState({ filesInDraft: newFilesInDraft })
    localStorage.setItem(keyForDocsJson({ chatId }), newJson)
    docsRpcClient.setDocsState({
        filesInDraft: newChanges,
    })
}

export default function Chat({}) {
    const { scrollRef, contentRef } = useStickToBottom({
        initial: 'instant',
    })
    const { chatId } = useParams()

    const methods = useForm({
        // values: initialDocsJsonData,
    })
    const { reset, subscribe } = methods

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

        reset(data, { keepDefaultValues: true })
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
        const unSub = subscribe({
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

    return (
        <FormProvider {...methods}>
            <ScrollArea
                ref={scrollRef}
                className='[&>div>div]:grow max-w-full h-full flex flex-col grow '
            >
                <div className='flex flex-col gap-3 px-6 relative h-full grow justify-center'>
                    <Messages ref={contentRef} />
                    <WelcomeMessage />
                    <Footer />
                </div>
            </ScrollArea>
        </FormProvider>
    )
}

function WelcomeMessage() {
    const messages = useChatState((x) => x.messages)
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
    const messages = useChatState((x) => x?.messages)

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
    const isChatGenerating = useChatState((x) => x.isGenerating)

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
                if (part.type === 'tool-str_replace_editor') {
                    return <EditorToolPreview key={index} {...part} />
                }
                if (part.type === 'tool-get_project_files') {
                    return <FilesTreePreview key={index} {...part} />
                }
                if (part.type === 'tool-render_form') {
                    return <RenderFormPreview key={index} {...part} />
                }
                if (process.env.NODE_ENV === 'development') {
                    return (
                        <pre key={index}>{JSON.stringify(part, null, 2)}</pre>
                    )
                }

                return null
            })}
        </ChatAssistantMessage>
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

    const handleContextSelect = (selectedValue: string) => {
        if (!selectedValue) return

        const currentText = useChatState.getState().text || ''
        const newText = currentText + (currentText ? ' ' : '') + selectedValue
        useChatState.setState({ text: newText })
        setOpen(false)
        // Focus the textarea if provided
        if (textareaRef?.current) {
            textareaRef.current.focus()
        }
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
    const isPending = useChatState((x) => x.isGenerating)
    const text = useChatState((x) => x.text || '')
    const revalidator = useRevalidator()
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

    const durableUrl = `/api/generateMessage?chatId=${chat.chatId}`

    useEffect(() => {
        durableFetchClient.isInProgress(durableUrl).then(({ inProgress }) => {
            if (inProgress) {
                submitWithoutDeleteOnDurablefetch()
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

    const submitWithoutDeleteOnDurablefetch = async () => {
        const messages = useChatState.getState()?.messages
        const generateId = createIdGenerator()

        const filesInDraft = useWebsiteState.getState()?.filesInDraft || {}
        const currentSlug = useWebsiteState.getState()?.currentSlug || ''

        const { data: generator, error } =
            await apiClientWithDurableFetch.api.generateMessage.post(
                {
                    messages: messages,
                    siteId,
                    branchId,
                    currentSlug,
                    filesInDraft,
                    chatId: chat.chatId,
                },
                { query: { chatId: chat.chatId } },
            )
        if (error) throw error

        async function getPageContent(x) {
            const { data, error } = await apiClient.api.getPageContent.post({
                branchId,
                githubPath: x.githubPath,
            })
            if (error) return ''
            return data?.content
        }
        const execute = createEditExecute({
            filesInDraft: filesInDraft,
            getPageContent,
        })
        // Split the async iterator into two: one for docs edit, one for state updates
        const [editIter, stateIter] = teeAsyncIterable(
            uiStreamToUIMessages({
                uiStream: generator,
                messages: messages,
                generateId,
            }),
        )

        // First iteration: handle docs/edit-tool logic
        let isPostMessageBusy = false
        async function updateDocsSite() {
            for await (const newMessages of editIter) {
                const lastMessage = newMessages[newMessages.length - 1]
                const lastPart = lastMessage.parts[lastMessage.parts.length - 1]
                if (
                    lastMessage.role === 'assistant' &&
                    lastPart?.type === 'tool-str_replace_editor'
                ) {
                    if ('input' in lastPart) {
                        const args: Partial<EditToolParamSchema> =
                            lastPart.input
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
                        if (
                            lastPart.state === 'input-streaming' ||
                            lastPart.state === 'input-available'
                        ) {
                            if (isPostMessageBusy) continue
                            let updatedPagesCopy = { ...filesInDraft }
                            const execute = createEditExecute({
                                filesInDraft: updatedPagesCopy,
                                getPageContent,
                            })
                            await execute(args as any)
                            isPostMessageBusy = true
                            docsRpcClient
                                .setDocsState({
                                    filesInDraft: updatedPagesCopy,
                                    currentSlug,
                                    isMarkdownStreaming: true,
                                })
                                .then(() => {
                                    isPostMessageBusy = false
                                })
                        } else if (lastPart.state === 'output-available') {
                            await execute(args as any)
                            console.log(
                                `applying the setState update to the docs site`,
                                lastPart,
                            )

                            await docsRpcClient.setDocsState(
                                {
                                    filesInDraft: filesInDraft,
                                    isMarkdownStreaming: false,
                                    currentSlug,
                                },
                                lastPart.toolCallId,
                            )
                            useWebsiteState.setState({
                                filesInDraft,
                                currentSlug,
                            })
                        }
                    }
                }
            }
        }
        updateDocsSite()

        for await (const newMessages of stateIter) {
            startTransition(() => {
                useChatState.setState({ messages: newMessages })
            })
        }

        window.dispatchEvent(
            new CustomEvent('chatGenerationFinished', {
                detail: { chatId: chat.chatId },
            }),
        )
    }
    // Listen for regenerate events

    const hasFilesInDraft = Object.keys(filesInDraft).length > 0
    const updatedLines = useMemo(() => {
        return Object.values(filesInDraft).reduce(
            (sum, file: FileUpdate) =>
                sum + (file?.addedLines || 0) + (file?.deletedLines || 0),
            0,
        )
    }, [filesInDraft])
    const showCreatePR = hasFilesInDraft || prUrl
    const textareaRef = React.useRef<HTMLTextAreaElement>(null)
    async function onSubmit() {
        await durableFetchClient.delete(durableUrl)
        await submitWithoutDeleteOnDurablefetch()
    }
    return (
        <AnimatePresence mode='popLayout'>
            <motion.div
                layoutId='textarea'
                className='sticky bottom-0 pt-4  z-50 w-full'
            >
                <div className='max-w-3xl -mx-3 space-y-3'>
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
                                {!!siteData.site.githubInstallations?.length ? (
                                    <PrButton updatedLines={updatedLines} />
                                ) : (
                                    <InstallGithubApp />
                                )}
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
                                onSubmit={onSubmit}
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
                                    <Button
                                        className='rounded-full h-8'
                                        onClick={onSubmit}
                                        disabled={isPending || !text.trim()}
                                    >
                                        {isPending ? 'Loading...' : 'Generate'}
                                    </Button>
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

function PrButton({ updatedLines }) {
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [buttonText, setButtonText] = useTemporaryState('', 2000)
    const messages = useChatState((x) => x.messages)

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
    const isChatGenerating = useChatState((x) => x.isGenerating)

    const revalidator = useRevalidator()

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
        if (!updatedLines) {
            return true
        }

        if (!hasNonPushedChanges) {
            return true
        }
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

function InstallGithubApp() {
    const { orgId } = useParams()
    const siteData = useRouteLoaderData(
        'routes/org.$orgId.site.$siteId',
    ) as SiteRoute.ComponentProps['loaderData']
    const githubOwner = siteData.site.githubOwner
    const handleInstallGithub = () => {
        const nextUrl = new URL(window.location.href)
        nextUrl.searchParams.set('installGithubApp', 'true')
        const setupUrl = href('/api/github/install')

        const url = new URL(setupUrl, window.location.origin)
        if (githubOwner) {
            url.searchParams.set('chosenOrg', githubOwner)
        }
        url.searchParams.set('next', nextUrl.toString())
        const setupUrlWithNext = url.toString()
        window.location.href = setupUrlWithNext
    }

    return (
        <div className='flex items-center gap-2'>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant='default'
                        onClick={handleInstallGithub}
                        size={'sm'}
                        className='bg-purple-600 hover:bg-purple-700 text-white'
                    >
                        <div className='flex items-center gap-2'>
                            <GitBranch className='size-4' />
                            Connect GitHub
                        </div>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>Connect GitHub to create PRs</TooltipContent>
            </Tooltip>
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
    hasNonPushedChanges = false,
    className = '',
}: DiffStatsProps) {
    // Only include files that have additions or deletions
    const changedFiles = Object.entries(filesInDraft).filter(
        ([, file]) =>
            (file?.addedLines || 0) > 0 || (file?.deletedLines || 0) > 0,
    )
    const fileCount = changedFiles.length

    // Don't render if no files have diff
    if (fileCount === 0) {
        return null
    }

    const totalAdded = changedFiles.reduce(
        (sum, [, file]) => sum + (file?.addedLines || 0),
        0,
    )
    const totalDeleted = changedFiles.reduce(
        (sum, [, file]) => sum + (file?.deletedLines || 0),
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
                {totalAdded > 0 && (
                    <>
                        {' '}
                        <span className='text-green-600 font-medium'>
                            +{totalAdded}
                        </span>
                    </>
                )}
                {totalDeleted > 0 && (
                    <>
                        ,{' '}
                        <span className='text-red-600 font-medium'>
                            -{totalDeleted}
                        </span>
                    </>
                )}
            </div>
        </div>
    )
})
