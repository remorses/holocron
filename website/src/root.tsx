import 'website/src/styles/globals.css'
import {
    isRouteErrorResponse,
    Links,
    Meta,
    Outlet,
    redirect,
    Scripts,
    ScrollRestoration,
    useLocation,
} from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export function meta() {
    return [
        { title: 'Holocron' },
        {
            name: 'description',
            content: 'Host Fumadocs websites without effort',
        },
        { rel: 'icon', type: 'image/png', href: '/icon.png' },
    ]
}

const redirectMiddleware: Route.unstable_MiddlewareFunction = async (
    { request },
    next,
) => {
    const url = new URL(request.url)

    const host = url.hostname
    if (host === 'fumabase.com') {
        throw redirect(
            new URL(url.pathname + url.search, env.PUBLIC_URL).toString(),
        )
    }
    return next()
}


export const unstable_middleware: Route.unstable_MiddlewareFunction[] = [
    redirectMiddleware,
]

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html className='h-full flex dark  flex-col grow' lang='en'>
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
                <script
                    defer
                    src='https://assets.onedollarstats.com/stonks.js'
                ></script>
            </head>
            <body className='h-full flex flex-col grow dark:bg-root-background '>
                {children}
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    )
}

import { Route } from './+types/root'
import { useNProgress } from './components/nprogress'
import { env } from './lib/env'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 1,
        },
    },
})

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    const location = useLocation()
    const containerClass =
        'flex flex-col items-center justify-center min-h-screen px-6 py-12 text-center bg-background text-foreground'
    const titleClass = 'text-3xl font-semibold mb-3 text-primary'
    const messageClass = 'text-base mb-2 text-muted-foreground'
    const preClass =
        'bg-muted text-muted-foreground p-4 rounded-md text-xs text-left overflow-auto w-full border mt-2'
    const linkClass = 'text-primary hover:underline mt-4'

    const supportEmail = 'tommy@holocron.so'

    const getMailtoLink = (errorDetails: string) => {
        const subject = encodeURIComponent('Error Report - Holocron')
        const body = encodeURIComponent(
            `Hi,\n\nI encountered the following error:\n\n${errorDetails}\n\nPage URL: ${location.pathname}${location.search}${location.hash}\n\nPlease help!`,
        )
        return `mailto:${supportEmail}?subject=${subject}&body=${body}`
    }

    if (isRouteErrorResponse(error)) {
        const errorDetails = `Error ${error.status} ${error.statusText}: ${error.data}`
        return (
            <div className={containerClass}>
                <h1 className={titleClass}>
                    {error.status} {error.statusText}
                </h1>
                <p className={messageClass}>{error.data}</p>
                <a href={getMailtoLink(errorDetails)} className={linkClass}>
                    Contact support →
                </a>
            </div>
        )
    } else if (error instanceof Error) {
        const errorDetails = `Error: ${error.message}\n\nStack trace:\n${error.stack}`
        return (
            <div className={containerClass}>
                <h1 className={titleClass}>Error</h1>
                <p className={messageClass}>{error.message}</p>
                {error.stack && <pre className={preClass}>{error.stack}</pre>}
                <a href={getMailtoLink(errorDetails)} className={linkClass}>
                    Contact support →
                </a>
            </div>
        )
    } else {
        return (
            <div className={containerClass}>
                <h1 className={titleClass}>Unknown Error</h1>
                <a
                    href={getMailtoLink('Unknown error occurred')}
                    className={linkClass}
                >
                    Contact support →
                </a>
            </div>
        )
    }
}

export default function App() {
    useNProgress()
    return (
        <QueryClientProvider client={queryClient}>
            <Outlet />
        </QueryClientProvider>
    )
}
