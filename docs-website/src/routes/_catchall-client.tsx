'use client'

import React from 'react'
import { useNProgress } from 'docs-website/src/lib/nprogress'
import { Banner } from 'fumadocs-ui/components/banner'
import { FrameworkProvider } from 'fumadocs-core/framework'
import { LinkItemType } from 'fumadocs-ui/layouts/links'
import { DocsLayout as DocsLayoutNotebook } from 'fumadocs-ui/layouts/notebook'
import type { Option } from 'fumadocs-ui/components/layout/root-toggle'
import { RootProvider } from 'fumadocs-ui/provider/base'
import { GithubIcon, XIcon } from 'lucide-react'
import { ThemeProvider, useTheme } from 'next-themes'
import {
    lazy,
    startTransition,
    useEffect,
    useMemo,
    useState,
    useSyncExternalStore,
} from 'react'
import {
    Outlet,
    useLoaderData,
    useNavigation,
    useRevalidator,
    useSearchParams,
    useLocation,
    useNavigate,
    useParams,
} from 'react-router'
import {
    PreservedSearchLink,
    usePreservedNavigate,
    setGlobalNavigate,
    globalNavigate,
} from '../components/preserved-search-link'
import { useShallow } from 'zustand/react/shallow'
import type { Route } from './_catchall'

import { DocsJsonType } from '../lib/docs-json'
import {
    DocsState,
    IframeRpcMessage,
    useDocsState,
    usePersistentDocsState,
} from '../lib/docs-state'
import { useDocsJson } from '../lib/hooks'
import { useDebouncedEffect } from '../lib/hooks-debounced'
import JSONC from 'tiny-jsonc'
import { LOCALE_LABELS } from '../lib/locales'
import { Markdown } from 'contesto/src/lib/markdown'
import { mdxComponents } from '../components/mdx-components'
import { cn, isInsidePreviewIframe } from '../lib/utils'
import { DynamicIcon } from '../lib/icon'
import { PoweredBy } from '../components/poweredby'
import { CustomSearchDialog } from '../components/search'
import { getTreeFromFiles } from '../lib/tree'
import { getPageTreeForOpenAPI } from '../lib/openapi-client'
import { env } from '../lib/env'
import { useQuery } from '@tanstack/react-query'

const ChatDrawer = lazy(() =>
    import('../components/docs-chat').then((mod) => ({
        default: mod.ChatDrawer,
    })),
)

function ChatDrawerWrapper() {
    const drawerState = usePersistentDocsState((x) => x.drawerState)
    if (drawerState === 'closed') return null
    return <ChatDrawer />
}

const openapiPath = `/api-reference`

const allowedOrigins = [
    env.NEXT_PUBLIC_URL!.replace(/\/$/, ''),
    'http://localhost:7664',
]

let onFirstStateMessage = () => {}
const firstStateReceived = new Promise<void>((resolve) => {
    onFirstStateMessage = resolve
})

async function setDocsStateForMessage(partialState: Partial<DocsState>) {
    const prevState = useDocsState.getState()
    if (
        partialState.currentSlug &&
        prevState.currentSlug !== partialState.currentSlug &&
        partialState.currentSlug !== window.location.pathname
    ) {
        // Use global navigate to preserve search params
        globalNavigate(partialState.currentSlug)
    }
    console.log(`setting docs-state from parent message state`, partialState)
    startTransition(() => {
        useDocsState.setState({
            ...partialState,
            filesInDraft: {
                ...prevState?.filesInDraft,
                ...partialState.filesInDraft,
            },
        })
    })
}

