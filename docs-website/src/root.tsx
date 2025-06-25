import { useNProgress } from 'docs-website/src/lib/nprogress'
import { ReactRouterProvider } from 'fumadocs-core/framework/react-router'
import {
    isRouteErrorResponse,
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    useNavigate,
    useLoaderData,
} from 'react-router'
import type { Route } from './+types/root'
import './app.css'
import { useParentPostMessage } from './lib/hooks'
import { env } from './lib/env'
import { startTransition, useState } from 'react'
import { IframeRpcMessage, useDocsState } from './lib/docs-state'
import { isInsidePreviewIframe } from './lib/utils'
import { prisma } from 'db'
import { getFumadocsSource } from './lib/source.server'
import { ThemeProvider } from 'next-themes'
import { RootProvider } from 'fumadocs-ui/provider/base'
import { DocsLayout } from 'fumadocs-ui/layouts/notebook'
import { TrieveSDK } from 'trieve-ts-sdk'
import { LOCALE_LABELS } from './lib/locales'
import { LinkItemType } from 'fumadocs-ui/layouts/links'
import { useShallow } from 'zustand/react/shallow'
import {
    GithubIcon,
    TwitterIcon,
    LinkedinIcon,
    MessageCircleIcon,
    ExternalLinkIcon,
} from 'lucide-react'
import { processMdxInServer } from './lib/mdx.server'
import { Markdown } from './lib/markdown'
import { useTheme } from 'next-themes'

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

let onFirstStateMessage = () => {}
const firstStateReceived = new Promise<void>((resolve) => {
    onFirstStateMessage = resolve
})

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url)
    const domain = url.hostname.split(':')[0]

    const site = await prisma.site.findFirst({
        where: {
            domains: {
                some: {
                    host: domain,
                },
            },
        },
        include: {
            domains: true,
            tabs: {
                take: 1,
            },
            locales: true,
        },
    })

    if (!site) {
        console.log('Site not found for domain:', domain)
        throw new Response('Site not found', { status: 404 })
    }

    const tab = site.tabs[0]
    if (!tab) {
        console.log('Tab not found for site:', site?.siteId)
        throw new Response('Tab not found', { status: 404 })
    }

    const locales = site.locales.map((x) => x.locale)
    const source = await getFumadocsSource({
        defaultLocale: site.defaultLocale,
        tabId: tab.tabId,
        locales,
    })

    const tree = source.getPageTree(site.defaultLocale)
    const i18n = source._i18n

    // Process banner markdown if it exists
    let bannerAst: any = null
    const docsJson = site.docsJson as any
    if (docsJson?.banner?.content) {
        try {
            const { data } = await processMdxInServer({
                extension: '.mdx',
                markdown: docsJson.banner.content,
            })
            bannerAst = data.ast
        } catch (error) {
            console.error('Error processing banner markdown:', error)
        }
    }

    return {
        site,
        tab,
        locales,
        tree,
        i18n,
        bannerAst,
    }
}

