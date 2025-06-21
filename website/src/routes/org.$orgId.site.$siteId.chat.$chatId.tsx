import { prisma } from 'db'
import { DocsState } from 'docs-website/src/lib/docs-state'
import { useEffect, useMemo, useRef, useState, useDeferredValue } from 'react'
import { redirect, useLoaderData } from 'react-router'
import { AppSidebar } from '../components/app-sidebar'
import { BrowserWindow } from '../components/browser-window'
import NavBar from '../components/navbar'
import { SidebarInset, SidebarProvider } from '../components/ui/sidebar'
import { getSession } from '../lib/better-auth'
import { createIframeRpcClient } from '../lib/docs-setstate'
import { State, StateProvider } from '../lib/state'
import { cn } from '../lib/utils'
import type { Route } from './+types/org.$orgId.site.$siteId.chat.$chatId'

import { UIMessage } from 'ai'

export type { Route }

export async function loader({
    request,
    params: { orgId, siteId, chatId },
}: Route.LoaderArgs) {
    const { userId, redirectTo } = await getSession({ request })
    if (redirectTo) {
        throw redirect(redirectTo)
    }
    // Check if user has access to this site through org membership
    const orgUser = await prisma.orgsUsers.findUnique({
        where: {
            userId_orgId: {
                userId: userId!,
                orgId: orgId,
            },
        },
    })

    if (!orgUser) {
        throw redirect('/dashboard')
    }
    const [site, chat, chatHistory, userSites] = await Promise.all([
        prisma.site.findUnique({
            where: {
                siteId: siteId,
                org: {
                    users: {
                        some: { userId },
                    },
                },
            },
            include: {
                org: true,
                domains: true,
                tabs: true,
                customization: true,
            },
        }),
        prisma.chat.findUnique({
            where: {
                chatId: chatId,
                siteId,
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
        prisma.chat.findMany({
            where: {
                siteId,
                userId,
            },
            select: {
                chatId: true,
                title: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.site.findMany({
            where: {
                org: {
                    users: {
                        some: {
                            userId,
                        },
                    },
                },
            },
            include: {
                org: true,
                // customization: true,
            },
            orderBy: {
                name: 'asc',
            },
        }),
    ])

    if (!site) {
        throw new Error('Site not found')
    }
    if (!chat) {
        throw new Error('Chat not found')
    }

    const host = site.domains.find(
        (x) => x.domainType === 'internalDomain',
    )?.host

    const iframeUrl = new URL(`https://${host}`)
    if (host?.endsWith('.localhost')) {
        iframeUrl.protocol = 'http:'
        iframeUrl.port = '7777'
    }

    const tabId = site.tabs[0].tabId

    // Create PR URL if chat has a PR number
    const prUrl = chat.prNumber
        ? `https://github.com/${site.githubOwner}/${site.githubRepo}/pull/${chat.prNumber}`
        : undefined

    return {
        site,
        iframeUrl,
        host,
        siteId,
        tabId,
        chatId,
        chat,
        chatHistory,
        userSites,
        prUrl,
        initialFilesInDraft: chat.filesInDraft as any,
    }
}

export default function Page({
    loaderData,
    params: { siteId, orgId },
}: Route.ComponentProps) {
    const { chat, site, host, initialFilesInDraft } = loaderData
    const initialState = useMemo<State>(
        () => ({
            messages: chat.messages.map((x) => {
                const message: UIMessage = {
                    ...x,
                    content: '',
                    parts: x.parts as any,
                }
                return message
            }),
            lastPushedFiles: (chat.lastPushedFiles as any) || {},
            isChatGenerating: false,
            docsState: {
                filesInDraft: chat.filesInDraft as any,
                currentSlug: chat.currentSlug || undefined,
            },
            initialFilesInDraft,
        }),
        [loaderData],
    )
    return (
        <StateProvider initialValue={initialState}>
            <SidebarProvider
                className=''
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
        </StateProvider>
    )
}

function Content() {
    const { site, host, chat, iframeUrl } = useLoaderData<typeof loader>()
    const [logoUrl, setLogoUrl] = useState(site.customization?.logoUrl)
    const iframeRef = useRef<HTMLIFrameElement>(null)

    const [color, setColor] = useState(site.customization?.color || '')
    useEffect(() => {
        updatePageProps({ logoUrl, color: color || undefined }, iframeRef)
    }, [color, logoUrl])
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
                        ref={(el) => {
                            iframeRef.current = el
                            console.log(`docs iframe is being replaced`)
                            const docsRpcClient = createIframeRpcClient({
                                iframeRef,
                            })

                            const waitForFirstMessage = (event) => {
                                if (
                                    iframeRef.current &&
                                    event.source ===
                                        iframeRef.current.contentWindow
                                ) {
                                    docsRpcClient.setDocsState({
                                        currentSlug:
                                            chat.currentSlug || undefined,
                                        filesInDraft:
                                            (chat.filesInDraft as any) || {},
                                    })
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

                            return docsRpcClient.cleanup
                        }}
                        key={chat.chatId}
                        style={scaleDownElement(0.9)}
                        className={cn(' inset-0 bg-transparent', 'absolute')}
                        frameBorder={0}
                        allowTransparency={true}
                        name='preview' // tell iframe preview props is enabled
                        title='website preview'
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

type SiteData = any

function updatePageProps(newPageProps: Partial<SiteData>, iframeRef) {
    if (!iframeRef?.current || !newPageProps) {
        console.log('updatePageProps: no iframeElement or newPageProps')
        return
    }
    iframeRef?.current?.contentWindow.postMessage(
        { newPageProps },
        { targetOrigin: '*' },
    )
}

function scaleDownElement(iframeScale) {
    return {
        transform: `scale(${iframeScale})`,
        transformOrigin: 'top left',
        width: `${Number(100 / iframeScale).toFixed(1)}%`,
        height: `${Number(100 / iframeScale).toFixed(1)}%`,
    }
}
