import { prisma } from 'db'
import { useCallback, useImperativeHandle, useState } from 'react'
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from '../components/ui/popover'
import { AlertCircle, X } from 'lucide-react'
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from '../components/ui/tooltip'
import memoize from 'micro-memoize'
import { useEffect, useMemo, useRef } from 'react'
import {
    useLoaderData,
    useRouteLoaderData,
    Link,
    useParams,
    useRevalidator,
    useSearchParams,
} from 'react-router'
import { ChatLeftSidebar } from '../components/left-sidebar'
import { BrowserWindow } from '../components/browser-window'
import { SidebarInset, SidebarProvider } from '../components/ui/sidebar'
import { getSession } from '../lib/better-auth'
import { createIframeRpcClient, docsRpcClient } from '../lib/docs-setstate'
import { getTabFilesWithoutContents } from '../lib/spiceflow-generate-message'

import { State, useWebsiteState, WebsiteStateProvider, useFilesInDraftAutoSave } from '../lib/state'
import { cn } from '../lib/utils'
import type { Route } from './+types/org.$orgId.branch.$branchId.chat.$chatId._index'
import type { Route as BranchRoute } from './org.$orgId.branch.$branchId'

import { UIMessage } from 'ai'
import { ChatProvider, ChatState } from 'contesto/src/chat/chat-provider'
import { env } from 'docs-website/src/lib/env'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '../components/ui/button'
import { GithubIcon } from 'lucide-react'
import { useShouldHideBrowser, useThrowingFn } from '../lib/hooks'
import { apiClient } from '../lib/spiceflow-client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import Chat from '../components/chat'
import { useStickToBottom } from 'use-stick-to-bottom'
import { href } from 'react-router'

export type { Route }

export async function loader({
    request,
    params: { orgId, branchId, chatId },
}: Route.LoaderArgs) {
    // Check if request is aborted early
    if (request.signal.aborted) {
        throw new Error('Request aborted')
    }

    const { userId } = await getSession({ request })

    // Check signal before main database queries
    if (request.signal.aborted) {
        throw new Error('Request aborted')
    }

    // Fetch chat and branch info
    const [chat, siteBranch] = await Promise.all([
        prisma.chat.findUnique({
            where: {
                chatId: chatId,
                userId,
            },
            include: {
                messages: {
                    orderBy: { index: 'asc' },
                    include: {
                        textParts: { orderBy: { index: 'asc' } },
                        reasoningParts: { orderBy: { index: 'asc' } },
                        toolParts: { orderBy: { index: 'asc' } },
                        sourceUrlParts: { orderBy: { index: 'asc' } },
                        fileParts: { orderBy: { index: 'asc' } },
                    },
                },
            },
        }),
        // Fetch the siteBranch directly with site included
        prisma.siteBranch.findFirst({
            where: {
                branchId,
                site: {
                    org: {
                        users: { some: { userId } },
                    },
                },
            },
            select: {
                branchId: true,
                domains: true,
                docsJson: true,
                githubBranch: true,
                lastGithubSyncAt: true,
                lastGithubSyncCommit: true,
                site: {
                    select: {
                        siteId: true,
                        githubOwner: true,
                        githubRepo: true,
                        githubFolder: true,
                    },
                },
            },
        }),
    ])

    if (!chat) {
        throw new Error('Chat not found')
    }
    if (!siteBranch) {
        throw new Error('Branch not found')
    }

    const site = siteBranch.site

    // Create PR URL if chat has a PR number
    const prUrl = chat.prNumber
        ? `https://github.com/${site.githubOwner}/${site.githubRepo}/pull/${chat.prNumber}`
        : undefined

    // Create mention options from branch pages using getTabFilesWithoutContents
    const fileNames: string[] = await (async () => {
        const branchId = chat.branchId
        if (!branchId) return []

        // Check signal before getting files
        if (request.signal.aborted) {
            throw new Error('Request aborted')
        }

        const allFiles = await getTabFilesWithoutContents({ branchId })
        return allFiles.map((file) => `@${file.githubPath}`).sort()
    })()

    const host = siteBranch.domains
        .filter((x) => x.domainType === 'internalDomain')
        .sort((a, b) => {
            // Sort based on environment.
            let orderLocalhost = 1
            if (process.env.NODE_ENV === 'development') {
                orderLocalhost = -1
            }
            const aIsLocalhost = a.host.includes('localhost')
                ? orderLocalhost
                : -orderLocalhost
            const bIsLocalhost = b.host.includes('localhost')
                ? orderLocalhost
                : -orderLocalhost
            return aIsLocalhost - bIsLocalhost
        })[0]?.host

    const iframeUrl = new URL(`https://${host}`)
    if (host?.endsWith('.localhost')) {
        iframeUrl.protocol = 'http:'
        iframeUrl.port = '7777'
    }

    iframeUrl.searchParams.set('chatId', chat.chatId)

    const githubFolder = site.githubFolder
    const siteId = site.siteId
    return {
        chatId,
        chat,
        prUrl,
        mentionOptions: fileNames,
        iframeUrl,
        host,
        branchId,
        siteBranch,
        siteId,
        githubFolder,
    }
}

