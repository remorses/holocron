import { prisma } from 'db'
import memoize from 'micro-memoize'
import { useEffect, useMemo, useRef } from 'react'
import { useLoaderData, useRouteLoaderData } from 'react-router'
import { AppSidebar } from '../components/app-sidebar'
import { BrowserWindow } from '../components/browser-window'
import { SidebarInset, SidebarProvider } from '../components/ui/sidebar'
import { getSession } from '../lib/better-auth'
import { createIframeRpcClient } from '../lib/docs-setstate'
import { getTabFilesWithoutContents } from '../lib/spiceflow-generate-message'

import { State, WebsiteStateProvider } from '../lib/state'
import { cn } from '../lib/utils'
import type { Route } from './+types/org.$orgId.site.$siteId.chat.$chatId'
import type { Route as SiteRoute } from './org.$orgId.site.$siteId'

import { UIMessage } from 'ai'
import { ChatProvider, ChatState } from '../components/chat/chat-provider'
import { env } from 'docs-website/src/lib/env'

export type { Route }

export async function loader({
    request,
    params: { orgId, siteId, chatId },
}: Route.LoaderArgs) {
    const { userId } = await getSession({ request })

    const url = new URL(request.url)

    if (url.searchParams.get('installGithubApp')) {
        const githubAccountLogin = url.searchParams.get('githubAccountLogin')
        const githubInstallation = await prisma.githubInstallation.findFirst({
            where: {
                orgs: {
                    some: {
                        orgId,
                        appId: env.GITHUB_APP_ID,
                    },
                },
                accountLogin: githubAccountLogin || '',
            },
        })

        if (!githubInstallation) {
            throw new Error(
                `GitHub installation not found for ${githubAccountLogin}`,
            )
        }
        await prisma.siteGithubInstallation.upsert({
            where: {
                installationId_appId_siteId: {
                    installationId: githubInstallation.installationId,
                    appId: env.GITHUB_APP_ID!,
                    siteId,
                },
            },
            create: {
                installationId: githubInstallation.installationId,
                appId: env.GITHUB_APP_ID!,
                siteId,
            },
            update: {},
        })
        // Redirect to the same route but remove search params
        const pathname = url.pathname
        throw new Response(null, {
            status: 302,
            headers: {
                Location: pathname,
            },
        })
    }

    // Fetch chat and site info separately
    const [chat, site, siteBranch] = await Promise.all([
        prisma.chat.findUnique({
            where: {
                chatId: chatId,
                userId,
            },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        parts: {
                            orderBy: { index: 'asc' },
                        },
                    },
                },
            },
        }),
        prisma.site.findUnique({
            where: {
                siteId,
                org: {
                    users: { some: { userId } },
                },
            },
            select: {
                siteId: true,
                githubOwner: true,
                githubRepo: true,
            },
        }),
        // Fetch the siteBranch that this chat is part of
        prisma.siteBranch.findFirst({
            where: {
                siteId,
                chats: {
                    some: { chatId },
                },
            },
            select: {
                branchId: true,
                domains: true,
                docsJson: true,
                githubBranch: true,
            },
        }),
    ])

    if (!chat) {
        throw new Error('Chat not found')
    }
    if (!site) {
        throw new Error('Site not found')
    }
    if (!siteBranch) {
        throw new Error('siteBranch not found')
    }

    // Create PR URL if chat has a PR number
    const prUrl = chat.prNumber
        ? `https://github.com/${site.githubOwner}/${site.githubRepo}/pull/${chat.prNumber}`
        : undefined

    // Create mention options from branch pages using getTabFilesWithoutContents
    const mentionOptions: string[] = await (async () => {
        const branchId = chat.branchId
        if (!branchId) return []

        const allFiles = await getTabFilesWithoutContents({ branchId })
        return allFiles.map((file) => `@${file.githubPath}`).sort()
    })()

    const host = siteBranch.domains.find(
        (x) => x.domainType === 'internalDomain',
    )?.host

    const iframeUrl = new URL(`https://${host}`)
    if (host?.endsWith('.localhost')) {
        iframeUrl.protocol = 'http:'
        iframeUrl.port = '7777'
    }

    const branchId = chat.branchId

    return {
        chatId,
        chat,
        prUrl,
        mentionOptions,
        iframeUrl,
        host,
        branchId,
        siteBranch,
        siteId,
    }
}

export default function Page({
    loaderData,
    params: { siteId, orgId },
}: Route.ComponentProps) {
    const { chat } = loaderData

    const initialState = useMemo<State>(
        () => ({
            lastPushedFiles: (chat.lastPushedFiles as any) || {},
            filesInDraft: chat.filesInDraft as any,
            currentSlug: chat.currentSlug || '',
        }),
        [loaderData],
    )
    const initialChatState = useMemo<Partial<ChatState>>(
        () => ({
            messages: chat.messages.map((x) => {
                const message: UIMessage = {
                    ...x,
                    content: '',
                    parts: x.parts as any,
                }
                return message
            }),
            isGenerating: false,
        }),
        [loaderData],
    )
    return (
        <ChatProvider initialValue={initialChatState}>
            <WebsiteStateProvider initialValue={initialState}>
                <SidebarProvider
                    className='dark:bg-black'
                    style={
                        {
                            '--sidebar-width': '480px',
                            '--sidebar-width-mobile': '20rem',
                        } as any
                    }
                >
                    <AppSidebar />
                    <SidebarInset>
                        <div className='flex grow h-full flex-col gap-4 p-2'>
                            <Content />
                        </div>
                    </SidebarInset>
                </SidebarProvider>
            </WebsiteStateProvider>
        </ChatProvider>
    )
}

function Content() {
    const { chat, iframeUrl, host } = useLoaderData<typeof loader>()
    const siteData = useRouteLoaderData(
        'routes/org.$orgId.site.$siteId',
    ) as SiteRoute.ComponentProps['loaderData']

    const iframeRef = useRef<HTMLIFrameElement>(null)
    useEffect(() => {
        console.log('iframe sidebar remounted')
    }, [])

    return (
        <div className='flex flex-col h-full gap-3'>
            {/* <NavBar /> */}

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
                        ref={iframeRef}
                        onLoad={() => {
                            console.log(`docs iframe is being replaced`)
                            const docsRpcClient = createIframeRpcClient({
                                iframeRef,
                            })

                            const state = {
                                currentSlug: chat.currentSlug || undefined,
                                filesInDraft: (chat.filesInDraft as any) || {},
                            }
                            // do it as soon as the page loads to not wait for the ready message
                            docsRpcClient.setDocsState(state)
                            const waitForFirstMessage = (event) => {
                                if (
                                    iframeRef.current &&
                                    event.source ===
                                        iframeRef.current.contentWindow
                                ) {
                                    docsRpcClient.setDocsState(state)
                                    window.removeEventListener(
                                        'message',
                                        waitForFirstMessage,
                                    )
                                }
                            }
                            window.addEventListener(
                                'message',
                                waitForFirstMessage,
                            )
                        }}
                        key={chat.chatId}
                        style={scaleDownElement(0.9)}
                        className={cn(' inset-0 bg-transparent', 'absolute')}
                        frameBorder={0}
                        allowTransparency={true}
                        name='preview' // tell iframe preview props is enabled
                        title='preview'
                        src={iframeUrl.toString()}
                    ></iframe>
                    {/* {!loaded && (
                      <div className='flex justify-center items-center inset-0 absolute'>
                          <Spinner className='text-gray-600 text-5xl'></Spinner>
                      </div>
                  )} */}
                </BrowserWindow>
            </div>
        </div>
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
