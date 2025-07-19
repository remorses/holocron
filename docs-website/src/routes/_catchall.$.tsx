import { MediaAsset, PageMediaAsset, prisma } from 'db'
import { Root } from 'mdast'
import frontMatter from 'front-matter'
import { parse as parseCookies, serialize as serializeCookie } from 'cookie'

import { processMdxInServer } from 'docs-website/src/lib/mdx.server'
import { isRouteErrorResponse, data } from 'react-router'

import type { Route as RootRoute } from './_catchall'
import type { Route } from './+types/_catchall.$'

import { DocsJsonType } from '../lib/docs-json'
import JSONC from 'tiny-jsonc'
import { LOCALES } from '../lib/locales'
import {
    getProcessor,
    getTocFromMdast,
    ProcessorData,
    ProcessorDataFrontmatter,
} from '../lib/mdx-heavy'
import { getFumadocsSource } from '../lib/source'

import { getOpenapiDocument } from '../lib/openapi.server'
import { getFilesForSource } from '../lib/source.server'
import { ClientPage, ClientErrorBoundary } from './_catchall-$-client'
import { getCacheTagForPage } from 'docs-website/src/lib/cache-tags'
const openapiPath = `/api-reference`

function removeGithubFolder(path: string, githubFolder: string): string {
    if (githubFolder && path.startsWith(githubFolder)) {
        return path.slice(githubFolder.length + 1)
    }
    return path
}

type MediaAssetProp = PageMediaAsset & { asset?: MediaAsset }

type BaseLoaderData = {
    mediaAssets: MediaAssetProp[]
    toc: any[]
    title: string
    description: string
    markdown?: string
    ast: any
    githubPath: string
    slugs: string[]
    slug: string
    lastEditedAt: Date
    githubFolder: string
}

type OpenAPIScalarData = BaseLoaderData & {
    type: 'openapi_scalar'
    openapiUrl: string
}

type OpenAPIFumadocsData = BaseLoaderData & {
    type: 'openapi_fumadocs'
    processedOpenAPI?: any
    operations?: any
    openapiUrl: string
    [key: string]: any
}

type PageData = BaseLoaderData & {
    type: 'page'
    openapiUrl: string
    githubFolder: string
    locale: string
    i18n: any
    tree: any
}

export type LoaderData = OpenAPIScalarData | OpenAPIFumadocsData | PageData

// Extend globalThis to include our type-safe variable
declare global {
    var lastServerLoaderData: LoaderData | null
}

export function meta({ data, matches }: Route.MetaArgs): any {
    if (!data) return []
    const rootMatch = matches?.find((match) => match?.id === 'root')
    if (!rootMatch?.data) return []
    const rootData = rootMatch.data as RootRoute.ComponentProps['loaderData']
    const docsJson = rootData?.docsJson as DocsJsonType
    const suffix = rootData?.name || ''
    const og = '' // TODO generate og image

    const favicon = (() => {
        if (!docsJson?.favicon) {
            return undefined
        }
        if (typeof docsJson.favicon === 'string') {
            return docsJson.favicon
        }
        if (docsJson.favicon?.light) {
            return docsJson.favicon.light
        }
        return undefined
    })()

    const faviconDark = (() => {
        if (!docsJson?.favicon) {
            return undefined
        }
        if (typeof docsJson.favicon === 'string') {
            return docsJson.favicon
        }
        if (docsJson.favicon?.dark) {
            return docsJson.favicon.dark
        }
        return undefined
    })()

    // Custom meta tags from docsJson.seo.metatags
    const customMetaTags = docsJson?.seo?.metatags
        ? Object.entries(docsJson.seo.metatags).map(([name, content]) => ({
              name,
              content,
          }))
        : []

    return [
        {
            title: data.title
                ? `${data.title}${suffix ? ` - ${suffix}` : ''}`
                : '',
        },
        {
            name: 'description',
            content: data.description || docsJson?.description,
        },
        ...customMetaTags,
        ...(og
            ? [
                  { property: 'og:image', content: og },
                  { name: 'twitter:card', content: 'summary_large_image' },
                  { name: 'twitter:image', content: og },
              ]
            : []),
        ...(favicon
            ? [
                  {
                      rel: 'icon',
                      href: favicon,
                      media: '(prefers-color-scheme: light)',
                  },
                  {
                      rel: 'apple-touch-icon',
                      href: favicon,
                      media: '(prefers-color-scheme: light)',
                  },
              ]
            : []),
        ...(faviconDark
            ? [
                  {
                      rel: 'icon',
                      href: faviconDark,
                      media: '(prefers-color-scheme: dark)',
                  },
                  {
                      rel: 'apple-touch-icon',
                      href: faviconDark,
                      media: '(prefers-color-scheme: dark)',
                  },
              ]
            : []),
    ].filter(Boolean)
}