export default function Page({
    loaderData,
    params: { branchId, orgId },
}: Route.ComponentProps) {
    const { chat } = loaderData

    const initialState = useMemo<State>(
        () => ({
            lastPushedFiles: (chat.lastPushedFiles as any) || {},
            filesInDraft: chat.filesInDraft as any,
            currentSlug: chat.currentSlug || '',
        }),
        // only reset website state on chat navigation. keep client state on revalidate because fumabase.jsonc is not updated in filesInDraft server side in the renderForm tool
        [loaderData.chatId],
    )
    return (
        <WebsiteStateProvider initialValue={initialState}>
            <ChatContent />
        </WebsiteStateProvider>
    )
}

function ChatContent() {
    const hideBrowser = useShouldHideBrowser()
    const { chatId } = useLoaderData<typeof loader>()
    
    // Enable auto-saving of filesInDraft to database
    useFilesInDraftAutoSave(chatId)

    return (
        <div className='dark:bg-black flex h-full gap-2 py-4 px-3'>
            <ChatLeftSidebar />

            {!hideBrowser && (
                <div className='flex grow h-full flex-col gap-4'>
                    <RightSide />
                </div>
            )}
        </div>
    )
}

function RightSide() {
    const { chat, iframeUrl, host, siteBranch } = useLoaderData<typeof loader>()
    const branchData = useRouteLoaderData(
        'routes/org.$orgId.branch.$branchId',
    ) as BranchRoute.ComponentProps['loaderData']
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const [activeTab, setActiveTab] = useState<'preview' | 'editor'>('preview')
    const previewMode = activeTab

    useEffect(() => {
        console.log('iframe sidebar remounted')
    }, [])

    const handleTabChange = (value: string) => {
        const newValue = value as 'preview' | 'editor'
        setActiveTab(newValue)

        // Update the iframe's docs state when switching tabs
        const iframe = iframeRef.current
        if (iframe) {
            const state = {
                previewMode: newValue,
            }

            docsRpcClient.setDocsState({ state }).catch(console.error)
        }
    }

    const iframeRefCallback = useCallback(
        (el) => {
            iframeRef.current = el
            if (!el) {
                return
            }
            const docsRpcClient = createIframeRpcClient({
                iframeRef,
                targetOrigin: new URL(iframeUrl).origin,
            })

            const state = {
                currentSlug: chat.currentSlug || undefined,
                filesInDraft: (chat.filesInDraft as any) || {},
                previewMode,
            }
            let sentFirstMessage = false
            // do it as soon as the page loads to not wait for the ready message
            docsRpcClient.setDocsState({ state }).then(() => {
                sentFirstMessage = true
            })
            const waitForFirstMessage = (event) => {
                if (
                    iframeRef.current &&
                    !sentFirstMessage &&
                    event.source === iframeRef.current.contentWindow
                ) {
                    docsRpcClient.setDocsState({ state })
                    window.removeEventListener('message', waitForFirstMessage)
                }
            }
            window.addEventListener('message', waitForFirstMessage, {
                once: true,
            })
            return () => {
                docsRpcClient.cleanup()
            }
        },
        [iframeUrl],
    )

    return (
        <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className='flex flex-col gap-4 h-full'
        >
            <div className='flex gap-2'>
                <TabsList className=''>
                    <TabsTrigger value='preview'>Browser Preview</TabsTrigger>
                    <TabsTrigger value='editor'>Editor</TabsTrigger>
                    {/* <TabsTrigger value='errors'>Errors</TabsTrigger> */}
                </TabsList>
                <div className='grow'></div>
                <GithubRepoButton />
                <GitHubSyncStatus />
                {/* <GitHubSyncButton /> */}
                <InstallGithubAppToolbar />
            </div>

            <div className='flex grow flex-col'>
                <BrowserWindow
                    url={iframeUrl}
                    onSearchBarClick={() => {
                        const iframe = iframeRef.current
                        window.open(iframe?.src, '_blank')
                    }}
                    onRefresh={() => {
                        const iframe = iframeRef.current
                        if (iframe) {
                            iframe.src += ''
                        }
                    }}
                    className={cn(
                        'text-sm shrink-0 shadow rounded-xl justify-stretch',
                        'items-stretch h-full flex-col flex-1 border',
                        ' lg:flex bg-background',
                    )}
                >
                    <iframe
                        ref={iframeRefCallback}
                        key={chat.chatId}
                        style={scaleDownElement(0.75)}
                        className={cn(' inset-0 bg-transparent', 'absolute')}
                        frameBorder={0}
                        allowTransparency={true}
                        name='preview' // tell iframe preview props is enabled
                        title='preview'
                        src={iframeUrl.toString()}
                    ></iframe>
                </BrowserWindow>
            </div>
        </Tabs>
    )
}

