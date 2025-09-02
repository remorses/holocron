import React from 'react'
import { parse as parseCookies, serialize as serializeCookie } from 'cookie'

import { loader as fumadocsLoader } from 'fumadocs-core/source'
import { prisma } from 'db'
import {
    data,
    isRouteErrorResponse,
    Links,
    Meta,
    redirect,
    Scripts,
    ScrollRestoration,
} from 'react-router'
// @ts-ignore
import type { Route } from './+types/root'
import { DocsJsonType } from 'docs-website/src/lib/docs-json'
import JSONC from 'tiny-jsonc'

import { processMdxInServer } from 'docs-website/src/lib/mdx.server'
import { getFilesForSource } from 'docs-website/src/lib/source.server'
import { getFumadocsSource } from 'docs-website/src/lib/source'
import { getOpenapiDocument } from 'docs-website/src/lib/openapi.server'
import {
    ClientLayout,
    ClientApp,
} from 'docs-website/src/routes/_catchall-client'
import { FilesInDraft } from '../lib/docs-state'
import { getDocsJson } from '../lib/utils'
import { themeModules } from '../lib/themes'

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

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url)
    const timerId = `root-loader-${Math.random().toString(36).substr(2, 9)}`
    console.time(`${timerId} - total root loader time`)

    const cookieHeader = request.headers.get('Cookie') || ''
    const cookies = parseCookies(cookieHeader)
    const chatId = cookies.chatId || url.searchParams.get('chatId')
    console.log(`${timerId} - cookies:`, { chatId })

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

    // Check signal before database queries
    if (request.signal.aborted) {
        throw new Error('Request aborted')
    }

    console.time(`${timerId} - find site branch from database`)
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
    console.timeEnd(`${timerId} - find site branch from database`)

    const site = siteBranch?.site

    if (!site) {
        console.log('Site not found for domain:', domain)
        throw new Response('null', {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    if (request.signal.aborted) {
        throw new Error('Request aborted')
    }
    let filesInDraft: FilesInDraft = {}
    if (chatId) {
        console.time(`${timerId} - fetch chat for draft files`)
        const chat = await prisma.chat.findFirst({
            where: {
                chatId,
                branchId: siteBranch.branchId,
            },
            select: {
                filesInDraft: true,
            },
        })
        console.timeEnd(`${timerId} - fetch chat for draft files`)

        if (chat && chat.filesInDraft) {
            filesInDraft = chat.filesInDraft as any
        }
    }

    console.time(`${timerId} - get files for source`)
    const files = await getFilesForSource({
        branchId: siteBranch.branchId,
        filesInDraft,
        githubFolder: site.githubFolder || '',
    })
    console.timeEnd(`${timerId} - get files for source`)

    const languages = site.locales.map((x) => x.locale)

    console.time(`${timerId} - create fumadocs source`)
    const source = getFumadocsSource({
        defaultLanguage: site.defaultLocale,
        files,
        languages: languages,
    })
    console.timeEnd(`${timerId} - create fumadocs source`)

    const i18n = source._i18n

    const docsJson = getDocsJson({
        filesInDraft,
        docsJson: siteBranch.docsJson,
    })

    // Check signal before processing banner
    if (request.signal.aborted) {
        throw new Error('Request aborted')
    }

    console.time(`${timerId} - process banner markdown`)
    let bannerAst = await (async () => {
        if (docsJson?.banner?.content) {
            try {
                const { data } = await processMdxInServer({
                    extension: '.md',
                    githubPath: '',
                    markdown: docsJson.banner.content,
                })
                return data?.ast
            } catch (error) {
                console.error('Error processing banner markdown:', error)
            }
        }
        return null
    })()
    console.timeEnd(`${timerId} - process banner markdown`)

    // Check for preview websocket ID in cookies

    const previewWebsocketId = cookies['__websocket_preview'] || null

    // Check signal before openapi processing
    if (request.signal.aborted) {
        throw new Error('Request aborted')
    }

    console.time(`${timerId} - get openapi document`)
    const {
        openapiUrl,
        renderer: openapiRenderer,
        ...rest
    } = await getOpenapiDocument({
        docsJson,
        url,
    })
    console.timeEnd(`${timerId} - get openapi document`)

    // Get theme CSS if theme is specified
    const themeCSS = (() => {
        if (docsJson.theme) {
            if (themeModules[docsJson.theme]) {
                return themeModules[docsJson.theme]
            } else {
                console.error(`cannot find theme css for ${docsJson.theme}`)
            }
        }
        return ''
    })()

    // Check for editor preview mode query parameter
    const editorPreviewMode =
        url.searchParams.get('editorPreviewMode') === 'true'

    console.timeEnd(`${timerId} - total root loader time`)
    return {
        openapiUrl,
        openapiRenderer,
        ...rest,
        docsJson: siteBranch.docsJson as DocsJsonType,
        languages,
        files,
        i18n,
        name: site.name,
        githubFolder: site.githubFolder,
        bannerAst,
        previewWebsocketId,
        cssStyles: siteBranch.cssStyles,
        githubOwner: site.githubOwner,
        githubRepo: site.githubRepo,
        githubBranch: siteBranch.githubBranch || 'main',
        branchId: siteBranch.branchId,
        site,
        themeCSS,
        editorPreviewMode,
    }
}

export default function App() {
    return (
        <ClientLayout>
            <ClientApp />
        </ClientLayout>
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

    // Check if we're in a chat context
    const url =
        typeof window !== 'undefined' ? new URL(window.location.href) : null
    const chatId = url?.searchParams.get('chatId')

    if (isRouteErrorResponse(error)) {
        const { status, statusText } = error

        // Show "page building in progress" message for 404 errors when in chat
        if (status === 404 && chatId) {
            return (
                <div className={containerClass}>
                    <h1 className={titleClass}>Page in construction...</h1>
                </div>
            )
        }

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
