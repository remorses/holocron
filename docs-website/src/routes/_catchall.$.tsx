import { prisma } from 'db'
import { processMdxInServer } from 'docs-website/src/lib/mdx.server'
import { VirtualFile } from 'fumadocs-core/source'
import {
    isRouteErrorResponse,
    useLoaderData,
    useRouteLoaderData,
} from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import { useDocsState } from '../lib/docs-state'
import { processMdxInClient } from '../lib/markdown-runtime'
import { getCacheTagForMediaAsset, getKeyForMediaAsset, s3 } from '../lib/s3'
import type { Route as RootRoute } from '../root'
import type { Route } from './+types/_catchall.$'

import {
    PageArticle,
    PageTOCItems,
    PageTOCPopoverItems,
    PageTOCTitle,
} from 'fumadocs-ui/layouts/docs/page'
import {
    PageBreadcrumb,
    PageFooter,
    PageLastUpdate,
    PageRoot,
    PageTOC,
    PageTOCPopover,
    PageTOCPopoverContent,
    PageTOCPopoverTrigger,
} from 'fumadocs-ui/layouts/docs/page-client'
import {
    ExternalLinkIcon,
    GithubIcon,
    LinkedinIcon,
    MessageCircleIcon,
    TwitterIcon,
} from 'lucide-react'
import { LLMCopyButton, ViewOptions } from '../components/llm'
import { PoweredBy } from '../components/poweredby'
import { Rate } from '../components/rate'
import { DocsJsonType } from '../lib/docs-json'
import { useDocsJson } from '../lib/hooks'
import { LOCALES } from '../lib/locales'
import { Markdown } from '../lib/markdown'
import { getFumadocsClientSource } from '../lib/source'
import { getFilesForSource, getFumadocsSource } from '../lib/source.server'

