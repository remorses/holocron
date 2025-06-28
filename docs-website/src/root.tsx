import { useNProgress } from 'docs-website/src/lib/nprogress'
import { Banner } from 'fumadocs-ui/components/banner'

import { prisma } from 'db'
import { ReactRouterProvider } from 'fumadocs-core/framework/react-router'
import { LinkItemType } from 'fumadocs-ui/layouts/links'
import { DocsLayout } from 'fumadocs-ui/layouts/notebook'
import { RootProvider } from 'fumadocs-ui/provider/base'
import { GithubIcon, XIcon } from 'lucide-react'
import { ThemeProvider, useTheme } from 'next-themes'
import { startTransition, useEffect, useMemo, useState } from 'react'
import {
    isRouteErrorResponse,
    Links,
    Meta,
    Outlet,
    redirect,
    Scripts,
    ScrollRestoration,
    useLoaderData,
} from 'react-router'
import { TrieveSDK } from 'trieve-ts-sdk'
import { useShallow } from 'zustand/react/shallow'
import type { Route } from './+types/root'
import './app.css'
import { DocsJsonType } from './lib/docs-json'
import { DocsState, IframeRpcMessage, useDocsState } from './lib/docs-state'
import { env } from './lib/env'
import { useDocsJson } from './lib/hooks'
import { LOCALE_LABELS } from './lib/locales'
import { Markdown } from './lib/markdown'
import { processMdxInServer } from './lib/mdx.server'
import { getFumadocsSource, getFilesForSource } from './lib/source.server'
import { getFumadocsClientSource } from './lib/source'
import { VirtualFile } from 'fumadocs-core/source'
import frontMatter from 'front-matter'
import { cn, isInsidePreviewIframe } from './lib/utils'

export const links: Route.LinksFunction = () => [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
    },
    {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
    },
]

const allowedOrigins = [env.NEXT_PUBLIC_URL!.replace(/\/$/, '')]

// Helper function to parse cookies from header
function parseCookies(cookieHeader: string | null): Record<string, string> {
    const cookies: Record<string, string> = {}
    if (!cookieHeader) return cookies

    cookieHeader.split(';').forEach((cookie) => {
        const [name, ...rest] = cookie.trim().split('=')
        if (name && rest.length > 0) {
            cookies[name] = decodeURIComponent(rest.join('='))
        }
    })
    return cookies
}

let onFirstStateMessage = () => {}
const firstStateReceived = new Promise<void>((resolve) => {
    onFirstStateMessage = resolve
})

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url)
    const domain = url.hostname.split(':')[0]

    // Handle websocketId in search params - set plain cookie and redirect
    const websocketId = url.searchParams.get('websocketId')
    if (websocketId != null) {
        // Remove websocketId from search params for redirect
        const redirectUrl = new URL(url)
        redirectUrl.searchParams.delete('websocketId')

        // Create a plain Set-Cookie header (session cookie, JS-readable)
        // Explicitly set HttpOnly=false for JavaScript access
        const isSecure = process.env.NODE_ENV === 'production'
        const cookieValue = `__websocket_preview=${encodeURIComponent(websocketId)}; Path=/; HttpOnly=false${isSecure ? '; Secure' : ''}`

        throw redirect(redirectUrl.toString(), {
            headers: {
                'Set-Cookie': cookieValue,
            },
        })
    }

    const siteBranch = await prisma.siteBranch.findFirst({
        where: {
            domains: {
                some: {
                    host: domain,
                },
            },
        },
        include: {
            domains: true,
            site: {
                include: {
                    locales: true,
                },
            },
        },
    })

    const site = siteBranch?.site

    if (!site) {
        console.log('Site not found for domain:', domain)
        throw new Response('Site not found', { status: 404 })
    }

    const files = await getFilesForSource({ branchId: siteBranch.branchId })

    const locales = site.locales.map((x) => x.locale)
    const source = await getFumadocsSource({
        defaultLocale: site.defaultLocale,
        files,
        locales,
    })

    const i18n = source._i18n

    // Process banner markdown if it exists
    let bannerAst: any = null
    const docsJson = siteBranch.docsJson as any
    if (docsJson?.banner?.content) {
        try {
            const { data } = await processMdxInServer({
                extension: '.md',
                githubPath: '',
                markdown: docsJson.banner.content,
            })
            bannerAst = data.ast
        } catch (error) {
            console.error('Error processing banner markdown:', error)
        }
    }

    // Check for preview websocket ID in cookies
    const cookies = parseCookies(request.headers.get('Cookie'))
    const previewWebsocketId = cookies['__websocket_preview'] || null
    const trieveReadApiKey = siteBranch.trieveReadApiKey
    const trieveDatasetId = siteBranch.trieveDatasetId

    return {
        docsJson: siteBranch.docsJson as DocsJsonType,
        locales,
        files,
        i18n,
        name: site.name,
        bannerAst,
        trieveReadApiKey,
        trieveDatasetId,
        previewWebsocketId,
        cssStyles: siteBranch.cssStyles,
        githubOwner: site.githubOwner,
        githubRepo: site.githubRepo,
        githubBranch: siteBranch.githubBranch || 'main',
        branchId: siteBranch.branchId,
        site,
    }
}