export async function loader({ params, request }: Route.LoaderArgs) {
    const timerId = `loader-${Math.random().toString(36).substr(2, 9)}`
    console.time(`${timerId} - total loader time`)

    const url = new URL(request.url)
    const domain = url.hostname.split(':')[0]

    // Check for chatId in query params and set as cookie if present
    const chatIdFromQuery = url.searchParams.get('chatId')
    
    // Check for chatId cookie to fetch draft files
    const cookieHeader = request.headers.get('Cookie') || ''
    const cookies = parseCookies(cookieHeader)
    const chatId = chatIdFromQuery || cookies.chatId || null

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
        throw new Response('Site not found', { status: 404 })
    }

    if (!siteBranch) {
        console.log('Branch not found for site:', site?.siteId)
        throw new Response('Branch not found', { status: 404 })
    }

    // Fetch chat filesInDraft if chatId cookie exists
    let chatFilesInDraft: Record<string, { content: string }> = {}
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
            chatFilesInDraft = chat.filesInDraft as Record<string, { content: string }>
        }
    }
    const languages = site.locales.map((x) => x.locale)

    console.time(`${timerId} - get files for source`)
    const files = await getFilesForSource({
        branchId: siteBranch.branchId,

        githubFolder: siteBranch.site?.githubFolder || '',
    })
    console.timeEnd(`${timerId} - get files for source`)

    // Add draft files to the files array for navigation tree
    const allFiles = [...files]
    if (Object.keys(chatFilesInDraft).length > 0) {
        const githubFolder = site?.githubFolder || ''

        for (const [githubPath, draft] of Object.entries(chatFilesInDraft)) {
            if (!draft?.content) continue
            
            const normalizedPath = removeGithubFolder(githubPath, githubFolder)
            // Check if this file already exists in the files array
            const existingFileIndex = allFiles.findIndex(f => f.path === normalizedPath)
            
            if (existingFileIndex >= 0) {
                // Update existing file with draft content
                allFiles[existingFileIndex] = {
                    ...allFiles[existingFileIndex],
                    // Note: we don't override the data here as it's used for meta information
                }
            } else {
                // Add new draft file
                allFiles.push({
                    path: normalizedPath,
                    data: {},
                    type: 'page',
                })
            }
        }
    }

    console.time(`${timerId} - create fumadocs source`)
    const source = getFumadocsSource({
        defaultLanguage: site.defaultLocale,
        languages: languages,
        files: allFiles,
    })
    console.timeEnd(`${timerId} - create fumadocs source`)

    let slugs = params['*']?.split('/').filter((v) => v.length > 0) || []

    let locale = site.defaultLocale
    if (slugs[0] && LOCALES.includes(slugs[0] as any)) {
        locale = slugs[0]
        slugs = slugs.slice(1)
    }

    let docsJson: DocsJsonType = siteBranch.docsJson as any

    // Check for draft docsJson file
    if (Object.keys(chatFilesInDraft).length > 0) {
        const draftDocsJsonFile = Object.entries(chatFilesInDraft).find(([path]) => 
            path.endsWith('fumabase.jsonc')
        )
        
        if (draftDocsJsonFile && draftDocsJsonFile[1]?.content) {
            try {
                const parsedDraftDocsJson = JSONC.parse(draftDocsJsonFile[1].content)
                docsJson = parsedDraftDocsJson as DocsJsonType
            } catch (e) {
                console.warn('Failed to parse draft fumabase.jsonc:', e)
            }
        }
    }

    const fumadocsPage = source.getPage(slugs, locale)

    const slug = fumadocsPage?.url || '/' + slugs.join('/')

    console.time(`${timerId} - find markdown page in database`)
    let [page] = await Promise.all([
        prisma.markdownPage.findFirst({
            where: {
                slug,
                branchId: siteBranch.branchId,
            },
            include: {
                content: true,
                mediaAssets: {
                    include: {
                        asset: true,
                    },
                },
            },
        }),
    ])
    console.timeEnd(`${timerId} - find markdown page in database`)

    console.time(`${timerId} - get openapi document`)
    const { openapiUrl, renderer, ...rest } = await getOpenapiDocument({
        docsJson,
        url,
    })
    console.timeEnd(`${timerId} - get openapi document`)
    if (openapiUrl) {
        if (renderer === 'scalar') {
            console.timeEnd(`${timerId} - total loader time`)

            const cacheTag = getCacheTagForPage({
                branchId: siteBranch.branchId,
                slug,
                locale,
            })

            const headers: Record<string, string> = {
                'Cache-Control': 'public, max-age=300, s-maxage=300',
                'Cache-Tag': cacheTag,
            }
            
            if (chatIdFromQuery) {
                headers['Set-Cookie'] = serializeCookie('chatId', chatIdFromQuery, {
                    httpOnly: false, // Make it readable from JS
                    path: '/',
                    sameSite: 'lax',
                })
            }

            return data(
                {
                    type: 'openapi_scalar' as const,
                    openapiUrl,
                    githubFolder: site.githubFolder || '',
                    mediaAssets: [] as MediaAssetProp[],
                    toc: [],
                    title: '',
                    description: '',
                    markdown: '',
                    ast: null,
                    githubPath: '',
                    slugs,
                    slug,
                    lastEditedAt: new Date(),
                },
                {
                    headers,
                },
            )
        }
        if (renderer === 'fumadocs') {
            const { type: _, ...restWithoutType } = rest
            console.timeEnd(`${timerId} - total loader time`)

            const cacheTag = getCacheTagForPage({
                branchId: siteBranch.branchId,
                slug,
                locale,
            })

            const headers: Record<string, string> = {
                'Cache-Control': 'public, max-age=300, s-maxage=300',
                'Cache-Tag': cacheTag,
            }
            
            if (chatIdFromQuery) {
                headers['Set-Cookie'] = serializeCookie('chatId', chatIdFromQuery, {
                    httpOnly: false, // Make it readable from JS
                    path: '/',
                    sameSite: 'lax',
                })
            }

            return data(
                {
                    type: 'openapi_fumadocs' as const,
                    ...restWithoutType,
                    githubFolder: site.githubFolder || '',
                    processedOpenAPI: rest.processedOpenAPI,
                    openapiUrl,
                    mediaAssets: [] as MediaAssetProp[],
                    toc: [],
                    title: '',
                    description: '',
                    markdown: '',
                    ast: null,
                    githubPath: '',
                    slugs,
                    slug,
                    lastEditedAt: new Date(),
                },
                {
                    headers,
                },
            )
        }
    }

    if (!page && docsJson?.redirects) {
        const currentPath = '/' + (params['*'] || '')
        const redirect = docsJson.redirects.find(
            (r) => r.source === currentPath,
        )
        if (redirect) {
            const status = redirect.permanent ? 301 : 302
            throw new Response(null, {
                status,
                headers: {
                    Location: redirect.destination,
                },
            })
        }
    }

    if (!page && slug === '/') {
        // try to find index page if no page found
        let [indexPage, anotherPage] = await Promise.all([
            prisma.markdownPage.findFirst({
                where: {
                    slug: { in: ['/index', '/readme'] },
                    branchId: siteBranch.branchId,
                },
                include: {
                    content: true,
                    mediaAssets: {
                        include: {
                            asset: true,
                        },
                    },
                },
            }),
            prisma.markdownPage.findFirst({
                where: {
                    branchId: siteBranch.branchId,
                },
                orderBy: {
                    slug: 'asc',
                },
                include: {
                    content: true,
                    mediaAssets: {
                        include: {
                            asset: true,
                        },
                    },
                },
            }),
        ])
        page = indexPage || anotherPage
    }

    // Initialize with normal flow values (page content or defaults)
    let markdown = page?.content?.markdown || ''
    let frontmatter: ProcessorDataFrontmatter = (page?.frontmatter as any) || {}
    let ast: Root | null = page?.content?.mdast as any
    let toc: any[] | null = null
    let githubPath = page?.githubPath || ''

    // Override with draft content if available
    if (Object.keys(chatFilesInDraft).length > 0) {
        const githubFolder = site?.githubFolder || ''

        // Look for draft files that could serve this slug
        for (const [draftGithubPath, draft] of Object.entries(chatFilesInDraft)) {
            if (!draft?.content) continue

            const source = getFumadocsSource({
                files: [
                    {
                        path: removeGithubFolder(draftGithubPath, githubFolder),
                        data: {},
                        type: 'page',
                    },
                ],
            })
            const draftPage = source.getPage(slugs)
            if (draftPage) {
                const extension = draftGithubPath.endsWith('.mdx') ? 'mdx' : 'md'
                try {
                    const f = await getProcessor({ extension }).process(draft.content)
                    const data = f.data as ProcessorData
                    
                    markdown = draft.content
                    frontmatter = (data.frontmatter as any) || {}
                    ast = data.ast
                    toc = data.toc
                    githubPath = draftGithubPath
                    break
                } catch (e) {
                    console.warn(`Failed to process draft content for ${draftGithubPath}:`, e)
                }
            }
        }
    }

    if (!page && !markdown) {
        console.log('Page not found for slug:', slug)
        throw new Response('null', {
            status: 404,
            statusText: 'Page not found',
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const tree = source.getPageTree(locale)

    console.timeEnd(`${timerId} - total loader time`)

    // Process AST if not already processed
    if (!ast?.children && markdown) {
        console.time(`${timerId} - process mdx content`)
        // Determine the file extension from the githubPath
        const extension = githubPath?.split('.').pop() || 'mdx'

        const { data: markdownData } = await processMdxInServer({
            extension: extension,
            githubPath: githubPath,
            markdown: markdown,
        })
        console.timeEnd(`${timerId} - process mdx content`)
        ast = markdownData.ast
    }
    
    console.time(`${timerId} - get toc from mdast`)
    if (!toc) {
        toc = getTocFromMdast(ast)
    }
    console.timeEnd(`${timerId} - get toc from mdast`)

    const cacheTag = getCacheTagForPage({
        branchId: siteBranch.branchId,
        slug,
        locale,
    })

    const headers: Record<string, string> = {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'Cache-Tag': cacheTag,
    }
    
    if (chatIdFromQuery) {
        headers['Set-Cookie'] = serializeCookie('chatId', chatIdFromQuery, {
            httpOnly: false, // Make it readable from JS
            path: '/',
            sameSite: 'lax',
        })
    }

    return data(
        {
            type: 'page' as const,
            openapiUrl: '',
            toc: toc,
            title: frontmatter?.title || '',
            description: frontmatter.description || '',
            markdown: markdown,
            ast: ast,
            githubFolder: site.githubFolder || '',
            slugs,
            slug,
            locale,
            i18n: source._i18n,
            githubPath: githubPath,
            tree,
            lastEditedAt: page?.lastEditedAt || new Date(),
            mediaAssets: page?.mediaAssets || [],
        },
        {
            headers,
        },
    )
}

export default function Page(props: Route.ComponentProps): any {
    return <ClientPage {...props} />
}



export function ErrorBoundary({
    error,
    loaderData,
    params,
}: Route.ErrorBoundaryProps) {
    const containerClass =
        'flex flex-col items-center justify-center min-h-screen px-6 py-12 text-center bg-background text-foreground'
    const titleClass = 'text-3xl font-semibold mb-3 text-primary'
    const messageClass = 'text-base mb-2 text-muted-foreground'
    const preClass =
        'bg-muted text-muted-foreground p-4 rounded-md text-xs text-left overflow-auto w-full border mt-2'

    const isRetryableErrorWithClientLoader =
        (isRouteErrorResponse(error) && error.status === 404) ||
        ('markdown' in (error as any) && (error as any).markdown)

    // Handle client-side errors in client component
    if (isRetryableErrorWithClientLoader && error instanceof Error) {
        return <ClientErrorBoundary error={error} />
    }

    if (isRouteErrorResponse(error)) {
        const { status, statusText } = error

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