export function meta({ data, matches }: Route.MetaArgs) {
    if (!data) return {}
    const rootMatch = matches?.find((match) => match?.id === 'root')
    if (!rootMatch?.data) return {}
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

// Global variable to store last successful server loader data
let lastServerLoaderData: any = null

export async function clientLoader({
    params,
    serverLoader,
}: Route.ClientLoaderArgs) {
    const docsState = useDocsState.getState()
    const { filesInDraft } = docsState

    try {
        // Attempt to load server data
        const serverData = await serverLoader()

        // Server loader succeeded, store it and check for overrides
        lastServerLoaderData = serverData

        return serverData
    } catch (err) {
        // Check if this is a 404 error
        if (!isRouteErrorResponse(err) || err.status !== 404) {
            throw err
        }
        // Server loader failed with 404, check if we have draft content to serve
        const slugs = params['*']?.split('/').filter((v) => v.length > 0) || []
        const slug = '/' + slugs.join('/')

        // Look for draft files that could serve this slug
        for (const [githubPath, draft] of Object.entries(filesInDraft)) {
            if (!draft) continue

            const source = await getFumadocsClientSource({
                files: [{ path: githubPath, data: {}, type: 'page' }],
            })
            const page = source.getPage(slugs)
            if (page) {
                const extension = githubPath.endsWith('.mdx') ? 'mdx' : 'md'
                const data = await (async function getData() {
                    while (true) {
                        try {
                            return processMdxInClient({
                                extension,
                                markdown: draft.content,
                            })
                        } catch (e: any) {
                            if (e instanceof Promise) {
                                await e
                            } else {
                                throw e
                            }
                        }
                    }
                })()

                // Use cached server data as base structure, without fields available in root
                const baseData = lastServerLoaderData || {
                    locale: 'en',
                    i18n: null,
                }

                return {
                    ...baseData,
                    toc: data.toc,
                    title: data.title,
                    description: data.description,
                    markdown: draft.content,
                    ast: data.ast,
                    githubPath,
                    slugs,
                    slug,
                    lastEditedAt: new Date(),
                }
            }
        }
    }
}

export async function loader({ params, request }: Route.LoaderArgs) {
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
    const locales = site.locales.map((x) => x.locale)
    const files = await getFilesForSource({ branchId: siteBranch.branchId })
    const source = await getFumadocsSource({
        defaultLocale: site.defaultLocale,
        files,
        locales,
    })

    let slugs = params['*']?.split('/').filter((v) => v.length > 0) || []

    let locale = site.defaultLocale
    if (slugs[0] && LOCALES.includes(slugs[0] as any)) {
        locale = slugs[0]
        slugs = slugs.slice(1)
    }

    // Check for redirects from docsJson configuration
    const docsJson: DocsJsonType = siteBranch.docsJson as any
    if (docsJson?.redirects) {
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
    // const slug = '/' + slugs.join('/')
    const fumadocsPage = source.getPage(slugs, locale)
    if (!fumadocsPage) {
        throw new Response('Page not found', { status: 404 })
    }
    const slug = fumadocsPage.url

    let [page, mediaAsset] = await Promise.all([
        prisma.markdownPage.findFirst({
            where: {
                slug,

                branchId: siteBranch.branchId,
            },
        }),
        prisma.mediaAsset.findFirst({
            where: {
                slug,
                branchId: siteBranch.branchId,
            },
        }),
    ])

    if (!page && mediaAsset) {
        const siteId = site.siteId
        const branchId = siteBranch.branchId
        const key = getKeyForMediaAsset({
            siteId,
            slug,
            branchId,
        })
        const file = s3.file(key)
        const [stat, blob] = await Promise.all([file.stat(), file.blob()])
        throw new Response(blob, {
            headers: {
                'Content-Type': stat.type,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Cache-Tag': getCacheTagForMediaAsset({
                    siteId,
                    slug,
                    branchId,
                }),
                'Content-Length': stat.size.toString(),
            },
        })
    }

    if (!page) {
        // try to find index page if no page found
        let [indexPage, anotherPage] = await Promise.all([
            prisma.markdownPage.findFirst({
                where: {
                    slug: '/index',
                    branchId: siteBranch.branchId,
                },
            }),
            prisma.markdownPage.findFirst({
                where: {
                    branchId: siteBranch.branchId,
                },
                orderBy: {
                    slug: 'asc',
                },
            }),
        ])
        page = indexPage || anotherPage
    }

    if (!page) {
        console.log('Page not found for slug:', slug)
        throw new Response('Page not found', { status: 404 })
    }

    // Check if the current URL ends with .md or .mdx and serve raw markdown
    const currentPath = params['*'] || ''
    if (currentPath.endsWith('.md') || currentPath.endsWith('.mdx')) {
        throw new Response(page.markdown, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'public, max-age=3600',
            },
        })
    }

    const tree = source.getPageTree(locale)

    // fs.writeFileSync('scripts/rendered-mdx.mdx', page.markdown)
    // fs.writeFileSync('scripts/rendered-mdx.jsonc', JSON.stringify(ast, null, 2))

    const { data } = await processMdxInServer({
        extension: page.extension,
        markdown: page.markdown,
    })

    return {
        toc: data.toc,
        title: data.title,
        description: data.description,
        markdown: data.markdown,
        ast: data.ast,
        slugs,
        slug,
        locale,
        i18n: source._i18n,
        githubPath: page.githubPath,
        tree,
        lastEditedAt: page.lastEditedAt || new Date(),
    }
}

export default function Page(props: Route.ComponentProps) {
    return <PageContent {...props} />
}