async function setDocsStateForMessage(partialState: Partial<DocsState>) {
    const prevState = useDocsState.getState()
    if (
        partialState.currentSlug &&
        prevState.currentSlug !== partialState.currentSlug &&
        partialState.currentSlug !== window.location.pathname
    ) {
        // return await navigate(state.currentSlug!)
        // TODO do client side navigation instead
        window.location.pathname = partialState.currentSlug
    }
    console.log(`setting docs-state inside iframe`, partialState)
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
    if (!isInsidePreviewIframe()) return
    if (globalThis.postMessageHandlingDone) return
    globalThis.postMessageHandlingDone = true
    async function onParentPostMessage(e: MessageEvent) {
        onFirstStateMessage()
        try {
            if (!allowedOrigins.includes(e.origin)) {
                console.warn(
                    `Blocked message from disallowed origin: ${e.origin}`,
                    e.data,
                )
                return
            }
            const data = e.data as IframeRpcMessage
            const { id, state: partialState } = data || {}

            if (partialState) {
                await setDocsStateForMessage(partialState)
            }
        } finally {
            e.source!.postMessage(
                { id: e?.data?.id } satisfies IframeRpcMessage,
                {
                    targetOrigin: '*',
                },
            )
        }
    }
    window.addEventListener('message', onParentPostMessage)
    if (typeof window !== 'undefined') {
        if (window.parent) {
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
        if (typeof window !== 'undefined') {
            if (window.parent) {
                window.parent?.postMessage?.(
                    { type: 'ping' },
                    {
                        targetOrigin: '*',
                    },
                )
            }
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
        const { id, state: partialState } = data || {}
        if (partialState) {
            await setDocsStateForMessage(partialState)
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

export function Layout({ children }: { children: React.ReactNode }) {
    const loaderData = useLoaderData<typeof loader>()
    const { previewWebsocketId } = loaderData
    const docsJson = useDocsJson()
    useNProgress()
    // Inline DocsProvider
    const { i18n, trieveReadApiKey, trieveDatasetId, cssStyles } = loaderData
    const locale = i18n?.defaultLanguage

    if (!trieveClient && trieveReadApiKey) {
        trieveClient = new TrieveSDK({
            apiKey: trieveReadApiKey!,
            datasetId: trieveDatasetId || undefined,
        })
    }

    return (
        <html lang='en' suppressHydrationWarning>
            <head>
                <meta charSet='utf-8' />
                <meta
                    name='viewport'
                    content='width=device-width, initial-scale=1'
                />
                <Meta />

                {process.env.NODE_ENV === 'development' && (
                    <script
                        crossOrigin='anonymous'
                        src='//unpkg.com/react-scan/dist/auto.global.js'
                    />
                )}
                <Links />
                <CSSVariables docsJson={docsJson} />
            </head>
            <body>
                {previewWebsocketId ? (
                    <PreviewBanner websocketId={previewWebsocketId || ''} />
                ) : (
                    <UserBanner banner={docsJson?.banner} />
                )}

                <ReactRouterProvider>
                    <RootProvider
                        search={{
                            options: {},
                            enabled: !!trieveDatasetId,
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
                            <DocsLayoutWrapper docsJson={docsJson}>
                                {children}
                            </DocsLayoutWrapper>
                        </ThemeProvider>
                    </RootProvider>
                </ReactRouterProvider>
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    )
}

function CSSVariables({ docsJson }) {
    const cssVariables = docsJson?.cssVariables

    if (!cssVariables || Object.keys(cssVariables).length === 0) {
        return null
    }

    // Convert cssVariables object to CSS custom properties
    const cssText = Object.entries(cssVariables)
        .map(([key, value]) => {
            // Ensure the key starts with --
            const cssVar = key?.startsWith('--') ? key : `--${key}`
            return `${cssVar}: ${value};`
        })
        .join('\n  ')

    return (
        <style
            dangerouslySetInnerHTML={{
                __html: `:root {\n  ${cssText}\n}`,
            }}
        />
    )
}

let trieveClient: TrieveSDK

export default function App() {
    return <Outlet />
}

function DocsLayoutWrapper({
    children,
    docsJson,
}: {
    children: React.ReactNode
    docsJson: DocsJsonType
}) {
    const loaderData = useLoaderData<typeof loader>()
    const { i18n, previewWebsocketId } = loaderData

    useEffect(() => {
        if (previewWebsocketId) {
            window.dispatchEvent(
                new CustomEvent('startPreviewWebsocket', {
                    detail: { websocketId: previewWebsocketId },
                }),
            )
        }
    }, [])

    // Create tree client-side using files and filesInDraft
    const filesInDraft = useDocsState((state) => state.filesInDraft)

    const tree = useMemo(() => {
        const { files, i18n } = loaderData

        // Create files with filesInDraft included
        const allFiles: VirtualFile[] = [...files]

        // Add files from draft state
        Object.entries(filesInDraft).forEach(([githubPath, fileData]) => {
            if (!fileData) return

            // Determine file type based on extension
            const isMetaFile = githubPath.endsWith('meta.json')
            const isPageFile =
                githubPath.endsWith('.mdx') || githubPath.endsWith('.md')

            if (!isMetaFile && !isPageFile) return

            let draftFile: VirtualFile

            if (isMetaFile) {
                // Parse JSON for meta files
                let jsonData
                try {
                    jsonData = JSON.parse(fileData.content)
                } catch {
                    return // Skip invalid JSON
                }

                draftFile = {
                    data: jsonData,
                    path: githubPath,
                    type: 'meta',
                }
            } else {
                // Parse frontmatter for page files
                const { attributes: frontmatter } = frontMatter(
                    fileData.content,
                )

                draftFile = {
                    data: frontmatter,
                    path: githubPath,
                    type: 'page',
                }
            }

            // Replace existing file or add new one
            const existingIndex = allFiles.findIndex(
                (f) => f.path === githubPath,
            )
            if (existingIndex >= 0) {
                allFiles[existingIndex] = draftFile
            } else {
                allFiles.push(draftFile)
            }
        })

        // Create source and get tree synchronously
        const source = getFumadocsClientSource({
            files: allFiles,
            i18n,
        })

        const tree = source.getPageTree(i18n?.defaultLanguage || 'en')
        // force rerender
        tree.$id = Math.random().toString(36).slice(2)
        // console.log(tree)
        return tree
    }, [loaderData.files, loaderData.i18n, filesInDraft])

    // Configure layout based on docsJson
    const navMode = 'auto'
    const disableThemeSwitch = false
    const navTransparentMode = 'top'
    const searchEnabled = true
    const navTabMode = 'navbar'

    // Build links from docsJson navbar configuration
    const links: LinkItemType[] = (() => {
        const navbarLinks = docsJson?.navbar?.links || []
        const primary = docsJson?.navbar?.primary

        const mainLinks: LinkItemType[] = navbarLinks.map((link: any) => ({
            text: link.label || '',
            url: link.href || '#',
            icon: link.icon,
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

    return (
        <div className='h-full flex flex-col w-full'>
            <DocsLayout
                searchToggle={{
                    enabled: searchEnabled,
                    components: {},
                }}
                // key={Math.random()}
                nav={{
                    mode: navMode,
                    transparentMode: navTransparentMode,
                    title: <Logo docsJson={docsJson} />,
                }}
                tabMode={navTabMode}
                sidebar={{}}
                i18n={i18n}
                tree={tree}
                {...{
                    disableThemeSwitch,
                    links,
                }}
            >
                {children}
            </DocsLayout>
        </div>
    )
}

function PreviewBanner({ websocketId }: { websocketId?: string }) {
    if (!websocketId) return null
    const handleDisconnect = () => {
        // Remove websocketId from search params before reloading
        const url = new URL(window.location.href)
        url.searchParams.set('websocketId', '')
        window.location.href = url.toString()
    }

    const websocketServerPreviewConnected = useDocsState(
        (state) => state.websocketServerPreviewConnected,
    )

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

function UserBanner({ banner }: { banner?: any }) {
    const [dismissed, setDismissed] = useState(false)
    const { bannerAst } = useLoaderData<typeof loader>()

    if (!banner || dismissed) return null

    return (
        <div className='relative bg-fd-primary/10 border border-fd-primary/20 rounded-lg p-4 mb-4'>
            <div className='prose prose-sm text-fd-foreground'>
                <Markdown
                    markdown={banner.content}
                    ast={bannerAst}
                    isStreaming={false}
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
    const { name } = useLoaderData<typeof loader>()
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

    return (
        <img
            alt='logo'
            src={logoImageUrl}
            className='h-8 [.uwu_&]:block'
            aria-label='logo'
        />
    )
}

// Export Route type for other components to use
export type { Route }

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    const containerClass =
        'flex flex-col items-center justify-center min-h-screen px-6 py-12 text-center bg-background text-foreground'
    const titleClass = 'text-3xl font-semibold mb-3 text-primary'
    const messageClass = 'text-base mb-2 text-muted-foreground'
    const preClass =
        'bg-muted text-muted-foreground p-4 rounded-md text-xs text-left overflow-auto w-full border mt-2'
    if (isRouteErrorResponse(error)) {
        return (
            <div className={containerClass}>
                <h1 className={titleClass}>
                    {error.status} {error.statusText}
                </h1>
                <p className={messageClass}>{error.data}</p>
            </div>
        )
    } else if (error instanceof Error) {
        return (
            <div className={containerClass}>
                <h1 className={titleClass}>Error</h1>
                <p className={messageClass}>{error.message}</p>
                <pre className={preClass}>{error.stack}</pre>
            </div>
        )
    } else {
        return (
            <div className={containerClass}>
                <h1 className={titleClass}>Unknown Error</h1>
            </div>
        )
    }
}
