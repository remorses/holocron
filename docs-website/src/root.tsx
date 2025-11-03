import { Meta, Links, Outlet, ScrollRestoration, Scripts } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Route } from './+types/root'
import { imageLoader } from './lib/image-loader'
import { serveRawMarkdown } from './lib/serve-raw-markdown.server'
import { withoutBasePath } from './lib/utils'
import './lib/mount-importmap'
import './app.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
    },
  },
})

const mediaExtensions = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'ico',
  'mp4',
  'webm',
  'mov',
  'avi',
  'mp3',
  'wav',
  'ogg',
  'pdf',
  'doc',
  'docx',
  'zip',
]

const markdownTextMiddleware: Route.MiddlewareFunction = async ({ request }, next) => {
  const url = new URL(request.url)
  const path = withoutBasePath(url.pathname)
  const host = url.hostname

  if (path.endsWith('.md') || path.endsWith('.mdx')) {
    const showLineNumbers =
      url.searchParams.get('showLineNumbers') != null && url.searchParams.get('showLineNumbers') !== 'false'
    const startLine = url.searchParams.get('startLine') ? parseInt(url.searchParams.get('startLine')!, 10) : undefined
    const endLine = url.searchParams.get('endLine') ? parseInt(url.searchParams.get('endLine')!, 10) : undefined

    const result = await serveRawMarkdown({
      domain: host,
      path,
      showLineNumbers,
      startLine,
      endLine,
    })

    if (result != null) {
      return new Response(result.markdown, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=300, s-maxage=300',
          'Cache-Tag': result.cacheTag,
        },
      })
    }
  }

  const hasMediaExtension = mediaExtensions.some((ext) => path.endsWith('.' + ext))
  if (hasMediaExtension) {
    return await imageLoader({ request })
  }

  return next()
}

export const middleware = [markdownTextMiddleware]

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <meta charSet='utf-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <Meta />

        {process.env.NODE_ENV === 'development' && (
          <script crossOrigin='anonymous' src='//unpkg.com/react-scan/dist/auto.global.js' />
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