async function iframeMessagesHandling() {
    if (!isInsidePreviewIframe()) {
        console.log(`not inside preview iframe, not connecting to postMessage`)
        return
    }
    if (globalThis.postMessageHandlingDone) return
    globalThis.postMessageHandlingDone = true
    console.log(`docs iframe starts listening on message events`)
    async function onParentPostMessage(e: MessageEvent) {
        onFirstStateMessage()
        if (!allowedOrigins.includes(e.origin)) {
            console.warn(
                `ignoring message from disallowed origin: ${e.origin}`,
                allowedOrigins,
                e.data,
            )
            return
        }
        try {
            const data = e.data as IframeRpcMessage
            const { id, revalidate, state: partialState } = data || {}

            if (partialState) {
                await setDocsStateForMessage(partialState)
            }
            if (revalidate) {
                // TODO should i wait for revalidate to finish or not? if i wait updates will come slower from website
                await revalidator?.revalidate()
            }
        } finally {
            // Only reply if not the same window (i.e., not itself)
            if (e.source && e.source !== window) {
                e.source.postMessage(
                    { id: e?.data?.id } satisfies IframeRpcMessage,
                    {
                        targetOrigin: '*',
                    },
                )
            }
        }
    }
    window.addEventListener('message', onParentPostMessage)
    if (typeof window !== 'undefined') {
        if (window.parent !== window) {
            window.parent?.postMessage?.(
                { type: 'ready' },
                {
                    targetOrigin: '*',
                },
            )
        }
    }
    // Set up ping interval
    setInterval(() => {
        if (typeof window !== 'undefined' && window.parent !== window) {
            window.parent?.postMessage?.(
                { type: 'ping' },
                {
                    targetOrigin: '*',
                },
            )
        }
    }, 500)
}

if (typeof window !== 'undefined') {
    iframeMessagesHandling()
}

declare global {
    interface Window {
        websocketHandlingDone?: boolean
        postMessageHandlingDone?: boolean
    }
}

// Function for handling websocket connection based on session cookie
async function websocketIdHandling(websocketId: string) {
    if (isInsidePreviewIframe()) {
        console.log('inside preview iframe, skipping websocket connection')
        return
    }
    if (typeof window === 'undefined') return
    if (globalThis.websocketHandlingDone) return
    globalThis.websocketHandlingDone = true

    console.log('connecting over preview websocketId', websocketId)
    const websocketUrl = `wss://fumabase.com/_tunnel/client?id=${websocketId}`
    const ws = new WebSocket(websocketUrl)
    ws.onopen = () => {
        useDocsState.setState({
            websocketServerPreviewConnected: true,
        })
        ws.send(JSON.stringify({ type: 'ready' }))
    }
    ws.onclose = () => {
        useDocsState.setState({
            websocketServerPreviewConnected: false,
        })
    }
    ws.onmessage = async (event) => {
        let data: IframeRpcMessage
        try {
            data = JSON.parse(event.data)
        } catch {
            console.error(`websocket sent invalid json`, event.data)
            return
        }
        const { id, revalidate, state: partialState } = data || {}
        if (partialState) {
            await setDocsStateForMessage(partialState)
        }
        if (revalidate) {
            await revalidator?.revalidate()
        }
        ws.send(JSON.stringify({ id } satisfies IframeRpcMessage))
    }
    // ping interval
    setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
        }
    }, 1000)
}

if (typeof window !== 'undefined') {
    window.addEventListener(
        'startPreviewWebsocket',
        (e: any) => {
            const websocketId = e?.detail?.websocketId
            if (websocketId) {
                websocketIdHandling(websocketId)
            }
        },
        { once: true },
    )
}

let revalidator: ReturnType<typeof useRevalidator> | null = null

export function ClientLayout({ children }: { children: React.ReactNode }) {
    const loaderData = useLoaderData<Route.ComponentProps['loaderData']>()

    if (loaderData && typeof window !== 'undefined') {
        globalThis.rootServerLoaderData = loaderData
    }
    const { previewWebsocketId, editorPreviewMode } = loaderData || {}

    // Initialize docs state with editor preview mode if provided
    useEffect(() => {
        if (editorPreviewMode) {
            useDocsState.setState({ previewMode: 'editor' })
        }
    }, [editorPreviewMode])

    const localRevalidator = useRevalidator()
    revalidator = localRevalidator


    const navigation = useNavigation()

    useEffect(() => {
        let currentSlug = navigation.location?.pathname

        // Only postMessage if we're in an iframe
        if (window.parent !== window && currentSlug) {
            window.parent?.postMessage?.(
                {
                    id: Math.random().toString(36).slice(2),
                    state: { currentSlug },
                } satisfies IframeRpcMessage,
                {
                    targetOrigin: '*',
                },
            )
        }
    }, [navigation.location?.pathname])

    useEffect(() => {
        console.log(`remounting docs layout`, { previewWebsocketId })
        if (previewWebsocketId) {
            window.dispatchEvent(
                new CustomEvent('startPreviewWebsocket', {
                    detail: { websocketId: previewWebsocketId },
                }),
            )
        }
    }, [])
    return children
}