const scaleDownElement = memoize(function (iframeScale) {
    return {
        transform: `scale(${iframeScale})`,
        transformOrigin: 'top left',
        width: `${Number(100 / iframeScale).toFixed(1)}%`,
        height: `${Number(100 / iframeScale).toFixed(1)}%`,
    }
})

function GithubRepoButton() {
    const branchData = useRouteLoaderData(
        'routes/org.$orgId.branch.$branchId',
    ) as BranchRoute.ComponentProps['loaderData']

    const githubOwner = branchData?.site.githubOwner
    const githubRepo = branchData?.site.githubRepo
    const githubFolder = branchData?.site.githubFolder

    const hasGithubRepo = githubOwner && githubRepo

    // Return null if no repository is configured
    if (!hasGithubRepo) return null

    const repoUrl = `https://github.com/${githubOwner}/${githubRepo}${githubFolder ? '/' + githubFolder.replace(/^\/+/, '') : ''}`

    return (
        <Button variant='secondary' asChild>
            <a href={repoUrl} target='_blank' rel='noopener noreferrer'>
                <GithubIcon className='size-4 mr-2' />
                {githubOwner}/{githubRepo}
            </a>
        </Button>
    )
}

function GitHubSyncStatus() {
    const { siteBranch } = useLoaderData<typeof loader>()
    const branchData = useRouteLoaderData(
        'routes/org.$orgId.branch.$branchId',
    ) as BranchRoute.ComponentProps['loaderData']

    const githubOwner = branchData?.site.githubOwner
    const githubRepo = branchData?.site.githubRepo

    if (
        !siteBranch?.lastGithubSyncAt ||
        !siteBranch?.lastGithubSyncCommit ||
        !githubOwner ||
        !githubRepo
    ) {
        return null
    }
    if (!branchData.site.githubInstallations?.length) return null

    const timeAgo = formatDistanceToNow(new Date(siteBranch.lastGithubSyncAt), {
        addSuffix: true,
    })
    const shortCommit = siteBranch.lastGithubSyncCommit.slice(0, 7)
    const commitUrl = `https://github.com/${githubOwner}/${githubRepo}/commit/${siteBranch.lastGithubSyncCommit}`

    return (
        <div className='flex justify-center'>
            <Button variant='outline' asChild>
                <Link to={commitUrl} target='_blank' rel='noopener noreferrer'>
                    <span>
                        <strong>Last sync</strong> {timeAgo}: {shortCommit}
                    </span>
                </Link>
            </Button>
        </div>
    )
}

