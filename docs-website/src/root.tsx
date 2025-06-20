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
export function Layout({ children }: { children: React.ReactNode }) {
    const navigate = useNavigate()

    useEffect(() => {
        if (typeof window !== 'undefined' && window.parent) {
            window.parent?.postMessage?.(
                { type: 'ready' },
                {
                    targetOrigin: '*',
                },
            )
        }
    }, [])

    useParentPostMessage(async (e: MessageEvent) => {
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
                    prevState.currentSlug !== state.currentSlug
                ) {
                    useDocsState.setState(state)
                    return await navigate(state.currentSlug!)
                }
            }
            console.log(`setting docs-state inside iframe`, state)
        } finally {
            e.source!.postMessage(
                { id: e?.data?.id } satisfies IframeRpcMessage,
                {
                    targetOrigin: '*',
                },
            )
        }
    })
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
    let message = 'Oops!'
    let details = 'An unexpected error occurred.'
    let stack: string | undefined

    if (isRouteErrorResponse(error)) {
        message = error.status === 404 ? '404' : 'Error'
        details = error.data
    } else if (import.meta.env.DEV && error && error instanceof Error) {
        details = error.message
        stack = error.stack
    }

    return (
        <main className='pt-16 p-4 container mx-auto'>
            <h1>{message}</h1>
            <p>{details}</p>
            {stack && (
                <pre className='w-full p-4 overflow-x-auto'>
                    <code>{stack}</code>
                </pre>
            )}
        </main>
    )
}