export function CSSVariables({ docsJson }: { docsJson: DocsJsonType }) {
    // Always expect { dark, light }
    const cssVariables = docsJson?.cssVariables
    if (!cssVariables) return null
    const { dark, light } = cssVariables

    // Early return if both missing
    if (!light && !dark) return null

    // Helper to build var block
    const toCssBlock = (obj: Record<string, string> | undefined) =>
        obj
            ? Object.entries(obj)
                  .map(([key, value]) => {
                      const cssVar = key.startsWith('--') ? key : `--${key}`
                      return `${cssVar}: ${value} !important;`
                  })
                  .join('\n  ')
            : ''

    // Don't render if both empty
    if (
        (!light || Object.keys(light).length === 0) &&
        (!dark || Object.keys(dark).length === 0)
    ) {
        return null
    }

    let styleStr = ''
    if (light && Object.keys(light).length > 0) {
        styleStr += `:root {\n  ${toCssBlock(light)}\n}`
    }
    if (dark && Object.keys(dark).length > 0) {
        if (styleStr) styleStr += '\n'
        styleStr += `.dark {\n  ${toCssBlock(dark)}\n}`
    }

    return (
        <style
            dangerouslySetInnerHTML={{
                __html: styleStr,
            }}
        />
    )
}

export function ClientApp() {
    const loaderData = useLoaderData<Route.ComponentProps['loaderData']>()
    const { previewWebsocketId } = loaderData || {}
    const docsJson = useDocsJson()
    useNProgress()
    // Inline DocsProvider
    const { i18n, cssStyles, themeCSS: initialThemeCSS } = loaderData || {}
    const locale = i18n?.defaultLanguage

    // Use React Query to dynamically import theme CSS
    const { data: themeCSS = initialThemeCSS || '' } = useQuery({
        queryKey: ['theme-css', docsJson?.theme],
        queryFn: async () => {
            if (!docsJson?.theme) return ''

            try {
                // Dynamically import themeModules
                const { themeModules } = await import('../lib/themes')
                if (themeModules[docsJson.theme]) {
                    return themeModules[docsJson.theme]
                } else {
                    console.error(`cannot find theme css for ${docsJson.theme}`)
                    return ''
                }
            } catch (error) {
                console.error(`Failed to load theme ${docsJson?.theme}:`, error)
                return ''
            }
        },
        enabled: !!docsJson?.theme,
        staleTime: Infinity, // Theme CSS doesn't change often
    })



    return (
        <>
            <CSSVariables docsJson={docsJson} />
            {previewWebsocketId ? (
                <PreviewBanner websocketId={previewWebsocketId || ''} />
            ) : (
                <UserBanner docsJson={docsJson} />
            )}

            <CustomReactRouterProvider>
                <RootProvider
                    search={{
                        options: {},
                        SearchDialog: CustomSearchDialog,
                    }}
                    i18n={{
                        locale: locale || '',
                        locales: i18n?.languages.map((locale) => {
                            return {
                                locale,
                                name: LOCALE_LABELS[locale] || '',
                            }
                        }),
                    }}
                >
                    <ThemeProvider
                        attribute='class'
                        defaultTheme='system'
                        enableSystem
                        disableTransitionOnChange
                    >
                        {cssStyles && (
                            <style
                                dangerouslySetInnerHTML={{
                                    __html: cssStyles,
                                }}
                            />
                        )}
                        {themeCSS && (
                            <style
                                dangerouslySetInnerHTML={{
                                    __html: themeCSS,
                                }}
                            />
                        )}
                        <ChatDrawerWrapper />
                        <DocsLayoutWrapper docsJson={docsJson}>
                            <Outlet />
                        </DocsLayoutWrapper>
                    </ThemeProvider>
                </RootProvider>
            </CustomReactRouterProvider>
        </>
    )
}