function InlineErrorMessagePopoverContent({
    errorMessage,
    onClear,
}: {
    errorMessage: string
    onClear: () => void
}) {
    if (!errorMessage) return null
    return (
        <>
            <div
                style={{
                    pointerEvents: 'auto',
                }}
                className='fixed inset-0 z-50 bg-black/20 transition-all duration-100'
            />
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
                        onClick={onClear}
                    >
                        <X className='size-4' />
                    </Button>
                </div>
            </PopoverContent>
        </>
    )
}

function GitHubSyncButton() {
    const { branchId } = useParams()
    const branchData = useRouteLoaderData(
        'routes/org.$orgId.branch.$branchId',
    ) as BranchRoute.ComponentProps['loaderData']
    const chatData = useRouteLoaderData(
        'routes/org.$orgId.branch.$branchId.chat.$chatId._index',
    ) as Route.ComponentProps['loaderData'] | undefined
    const githubBranch = chatData?.siteBranch?.githubBranch

    const [errorMessage, setErrorMessage] = useState('')

    const reval = useRevalidator()
    const { fn: sync, isLoading } = useThrowingFn({
        async fn() {
            try {
                const siteId = branchData?.siteId
                if (!siteId || !githubBranch) return
                const { error } = await apiClient.api.githubSync.post({
                    siteId,
                    githubBranch,
                })
                if (error) throw error
                reval.revalidate()
            } catch (err) {
                console.log(err)
                setErrorMessage(err.message)
            }
        },
    })

    if (!githubBranch) {
        return null
    }

    if (!branchData.site.githubInstallations?.length) return null

    return (
        <Popover
            open={!!errorMessage}
            onOpenChange={(open) => {
                if (!open) setErrorMessage('')
            }}
        >
            <PopoverTrigger asChild>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            isLoading={isLoading}
                            onClick={sync}
                            variant='secondary'
                            disabled={isLoading}
                        >
                            Sync With GitHub
                        </Button>
                    </TooltipTrigger>
                    {isLoading && (
                        <TooltipContent>Syncing with GitHub...</TooltipContent>
                    )}
                </Tooltip>
            </PopoverTrigger>

            <InlineErrorMessagePopoverContent
                errorMessage={errorMessage}
                onClear={() => setErrorMessage('')}
            />
        </Popover>
    )
}

function InstallGithubAppToolbar() {
    const { orgId, branchId } = useParams()
    const branchData = useRouteLoaderData(
        'routes/org.$orgId.branch.$branchId',
    ) as BranchRoute.ComponentProps['loaderData']
    const chatData = useRouteLoaderData(
        'routes/org.$orgId.branch.$branchId.chat.$chatId._index',
    ) as Route.ComponentProps['loaderData'] | undefined

    const githubOwner = branchData.site.githubOwner

    // Create install URL with next parameter pointing to connect-github
    const nextPath = href('/github/:orgId/:branchId/connect-github', {
        orgId: orgId!,
        branchId: branchId!,
    })
    const installUrl = new URL(href('/api/github/install'), env.PUBLIC_URL)
    installUrl.searchParams.set('next', nextPath)

    const hideBrowser = useShouldHideBrowser()
    if (hideBrowser) {
        return null
    }

    // Only show if site has NO GitHub installation
    if (!!branchData.site.githubInstallations?.length) return null

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Link to={installUrl.pathname + installUrl.search}>
                    <Button
                        variant='default'
                        size={'sm'}
                        className='bg-purple-600 hover:bg-purple-700 text-white'
                    >
                        <div className='flex items-center gap-2'>
                            <GithubIcon className='size-4' />
                            Connect GitHub
                        </div>
                    </Button>
                </Link>
            </TooltipTrigger>
            <TooltipContent>Connect GitHub to create PRs</TooltipContent>
        </Tooltip>
    )
}
