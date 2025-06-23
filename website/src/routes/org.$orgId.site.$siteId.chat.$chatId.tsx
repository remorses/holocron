import { prisma } from 'db'
import { DocsState } from 'docs-website/src/lib/docs-state'
import { useEffect, useMemo, useRef, useState, useDeferredValue } from 'react'
import { redirect, useLoaderData, useRouteLoaderData } from 'react-router'
import { AppSidebar } from '../components/app-sidebar'
import { BrowserWindow } from '../components/browser-window'
import NavBar from '../components/navbar'
import { SidebarInset, SidebarProvider } from '../components/ui/sidebar'
import { getSession } from '../lib/better-auth'
import { createIframeRpcClient } from '../lib/docs-setstate'
import { getTabFilesWithoutContents } from '../lib/spiceflow'
import { State, StateProvider } from '../lib/state'
import { cn } from '../lib/utils'
import type { Route } from './+types/org.$orgId.site.$siteId.chat.$chatId'
import type { Route as SiteRoute } from './org.$orgId.site.$siteId'
import type { Route as OrgRoute } from './org.$orgId'

import { UIMessage } from 'ai'

export type { Route }

export async function loader({
    request,
    params: { orgId, siteId, chatId },
}: Route.LoaderArgs) {
    const { userId } = await getSession({ request })

    // Fetch chat and get site with minimal includes for github info and tabs
    const [chat, site] = await Promise.all([
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
        prisma.site.findUnique({
            where: { siteId },
            select: {
                githubOwner: true,
                githubRepo: true,
                tabs: {
                    select: { tabId: true },
                    take: 1,
                },
            },
        }),
    ])

    if (!chat) {
        throw new Error('Chat not found')
    }
    if (!site) {
        throw new Error('Site not found')
    }

    // Create PR URL if chat has a PR number
    const prUrl = chat.prNumber
        ? `https://github.com/${site.githubOwner}/${site.githubRepo}/pull/${chat.prNumber}`
        : undefined

    // Create mention options from site tab pages using getTabFilesWithoutContents
    const mentionOptions: string[] = await (async () => {
        const tabId = site.tabs[0]?.tabId
        if (!tabId) return []

        const allFiles = await getTabFilesWithoutContents({ tabId })
        return allFiles.map((file) => `@${file.githubPath}`).sort()
    })()

    return {
        chatId,
        chat,
        prUrl,
        initialFilesInDraft: chat.filesInDraft as any,
        mentionOptions,
    }
}

export default function Page({
    loaderData,
    params: { siteId, orgId },
}: Route.ComponentProps) {
    const { chat, initialFilesInDraft } = loaderData
    
    // Get parent loader data
    const siteData = useRouteLoaderData('routes/org.$orgId.site.$siteId') as SiteRoute.ComponentProps['loaderData']
    const orgData = useRouteLoaderData('routes/org.$orgId') as OrgRoute.ComponentProps['loaderData']
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
    const { chat } = useLoaderData<typeof loader>()
    const siteData = useRouteLoaderData('routes/org.$orgId.site.$siteId') as SiteRoute.ComponentProps['loaderData']
    const { iframeUrl } = siteData

    const iframeRef = useRef<HTMLIFrameElement>(null)

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

function scaleDownElement(iframeScale) {
    return {
        transform: `scale(${iframeScale})`,
        transformOrigin: 'top left',
        width: `${Number(100 / iframeScale).toFixed(1)}%`,
        height: `${Number(100 / iframeScale).toFixed(1)}%`,
    }
}
