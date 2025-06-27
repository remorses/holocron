'use client'

import { RiAttachment2 } from '@remixicon/react'
import { createIdGenerator, UIMessage } from 'ai'
import { Markdown } from 'docs-website/src/lib/markdown'
import { memo, startTransition, useEffect, useMemo, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import {
    ChatAssistantMessage,
    ChatErrorMessage,
    ChatUserMessage,
} from 'website/src/components/chat/chat-message'
import {
    ChatAutocomplete,
    ChatTextarea,
} from 'website/src/components/chat/chat-textarea'
import { ToolInvocationRenderer } from 'website/src/components/tools-preview'

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
import { fullStreamToUIMessages } from '../lib/process-chat'
import { apiClient } from '../lib/spiceflow-client'
import { doFilesInDraftNeedPush, useWebsiteState } from '../lib/state'

import { DocsJsonType } from 'docs-website/src/lib/docs-json'
import { generateSlugFromPath } from 'docs-website/src/lib/utils'
import {
    AlertCircle,
    AlertTriangleIcon,
    FilePlus2Icon,
    GitBranch,
    ImageIcon,
    Link2Icon,
    ListTreeIcon,
    PaletteIcon,
    X,
} from 'lucide-react'
import {
    useLoaderData,
    useParams,
    useRevalidator,
    useRouteLoaderData,
} from 'react-router'
import { docsRpcClient } from '../lib/docs-setstate'
import {
    calculateLineChanges,
    createEditExecute,
    EditToolParamSchema,
    FileUpdate,
    isParameterComplete,
} from '../lib/edit-tool'
import { debounce, safeJsonParse, teeAsyncIterable } from '../lib/utils'
import { Route } from '../routes/+types/org.$orgId.site.$siteId.chat.$chatId'
import type { Route as SiteRoute } from '../routes/org.$orgId.site.$siteId'
import { useChatState } from './chat/chat-provider'
import { ChatSuggestionButton } from './chat/chat-suggestion'
import { AnimatePresence, motion } from 'unframer'
import { FilesInDraft } from 'docs-website/src/lib/docs-state'

function keyForDocsJson({ chatId }) {
    return `docs.json-${chatId}`
}

const setDocsJsonState = ({ values, previousJsonString, chatId }) => {
    console.log(`form values changed, sending state to docs iframe`)
    const githubPath = 'docs.json'
    const filesInDraft = useWebsiteState.getState().filesInDraft || {}

    const newJson = JSON.stringify(
        {
            ...safeJsonParse(previousJsonString),

            ...values,
        },
        null,
        2,
    )
    console.log(`updating docs.json`, newJson)

    const newFilesInDraft: FilesInDraft = {
        ...useWebsiteState.getState().filesInDraft,
        [githubPath]: {
            content: newJson,
            githubPath,
            ...calculateLineChanges(previousJsonString, newJson),
        },
    }
    useWebsiteState.setState({ filesInDraft: newFilesInDraft })
    localStorage.setItem(keyForDocsJson({ chatId }), newJson)
    docsRpcClient.setDocsState({
        filesInDraft: newFilesInDraft,
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

    const { siteBranch } = useLoaderData() as Route.ComponentProps['loaderData']
    const previousJsonString = useMemo(() => {
        return JSON.stringify(siteBranch.docsJson, null, 2)
    }, [siteBranch?.docsJson])

    useEffect(() => {
        const persistedValues =
            typeof localStorage !== 'undefined'
                ? localStorage.getItem(keyForDocsJson({ chatId }))
                : undefined
        const docsJsonString =
            useWebsiteState.getState()?.filesInDraft['docs.json']?.content
        const data = safeJsonParse(persistedValues || docsJsonString) || null
        if (persistedValues) {
            console.log(`localStorage docs.json: `, data)
        } else {
            console.log('docs.json', data)
        }
        if (!data) return

        reset(data, { keepDefaultValues: true })
        setDocsJsonState({ values: data, previousJsonString, chatId })

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
                content: '',
                parts: [
                    {
                        type: 'text',
                        text: 'Hi, I am fumadocs, I can help you with customizing your docs website or add new content. Here are some example things you can do:',
                    },
                ],
            }}
        >
            <Markdown
                markdown='Hi, I am fumadocs, I can help you with customizing your docs website or add new content. Here are some example things you can do:'
                className='prose-sm'
            />
            <div className='grid -mx-2 grid-cols-2 gap-3 mt-3'>
                <ChatSuggestionButton
                    icon={<PaletteIcon />}
                    userMessage='Change theme color'
                >
                    Change theme color
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
                    userMessage='Edit navigation menu'
                >
                    Edit navigation menu
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
            className='relative text-sm h-full flex flex-col grow  mt-6 gap-6'
        >
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
                if (part.type === 'tool-invocation') {
                    return <ToolInvocationRenderer part={part} index={index} />
                }

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
    const isPending = useChatState((x) => x.isGenerating)
    const text = useChatState((x) => x.text || '')
    const revalidator = useRevalidator()
    const { chat, prUrl, mentionOptions, branchId } =
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

    const handleSubmit = async () => {
        const messages = useChatState.getState()?.messages
        const generateId = createIdGenerator()

        const filesInDraft = useWebsiteState.getState()?.filesInDraft || {}
        const currentSlug = useWebsiteState.getState()?.currentSlug || ''

        const { data: generator, error } =
            await apiClient.api.generateMessage.post({
                messages: messages,
                siteId,
                branchId,
                currentSlug,
                filesInDraft,
                chatId: chat.chatId,
            })
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
            fullStreamToUIMessages({
                fullStream: generator,
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
                    lastPart?.type === 'tool-invocation'
                ) {
                    const toolInvocation = lastPart.toolInvocation
                    if (toolInvocation.toolName === 'str_replace_editor') {
                        const args: Partial<EditToolParamSchema> =
                            toolInvocation.args
                        if (args?.command === 'view') {
                            continue
                        }
                        if (!isParameterComplete(args)) {
                            continue
                        }
                        const currentSlug = generateSlugFromPath(
                            args.path || '',
                            '/',
                        )
                        if (toolInvocation.state === 'partial-call') {
                            if (isPostMessageBusy) continue
                            let updatedPagesCopy = { ...filesInDraft }
                            const execute = createEditExecute({
                                filesInDraft: updatedPagesCopy,
                                getPageContent,
                            })
                            await execute(toolInvocation.args)
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
                        } else if (toolInvocation.state === 'result') {
                            await execute(toolInvocation.args)
                            console.log(
                                `applying the setState update to the docs site`,
                                toolInvocation,
                            )

                            await docsRpcClient.setDocsState(
                                {
                                    filesInDraft: filesInDraft,
                                    isMarkdownStreaming: false,
                                    currentSlug,
                                },
                                toolInvocation.toolCallId,
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
                sum + (file.addedLines || 0) + (file.deletedLines || 0),
            0,
        )
    }, [filesInDraft])
    const showCreatePR = hasFilesInDraft || prUrl

    return (
        <AnimatePresence mode='popLayout'>
            <motion.div
                layoutId='textarea'
                className='sticky bottom-0 pt-4  z-50 w-full'
            >
                <div className='max-w-3xl -mx-3 space-y-3'>
                    <div className='flex flex-col gap-2 '>
                        <div className='flex gap-1 empty:hidden justify-start items-center bg-background p-1 rounded-md'>
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

                            {showCreatePR && (
                                <div className='justify-end flex grow'>
                                    <PrButton
                                        disabled={
                                            !hasNonPushedChanges ||
                                            !updatedLines
                                        }
                                    />
                                </div>
                            )}
                        </div>

                        <div className='relative rounded-[20px] border bg-muted'>
                            <ChatTextarea
                                onSubmit={() => handleSubmit()}
                                disabled={false}
                                placeholder='Ask me anything...'
                                className=''
                                mentionOptions={mentionOptions || []}
                            />
                            {/* Textarea buttons */}
                            <div className='flex items-center justify-between gap-2 p-3'>
                                {/* Left buttons */}
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
                                {/* Right buttons */}
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
                    </div>
                </div>
                <ChatAutocomplete
                    autocompleteSuggestions={AUTOCOMPLETE_SUGGESTIONS}
                />
            </motion.div>
        </AnimatePresence>
    )
}

function PrButton({ disabled = false }: { disabled?: boolean } = {}) {
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [buttonText, setButtonText] = useTemporaryState('', 2000)

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

    const isButtonDisabled =
        disabled ||
        !hasNonPushedChanges ||
        isLoading ||
        isChatGenerating ||
        !!errorMessage

    const getTooltipMessage = () => {
        if (disabled || !hasNonPushedChanges)
            return 'No unsaved changes to create PR'
        if (isChatGenerating) return 'Wait for chat to finish generating'
        if (isLoading) return 'Creating PR...'
        if (errorMessage) return 'Fix error before creating PR'
        return null
    }

    const displayButtonText =
        buttonText ||
        (isLoading
            ? 'loading...'
            : chat.prNumber
              ? `Push to PR #${chat.prNumber}`
              : 'Create Github PR')

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
                            {isButtonDisabled && getTooltipMessage() && (
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
    hasNonPushedChanges = false,
    className = '',
}: DiffStatsProps) {
    // Only include files that have additions or deletions
    const changedFiles = Object.entries(filesInDraft).filter(
        ([, file]) =>
            (file.addedLines || 0) > 0 || (file.deletedLines || 0) > 0,
    )
    const fileCount = changedFiles.length

    // Don't render if no files have diff
    if (fileCount === 0) {
        return null
    }

    const totalAdded = changedFiles.reduce(
        (sum, [, file]) => sum + (file.addedLines || 0),
        0,
    )
    const totalDeleted = changedFiles.reduce(
        (sum, [, file]) => sum + (file.deletedLines || 0),
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
