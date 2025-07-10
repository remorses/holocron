import { MediaAsset, PageMediaAsset, prisma } from 'db'
import frontMatter from 'front-matter'

import { processMdxInServer } from 'docs-website/src/lib/mdx.server'
import {
    isRouteErrorResponse,
} from 'react-router'

import type { Route as RootRoute } from '../root'
import type { Route } from './+types/_catchall.$'

import { DocsJsonType } from '../lib/docs-json'
import { LOCALES } from '../lib/locales'
import {
    getProcessor,
    ProcessorData,
    ProcessorDataFrontmatter,
} from '../lib/mdx-heavy'
import { getFumadocsSource } from '../lib/source'

import { getOpenapiDocument } from '../lib/openapi.server'
import { getFilesForSource } from '../lib/source.server'
import { useDocsState } from '../lib/docs-state'
import { ClientPage, ClientErrorBoundary } from './_catchall-client'
const openapiPath = `/api-reference`

type MediaAssetProp = PageMediaAsset & { asset?: MediaAsset }

type BaseLoaderData = {
    mediaAssets: MediaAssetProp[]
    toc: any[]
    title: string
    description: string
    markdown: string
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

export async function loader({
    params,
    request,
}: Route.LoaderArgs): Promise<LoaderData> {
    const url = new URL(request.url)
    const domain = url.hostname.split(':')[0]

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

    if (!siteBranch) {
        console.log('Branch not found for site:', site?.siteId)
        throw new Response('Branch not found', { status: 404 })
    }
    const languages = site.locales.map((x) => x.locale)
    const files = await getFilesForSource({
        branchId: siteBranch.branchId,

        githubFolder: siteBranch.site?.githubFolder || '',
    })
    const source = getFumadocsSource({
        defaultLanguage: site.defaultLocale,
        languages: languages,
        files,
    })

    let slugs = params['*']?.split('/').filter((v) => v.length > 0) || []

    let locale = site.defaultLocale
    if (slugs[0] && LOCALES.includes(slugs[0] as any)) {
        locale = slugs[0]
        slugs = slugs.slice(1)
    }

    // Check for redirects from docsJson configuration
    const docsJson: DocsJsonType = siteBranch.docsJson as any

    // const slug = '/' + slugs.join('/')
    const fumadocsPage = source.getPage(slugs, locale)

    const slug = fumadocsPage?.url || '/' + slugs.join('/')

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

    const { openapiUrl, renderer, ...rest } = await getOpenapiDocument({
        docsJson,
        url,
    })
    if (openapiUrl) {
        if (renderer === 'scalar') {
            return {
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
            }
        }
        if (renderer === 'fumadocs') {
            const { type: _, ...restWithoutType } = rest
            return {
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
            }
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

    if (!page) {
        console.log('Page not found for slug:', slug)
        throw new Response(null, {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const tree = source.getPageTree(locale)

    // fs.writeFileSync('scripts/rendered-mdx.mdx', page.markdown)
    // fs.writeFileSync('scripts/rendered-mdx.jsonc', JSON.stringify(ast, null, 2))

    const { data: markdownData } = await processMdxInServer({
        extension: page.extension,
        githubPath: page.githubPath,
        markdown: page.content.markdown,
    })
    const frontmatter = markdownData.frontmatter || {}

    return {
        type: 'page' as const,
        openapiUrl: '',
        toc: markdownData.toc,
        title: markdownData.title || '',
        githubFolder: site.githubFolder || '',
        description: frontmatter.description || '',
        markdown: markdownData.markdown,
        ast: markdownData.ast,
        slugs,
        slug,
        locale,
        i18n: source._i18n,
        githubPath: page.githubPath,
        tree,
        lastEditedAt: page.lastEditedAt || new Date(),
        mediaAssets: page.mediaAssets,
    }
}

export default function Page(props: Route.ComponentProps): any {
    return <ClientPage {...props} />
}







// export function HydrateFallback() {
//     return null
// }

export const clientLoader = async ({
    params,
    serverLoader,
}): Promise<LoaderData> => {
    try {
        // Attempt to load server data
        const serverData = await serverLoader()

        if (serverData && typeof window !== 'undefined') {
            globalThis.lastServerLoaderData = serverData
        }

        return serverData
    } catch (err) {
        const docsState = useDocsState.getState()
        const { filesInDraft } = docsState
        // Check if this is a 404 error
        if (!isRouteErrorResponse(err) || err.status !== 404) {
            // console.log(`forwarding non 404 error`, err)
            throw err
        }
        const slugs = params['*']?.split('/').filter((v) => v.length > 0) || []
        const slug = '/' + slugs.join('/')

        // Server loader failed with 404, check if we have draft content to serve

        const prevLoaderData =
            globalThis.lastServerLoaderData || globalThis.rootServerLoaderData
        console.log(
            `running clientLoader to try fetch 404 page for ${slug}, githubFolder is ${prevLoaderData?.githubFolder}`,
            Object.keys(filesInDraft),
        )
        function removeGithubFolder(p: string) {
            let githubFolder = prevLoaderData?.githubFolder || ''
            if (githubFolder && p.startsWith(githubFolder)) {
                return p.slice(githubFolder.length + 1)
            }
            return p
        }
        // Look for draft files that could serve this slug
        for (const [githubPath, draft] of Object.entries(filesInDraft)) {
            // console.log({ path: removeGithubFolder(githubPath) })
            if (!draft) continue

            const source = getFumadocsSource({
                files: [
                    {
                        path: removeGithubFolder(githubPath),
                        data: {},
                        type: 'page',
                    },
                ],
            })
            const page = source.getPage(slugs)
            if (page) {
                const extension = githubPath.endsWith('.mdx') ? 'mdx' : 'md'
                const f = await getProcessor({ extension })
                    .process(draft.content || '')
                    .catch((e) => {
                        e.markdown = draft.content || ''
                        throw e
                    })
                const data = f.data as ProcessorData

                // Use cached server data as base structure, without fields available in root
                const baseData: {} = prevLoaderData || {
                    locale: 'en',
                    i18n: null,
                }

                const frontmatter: ProcessorDataFrontmatter =
                    (data.frontmatter as any) || {}
                return {
                    openapiUrl: '',
                    githubFolder: '',
                    mediaAssets: [] as MediaAssetProp[],
                    ...baseData,
                    type: 'page' as const,
                    locale: (baseData as any)?.locale || 'en',
                    i18n: (baseData as any)?.i18n || null,
                    tree: (baseData as any)?.tree || null,
                    toc: data.toc,
                    title: frontmatter.title || '',
                    description: frontmatter.description || '',
                    markdown: draft.content || '',
                    ast: data.ast,
                    githubPath,
                    slugs,
                    slug,
                    lastEditedAt: new Date(),
                }
            }
        }
        throw err
    }
}

clientLoader.hydrate = true

export function ErrorBoundary({ error, loaderData, params }: Route.ErrorBoundaryProps) {
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
