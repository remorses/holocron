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
} from 'react-router'
import type { Route } from './+types/root'
import './app.css'
import { useParentPostMessage } from './lib/hooks'
import { env } from './lib/env'
import { startTransition, useEffect } from 'react'
import { IframeRpcMessage, useDocsState } from './lib/docs-state'

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

export const clientLoader = async () => {
    await firstStateReceived
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
                useDocsState.setState(state)
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

export default function App() {
    return <Outlet />
}

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