async function messagesHandling() {
    async function onParentPostMessage(e) {
        onFirstStateMessage()
        try {
            if (!allowedOrigins.includes(e.origin)) {
                console.warn(
                    `Blocked message from disallowed origin: ${e.origin}`,
                )
                return
            }
            const data = e.data as IframeRpcMessage
            const { id, state } = data || {}

            if (state) {
                const prevState = useDocsState.getState()
                if (
                    state.currentSlug &&
                    prevState.currentSlug !== state.currentSlug &&
                    state.currentSlug !== window.location.pathname
                ) {
                    // return await navigate(state.currentSlug!)
                    // TODO do client side navigation instead
                    window.location.pathname = state.currentSlug
                }
                console.log(`setting docs-state inside iframe`, state)
                startTransition(() => {
                    useDocsState.setState(state)
                })
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
    if (typeof window !== 'undefined' && window.parent) {
        window.parent?.postMessage?.(
            { type: 'ready' },
            {
                targetOrigin: '*',
            },
        )
    }
    // Set up ping interval
    const pingInterval = setInterval(() => {
        if (typeof window !== 'undefined' && window.parent) {
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
    messagesHandling()
}

export function Layout({ children }: { children: React.ReactNode }) {
    const navigate = useNavigate()

    // useParentPostMessage(async (e: MessageEvent) => {

    // })
    useNProgress()
    return (
        <html lang='en' suppressHydrationWarning>
            <head>
                <meta charSet='utf-8' />
                <meta
                    name='viewport'
                    content='width=device-width, initial-scale=1'
                />
                <Meta />
                <CSSVariables />
                <script
                    crossOrigin='anonymous'
                    src='//unpkg.com/react-scan/dist/auto.global.js'
                />
                <Links />
            </head>
            <body>
                <ReactRouterProvider>{children}</ReactRouterProvider>
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    )
}

function CSSVariables() {
    const { site } = useLoaderData<typeof loader>()

    // Check for state overrides for docsJson
    const docsJson = useDocsState(
        (state) => state.docsJson || (site.docsJson as any),
    )

    const cssVariables = docsJson?.cssVariables

    if (!cssVariables || Object.keys(cssVariables).length === 0) {
        return null
    }

    // Convert cssVariables object to CSS custom properties
    const cssText = Object.entries(cssVariables)
        .map(([key, value]) => {
            // Ensure the key starts with --
            const cssVar = key.startsWith('--') ? key : `--${key}`
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
    return (
        <DocsProvider>
            <DocsLayoutWrapper>
                <Outlet />
            </DocsLayoutWrapper>
        </DocsProvider>
    )
}

function DocsProvider({ children }: { children: React.ReactNode }) {
    const { site, i18n } = useLoaderData<typeof loader>()
    const locale = site.defaultLocale // Will be updated from child route

    if (!trieveClient && site.trieveReadApiKey) {
        trieveClient = new TrieveSDK({
            apiKey: site.trieveReadApiKey!,
            datasetId: site.trieveDatasetId || undefined,
        })
    }

    return (
        <RootProvider
            search={{
                options: {},
                enabled: !!site.trieveDatasetId,
            }}
            i18n={{
                locale,
                locales: i18n?.languages.map((locale) => {
                    return { locale, name: LOCALE_LABELS[locale] || '' }
                }),
            }}
        >
            <ThemeProvider
                attribute='class'
                defaultTheme='system'
                enableSystem
                disableTransitionOnChange
            >
                {site.cssStyles && (
                    <style
                        dangerouslySetInnerHTML={{ __html: site.cssStyles }}
                    />
                )}
                {children}
            </ThemeProvider>
        </RootProvider>
    )
}

function DocsLayoutWrapper({ children }: { children: React.ReactNode }) {
    const loaderData = useLoaderData<typeof loader>()
    const { site, i18n } = loaderData
    const locale = site.defaultLocale

    // Check for state overrides
    const { tree, docsJson } = useDocsState(
        useShallow((state) => {
            return {
                tree: state.tree || loaderData.tree,
                docsJson: state.docsJson || (site.docsJson as any),
            }
        }),
    )

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
            text: link.label,
            url: link.href,
            icon: link.icon,
            external: !link.href.startsWith('/'),
        }))

        // Add primary CTA if configured
        if (primary) {
            if (primary.type === 'button') {
                mainLinks.push({
                    type: 'button',
                    text: primary.label,
                    url: primary.href,
                    external: !primary.href.startsWith('/'),
                })
            } else if (primary.type === 'github') {
                mainLinks.push({
                    type: 'icon',
                    icon: <GithubIcon className='w-4 h-4' />,
                    text: 'GitHub',
                    url: primary.href,
                    external: true,
                })
            }
        }

        return mainLinks
    })()

    return (
        <DocsLayout
            searchToggle={{
                enabled: searchEnabled,
                components: {},
            }}
            nav={{
                mode: navMode,
                transparentMode: navTransparentMode,
                title: <Logo />,
            }}
            tabMode={navTabMode}
            sidebar={{
                banner: <Banner banner={docsJson?.banner} />,
            }}
            i18n={i18n}
            tree={tree as any}
            {...{
                disableThemeSwitch,
                links,
            }}
        >
            {children}
        </DocsLayout>
    )
}

function Banner({ banner }: { banner?: any }) {
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

function Logo() {
    const { site } = useLoaderData<typeof loader>()
    const { theme, resolvedTheme } = useTheme()

    // Check for state overrides for docsJson
    const { docsJson } = useDocsState(
        useShallow((state) => {
            return {
                docsJson: state.docsJson || (site.docsJson as any),
            }
        }),
    )

    const docsConfig = docsJson
    const currentTheme = resolvedTheme || theme || 'light'

    if (!docsConfig.logo) {
        return (
            <span className='font-medium [.uwu_&]:hidden max-md:hidden'>
                {docsConfig?.name || site.name || 'Documentation'}
            </span>
        )
    }

    const logoImageUrl = (() => {
        if (typeof docsConfig.logo === 'string') {
            return docsConfig.logo
        }

        if (docsConfig.logo?.dark && currentTheme === 'dark') {
            return docsConfig.logo.dark
        }

        return docsConfig.logo?.light || ''
    })()

    return (
        <img
            alt='logo'
            src={logoImageUrl}
            className='hidden h-8 [.uwu_&]:block'
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