function DocsLayoutWrapper({
    children,
    docsJson,
}: {
    children: React.ReactNode
    docsJson: DocsJsonType
}) {
    const loaderData = useLoaderData<Route.ComponentProps['loaderData']>() || {}
    const { i18n, previewWebsocketId, openapiUrl } = loaderData

    // Create tree client-side using files and filesInDraft
    const filesInDraft = useDocsState((state) => state.filesInDraft)

    const tree = useMemo(() => {
        const { files, i18n, openapiUrl, githubFolder, processedOpenAPI } =
            loaderData
        if (processedOpenAPI?.document) {
            const pageTree = getPageTreeForOpenAPI({
                docsJson,
                openapiDocument: processedOpenAPI?.document! as any,
                filesInDraft,
            })
            return pageTree
        }
        return getTreeFromFiles({
            files,
            defaultLanguage: i18n?.defaultLanguage || 'en',
            languages: i18n?.languages || [],
            githubFolder,
            filesInDraft,
        })
    }, [loaderData.files, loaderData.i18n, filesInDraft])

    // Configure layout based on docsJson
    let navMode = 'auto' as 'top' | 'auto'
    if (docsJson.hideSidebar) {
        navMode = 'top' as const
    }
    const disableThemeSwitch = false
    const navTransparentMode = 'top'
    const searchEnabled = true
    let navTabMode = 'navbar' as 'sidebar' | 'navbar'

    // Build links from docsJson navbar configuration
    const links: LinkItemType[] = (() => {
        const navbarLinks = docsJson?.navbar?.links || []
        const primary = docsJson?.navbar?.primary

        const mainLinks: LinkItemType[] = navbarLinks.map((link: any) => ({
            text: link.label || '',
            type: 'main',
            url: link.href || '#',
            icon: <DynamicIcon name={link.icon} />,
            external: !link.href?.startsWith('/'),
        }))

        // Add primary CTA if configured
        if (primary) {
            if (primary.type === 'button') {
                mainLinks.push({
                    type: 'button',
                    text: primary.label || '',
                    url: primary.href || '#',
                    external: !primary.href?.startsWith('/'),
                })
            } else if (primary.type === 'github') {
                mainLinks.push({
                    type: 'icon',
                    icon: <GithubIcon className='w-4 h-4' />,
                    text: 'GitHub',
                    url: primary.href || '#',
                    external: true,
                })
            }
        }

        return mainLinks
    })()

    // Build tabs from docsJson if present
    const tabs: Option[] = (() => {
        if (!docsJson?.tabs) return []

        const tabs = docsJson.tabs
            .map((tab) => {
                if ('openapi' in tab) {
                    // OpenAPI tab
                    return {
                        title: tab.tab,
                        url: openapiPath,
                        description: `API Reference`,
                    }
                }
                return null
            })
            .filter(Boolean) as Option[]
        if (tabs.length) {
            tabs.unshift({
                title: 'Docs',
                url: '/',
                description: '',
            })
        }
        return tabs
    })()

    return (
        <div className='h-full flex flex-col w-full'>
            {docsJson?.hideSidebar && (
                <style>{`
                    #nd-sidebar { display: none !important; }
                    article.docs-page-article { padding-left: 1rem;  }
                    * { --fd-layout-width: 10160px !important; --fd-page-width: 1100px !important; }
                    button[aria-label="Collapse Sidebar"] { display: none !important; }
                    * { --fd-sidebar-width: 0px !important; }
                `}</style>
            )}
            <DocsLayoutNotebook
                searchToggle={{
                    enabled: searchEnabled,
                    components: {},
                }}
                nav={{
                    mode: navMode,
                    transparentMode: navTransparentMode,
                    title: <Logo docsJson={docsJson} />,
                }}
                tabMode={navTabMode}
                sidebar={{
                    defaultOpenLevel: 2,
                    collapsible: true,

                    tabs,
                    footer: (
                        <div className='flex w-full text-center grow justify-center items-start'>
                            <PoweredBy className='text-[12x]' />
                        </div>
                    ),
                }}
                i18n={i18n}
                tree={tree}
                {...{
                    disableThemeSwitch,
                    links,
                }}
            >
                {children}
            </DocsLayoutNotebook>
        </div>
    )
}

const noop = (callback: () => void) => {
    return () => {}
}

function PreviewBanner({ websocketId }: { websocketId?: string }) {
    if (!websocketId) return null
    const handleDisconnect = () => {
        // Remove websocketId from search params before reloading
        const url = new URL(window.location.href)
        url.searchParams.set('websocketId', '')
        globalNavigate(url.pathname + url.search)
    }

    const websocketServerPreviewConnected = useDocsState(
        (state) => state.websocketServerPreviewConnected,
    )

    const shouldShow = useSyncExternalStore(
        noop,
        () => !isInsidePreviewIframe(), // client snapshot
        () => true, // server snapshot
    )
    if (!shouldShow) {
        return null
    }

    return (
        <Banner className='sticky top-0 z-50 bg-fd-muted text-fd-accent-foreground isolate px-4 py-1 flex items-center justify-between'>
            <div className='flex items-center gap-2'>
                <div
                    className={cn(
                        'w-2 h-2 rounded-full animate-pulse',
                        websocketServerPreviewConnected
                            ? 'bg-green-500'
                            : 'bg-red-500',
                    )}
                ></div>
                <span className='font-medium text-sm'>
                    {websocketServerPreviewConnected
                        ? 'Connected to local preview. Added content will be highlighted green'
                        : 'Server disconnected. Please restart the preview server'}
                </span>
            </div>
            <button
                onClick={handleDisconnect}
                className='flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-sm transition-colors'
                aria-label='Disconnect from preview'
            >
                <XIcon className='w-3 h-3' />
                Disconnect
            </button>
        </Banner>
    )
}

