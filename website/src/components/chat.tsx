'use client'
import dedent from 'string-dedent'

import { createIdGenerator, UIMessage } from 'ai'
import {
    ChatAssistantMessage,
    ChatErrorMessage,
    ChatUserMessage,
} from 'contesto/src/chat/chat-message'
import { ChatAutocomplete, ChatTextarea } from 'contesto/src/chat/chat-textarea'
import { MarkdownRuntimeChat as Markdown } from 'docs-website/src/lib/markdown-runtime-chat'
import memoize from 'micro-memoize'
import { memo, startTransition, useEffect, useMemo, useState } from 'react'

import {
    Dot,
    EditorToolPreview,
    ErrorPreview,
    FilesTreePreview,
    ToolPreviewContainer,
} from 'website/src/components/tools-preview'

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

import {
    ToolPartInputStreaming,
    ToolPartOutputAvailable,
    uiStreamToUIMessages,
} from 'contesto/src/lib/process-chat'
import { useShouldHideBrowser, useTemporaryState } from '../lib/hooks'
import {
    apiClient,
    apiClientWithDurableFetch,
    durableFetchClient,
} from '../lib/spiceflow-client'
import { doFilesInDraftNeedPush, useWebsiteState } from '../lib/state'

import { RenderFormPreview } from 'contesto'
import {
    ChatProvider,
    ChatState,
    useChatContext,
} from 'contesto/src/chat/chat-provider'
import { ChatRecordButton } from 'contesto/src/chat/chat-record-button'
import { ChatSuggestionButton } from 'contesto/src/chat/chat-suggestion'
import { ChatUploadButton } from 'contesto/src/chat/chat-upload-button'
import {
    calculateLineChanges,
    createEditExecute,
    EditToolParamSchema,
    FileUpdate,
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
import { safeJsoncParse, slugKebabCaseKeepExtension } from '../lib/utils'
import { Route } from '../routes/+types/org.$orgId.site.$siteId.chat.$chatId'
import type { Route as SiteRoute } from '../routes/org.$orgId.site.$siteId'

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

                    // const updatedMessages = messages.map((msg) => {
                    //     if (msg.role === 'assistant') {
                    //         return {
                    //             ...msg,
                    //             parts: msg.parts.filter(
                    //                 (part) => part.type !== 'tool-renderForm',
                    //             ),
                    //         }
                    //     }
                    //     return msg
                    // })
                    // flushSync(() => {
                    //     setMessages(updatedMessages)
                    // })

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
            async function getPageContent(githubPath: string) {
                const { data, error } = await apiClient.api.getPageContent.post(
                    {
                        branchId,
                        githubPath: githubPath,
                    },
                )
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

                // Handle strReplaceEditor tool output
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
                    useWebsiteState.setState({
                        filesInDraft: { ...filesInDraft },
                        currentSlug,
                    })
                }

                // Handle selectText tool output
                if (toolPart.type === 'tool-selectText') {
                    if (toolPart.output?.error) {
                        console.error(
                            'selectText error:',
                            toolPart.output.error,
                        )
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
        }

        await revalidator.revalidate()
    }

    return (
        <ChatProvider
            generateMessages={submitMessages}
            initialValue={initialChatState}
        >
            <div className='flex grow w-full max-w-[900px] flex-col gap-3 px-6 justify-center'>
                <Messages ref={ref} />
                <WelcomeMessage />
                <Footer />
            </div>
        </ChatProvider>
    )
}

