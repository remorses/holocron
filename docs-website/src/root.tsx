import { Meta, Links, Outlet, ScrollRestoration, Scripts } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './app.css'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 10, // 10 minutes
        },
    },
})

export function Layout({ children }: { children: React.ReactNode }) {
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
            </head>
            <body>
                <ScrollRestoration />
                <Scripts />
                {children}
            </body>
        </html>
    )
}

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <Outlet />
        </QueryClientProvider>
    )
}