function PageContent(props: Route.ComponentProps) {
    const loaderData = props.loaderData
    const rootData = useRouteLoaderData(
        'root',
    ) as RootRoute.ComponentProps['loaderData']
    const { slug, slugs, githubPath, lastEditedAt } = loaderData
    const owner = rootData.githubOwner
    const repo = rootData.githubRepo
    const githubBranch = rootData.githubBranch
    const branchId = rootData.branchId
    let { title, description, toc } = useDocsState(
        useShallow((state) => {
            const { title, description } = loaderData
            const toc = state.toc || loaderData.toc
            return { title, description, toc }
        }),
    )
    const githubUrl = `https://github.com/${owner}/${repo}`
    const tableOfContentStyle = 'clerk'

    const docsJson = useDocsJson()

    return (
        <PageRoot
            toc={{
                toc: toc as any,
            }}
        >
            {toc.length > 0 && (
                <PageTOCPopover>
                    <PageTOCPopoverTrigger />
                    <PageTOCPopoverContent>
                        <PageTOCPopoverItems />
                    </PageTOCPopoverContent>
                </PageTOCPopover>
            )}
            <PageArticle className=''>
                <PageBreadcrumb />
                <h1 className='text-3xl font-semibold'>{title}</h1>
                <p className='text-lg text-fd-muted-foreground'>
                    {description}
                </p>
                <div className='flex flex-row gap-2 items-center border-b pb-6'>
                    <LLMCopyButton
                        slug={slugs}
                        contextual={docsJson?.contextual}
                    />
                    <ViewOptions
                        markdownUrl={`${slug}.mdx`}
                        githubUrl={`https://github.com/${owner}/${repo}/blob/${githubBranch}/apps/docs/content/docs/${githubPath}`}
                        contextual={docsJson?.contextual}
                    />
                </div>

                <div className='prose flex-1 text-fd-foreground/80'>
                    <DocsMarkdown />
                </div>
                <div className='grow'></div>
                <Rate
                    onRateAction={async (url, feedback) => {
                        const apiUrl = new URL(
                            '/api/submitRateFeedback',
                            process.env.PUBLIC_URL || 'https://fumabase.com',
                        )
                        const response = await fetch(apiUrl.toString(), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                branchId,
                                url,
                                opinion: feedback.opinion,
                                message: feedback.message,
                            }),
                        })

                        if (!response.ok) {
                            throw new Error('Failed to submit feedback')
                        }

                        const result = await response.json()
                        return { githubUrl: result.githubUrl }
                    }}
                />
                <div className='flex items-center gap-2'>
                    {lastEditedAt && <PageLastUpdate date={lastEditedAt} />}
                    <div className='grow'></div>
                    <PoweredBy />
                </div>

                <Footer footer={docsJson?.footer} />
                <PageFooter />
            </PageArticle>

            <PageTOC>
                <PageTOCTitle />
                <PageTOCItems variant={tableOfContentStyle} />
            </PageTOC>
        </PageRoot>
    )
}

function Footer({ footer }: { footer?: any }) {
    if (!footer) return null

    // Calculate responsive grid columns based on number of link columns
    const numColumns = footer.links?.length || 0
    const gridCols =
        numColumns === 1
            ? 'grid-cols-1'
            : numColumns === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : numColumns === 3
                ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                : numColumns === 4
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                  : numColumns === 5
                    ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6'

    return (
        <div className='flex flex-col gap-4 border-t pt-4'>
            {/* Social Links */}
            {footer.socials && (
                <div className='flex gap-3'>
                    {Object.entries(footer.socials).map(
                        ([platform, url]: [string, any]) => (
                            <a
                                key={platform}
                                href={url}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-fd-muted-foreground hover:text-fd-foreground transition-colors'
                                aria-label={platform}
                            >
                                <SocialIcon platform={platform} />
                            </a>
                        ),
                    )}
                </div>
            )}

            {/* Link Columns */}
            {footer.links && (
                <div className={`grid gap-6 ${gridCols}`}>
                    {footer.links.map((column: any, index: number) => (
                        <div key={index} className='flex flex-col gap-2'>
                            {column.header && (
                                <h4 className='font-medium text-fd-foreground text-sm'>
                                    {column.header}
                                </h4>
                            )}
                            <div className='flex flex-col gap-1'>
                                {column.items.map(
                                    (item: any, itemIndex: number) => (
                                        <a
                                            key={itemIndex}
                                            href={item.href}
                                            target={
                                                item.href.startsWith('http')
                                                    ? '_blank'
                                                    : undefined
                                            }
                                            rel={
                                                item.href.startsWith('http')
                                                    ? 'noopener noreferrer'
                                                    : undefined
                                            }
                                            className='text-sm text-fd-muted-foreground hover:text-fd-foreground transition-colors'
                                        >
                                            {item.label}
                                        </a>
                                    ),
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function SocialIcon({ platform }: { platform: string }) {
    const iconClass = 'w-4 h-4'

    switch (platform.toLowerCase()) {
        case 'github':
            return <GithubIcon className={iconClass} />
        case 'twitter':
        case 'x':
            return <TwitterIcon className={iconClass} />
        case 'discord':
            return <MessageCircleIcon className={iconClass} />
        case 'linkedin':
            return <LinkedinIcon className={iconClass} />
        default:
            return <ExternalLinkIcon className={iconClass} />
    }
}

function DocsMarkdown() {
    const loaderData = useLoaderData<typeof loader>()
    const { isStreaming } = useDocsState(
        useShallow((x) => ({
            isStreaming: x.isMarkdownStreaming,
        })),
    )

    // With clientLoader, draft content is already processed and available in loaderData
    return (
        <Markdown
            previousMarkdown={loaderData.markdown}
            previousAst={loaderData.ast}
            isStreaming={isStreaming}
            addDiffAttributes={true}
            markdown={''}
            ast={loaderData.ast}
        />
    )
}