function WelcomeMessage() {
    const { messages } = useChatContext()
    if (messages.length) return null
    return (
        <ChatAssistantMessage
            className='text-sm max-w-2xl mx-auto -mt-[160px]'
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

function MonoSpaceTest() {
    const { messages } = useChatContext()
    if (messages.length) return null
    return (
        <ChatAssistantMessage
            className='font-mono text-sm'
            message={{
                role: 'assistant',
                id: '',
                parts: [],
            }}
        >
            <div className='prose-sm'>
                <div>
                    <span>
                        &#8226;{' '}
                        <span className='text-blue-200 font-semibold'>
                            Good progress!
                        </span>{' '}
                        Now just one test is failing. Let me update that
                        snapshot:
                    </span>
                </div>
                <div className='mt-4'>
                    <span>
                        &#8226;{' '}
                        <span className='text-purple-200 font-semibold'>
                            Bash
                        </span>
                        (pnpm test -u --run)
                    </span>
                    <pre className='ml-5 mb-0 mt-1 text-xs bg-transparent'>
                        ⎿ &gt; playwriter@ test
                        /Users/morse/Documents/GitHub/fumabase/playwriter &gt;
                        vitest run -u --run … +34 lines (ctrl+r to expand)
                    </pre>
                </div>
                <div className='mt-2'>
                    <span>
                        &#8226;{' '}
                        <span className='text-green-200 font-semibold'>
                            Read
                        </span>
                        (src/mcp.test.ts)
                    </span>
                    <pre className='ml-5 mb-0 mt-1 text-xs bg-transparent'>
                        ⎿ Read 10 lines (ctrl+r to expand)
                    </pre>
                </div>
            </div>
            <Markdown
                markdown={dedent(`
\`\`\`diff lineNumbers=true
-  expect(received).toMatchSnapshot()
+  expect(received).toMatchInlineSnapshot()

-  Some failing snapshot output removed...
+  Snapshot updated to reflect latest test run!

-  // Old configuration
-  export const PRIMARY_COLOR = '#3265c1';
+  // New configuration
+  export const PRIMARY_COLOR = '#c1323c';

-  Logo: docs/assets/logo-old.svg
+  Logo: docs/assets/logo-new.svg

-  ## Getting Started
-  Welcome to the documentation!
+  ## Getting Started
+  Welcome to your updated documentation! 🚀

-  "footerLinks": []
+  "footerLinks": [
+    { "label": "Docs", "href": "/docs" },
+    { "label": "Contact", "href": "/contact" }
+  ]
\`\`\`

**Updated 3 lines in \`mcp.test.ts\` and 2 config files.**
The snapshots now pass. You can run \`pnpm test\` to verify.
                `)}
            />
            <div className='grid  -mx-2 grid-cols-2 gap-3 mt-3'>
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
        <div ref={ref} className='text-sm flex flex-col grow mt-6 gap-6'>
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
            <ChatUserMessage className='my-8' message={message}>
                {message.parts.map((part, index) => {
                    if (part.type === 'text') {
                        return (
                            <Markdown
                                key={index}
                                className='[&_p]:m-0 prose text-[16px]'
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

    let minHeight = isLastMessage ? 'calc(-248px + 100dvh)' : '0px'

    return (
        <ChatForm>
            <ChatAssistantMessage
                style={{ minHeight }}
                className='font-mono text-sm whitespace-pre-wrap'
                message={message}
            >
                {message.parts.map((part, index) => {
                    if (part.type === 'text') {
                        return (
                            <div className='flex flex-row tracking-wide gap-[1ch]'>
                                <Dot />
                                <Markdown
                                    isStreaming={isChatGenerating}
                                    key={index}
                                    className='prose-sm'
                                    markdown={part.text}
                                />
                            </div>
                        )
                    }

                    if (part.type === 'reasoning') {
                        return (
                            <div className='flex flex-row opacity-70 tracking-wide gap-[1ch]'>
                                <Dot />
                                <Markdown
                                    isStreaming={isChatGenerating}
                                    key={index}
                                    className='prose-sm'
                                    markdown={part.text}
                                />
                            </div>
                        )
                    }
                    if (part && 'errorText' in part && part.errorText) {
                        return (
                            <>
                                <Dot /> {part.type}
                                <ErrorPreview error={part.errorText} />
                            </>
                        )
                    }
                    if (part.type === 'tool-strReplaceEditor') {
                        return <EditorToolPreview key={index} {...part} />
                    }
                    if (part.type === 'tool-getProjectFiles') {
                        return <FilesTreePreview key={index} {...part} />
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

                    if (part.type.startsWith('tool-')) {
                        const toolName = part.type.replace('tool-', '')
                        const callArg =
                            'input' in part
                                ? truncateText(stringifyArgs(part.input))
                                : ''
                        let error = ''
                        if (
                            typeof part === 'object' &&
                            'error' in part &&
                            part.error
                        ) {
                            error = part.error as any
                        }
                        return (
                            <ToolPreviewContainer key={index}>
                                <Dot /> {spaceCase(toolName)}({callArg})
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
            // For null/undefined/primitive types, JSON.stringify handles all cases
            return `${key}=${JSON.stringify(value)}`
        })
        .join(', ')
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

                            <PrButton />
                            <SaveChangesButton />
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
    const hasFilesWithContent = Object.values(filesInDraft).some((file) =>
        file?.content?.trim(),
    )
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
                error instanceof Error
                    ? error.message
                    : 'Failed to save changes'
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