function UserBanner({ docsJson }: { docsJson?: any }) {
    const [dismissed, setDismissed] = useState(false)
    const { bannerAst } =
        useLoaderData<Route.ComponentProps['loaderData']>() || {}
    const banner = docsJson?.banner

    if (!banner || dismissed) return null

    return (
        <div className='relative bg-fd-primary/10 border border-fd-primary/20 rounded-lg p-4 mb-4'>
            <div className='prose prose-sm text-fd-foreground'>
                <Markdown
                    markdown={banner.content}
                    ast={bannerAst}
                    isStreaming={false}
                    components={mdxComponents}
                />
            </div>
            {banner.dismissible && (
                <button
                    onClick={() => {
                        setDismissed(true)
                    }}
                    className='absolute top-2 right-2 p-1 rounded hover:bg-fd-primary/20 transition-colors'
                    aria-label='Dismiss banner'
                >
                    <svg
                        className='w-4 h-4'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                    >
                        <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M6 18L18 6M6 6l12 12'
                        />
                    </svg>
                </button>
            )}
        </div>
    )
}

function Logo({ docsJson = {} as DocsJsonType }) {
    const { name } = useLoaderData<Route.ComponentProps['loaderData']>()
    const { theme, resolvedTheme } = useTheme()

    const currentTheme = resolvedTheme || theme || 'light'

    if (!docsJson.logo) {
        return (
            <span className='font-medium [.uwu_&]:hidden max-md:hidden'>
                {docsJson?.name || name || 'Documentation'}
            </span>
        )
    }

    const logoImageUrl = (() => {
        if (typeof docsJson.logo === 'string') {
            return docsJson.logo
        }

        if (docsJson.logo?.dark && currentTheme === 'dark') {
            return docsJson.logo.dark
        }

        return docsJson.logo?.light || ''
    })()
    const logoText = docsJson.logo?.text || ''

    return (
        <div className='flex gap-2 grow items-center'>
            {logoImageUrl && (
                <img
                    alt='logo'
                    src={logoImageUrl}
                    suppressHydrationWarning
                    className='h-8 [.uwu_&]:block'
                    aria-label='logo'
                />
            )}
            {logoText && (
                <span className='font-medium text-lg max-md:hidden'>
                    {logoText}
                </span>
            )}
        </div>
    )
}

// Custom React Router Provider with preserved search params
function CustomReactRouterProvider({
    children,
}: {
    children: React.ReactNode
}) {
    const location = useLocation()
    const navigate = useNavigate()
    const params = useParams()
    const revalidator = useRevalidator()
    const preservedNavigate = usePreservedNavigate()

    // Set the global navigate function
    useEffect(() => {
        setGlobalNavigate(preservedNavigate)
    }, [preservedNavigate])

    const framework = useMemo(
        () => ({
            usePathname() {
                return location.pathname
            },
            useParams() {
                // Convert React Router params to fumadocs expected format
                const result: Record<string, string | string[]> = {}
                for (const [key, value] of Object.entries(params)) {
                    if (value !== undefined) {
                        result[key] = value
                    }
                }
                return result
            },
            useRouter() {
                return {
                    push(url: string) {
                        preservedNavigate(url)
                    },
                    refresh() {
                        void revalidator.revalidate()
                    },
                }
            },
            Link({ href, prefetch, ...props }: any) {
                return (
                    <PreservedSearchLink
                        to={href}
                        prefetch={prefetch ? 'intent' : 'none'}
                        {...props}
                    />
                )
            },
        }),
        [location.pathname, params, preservedNavigate, revalidator],
    )

    return <FrameworkProvider {...framework}>{children}</FrameworkProvider>
}

// Extend globalThis to include our type-safe variable
declare global {
    var rootServerLoaderData: Route.ComponentProps['loaderData'] | null
}
