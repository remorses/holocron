import { MediaAsset, PageMediaAsset, prisma } from 'db'
import { processMdxInServer } from 'docs-website/src/lib/mdx.server'
import { APIPage } from 'fumadocs-openapi/ui'
import {
    data,
    isRouteErrorResponse,
    useLoaderData,
    useRouteLoaderData,
} from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import { useDocsState } from '../lib/docs-state'

import type { Route as RootRoute } from '../root'
import type { Route } from './+types/_catchall.$'

import { Markdown } from 'contesto/src/lib/markdown'
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
import { AskAIButton, LLMCopyButton, ViewOptions } from '../components/llm'
import { mdxComponents } from '../components/mdx-components'
import { PoweredBy } from '../components/poweredby'
import { Rate } from '../components/rate'
import { DocsJsonType } from '../lib/docs-json'
import { useDocsJson } from '../lib/hooks'
import { LOCALES } from '../lib/locales'
import {
    getProcessor,
    ProcessorData,
    ProcessorDataFrontmatter,
} from '../lib/mdx-heavy'
import { getFumadocsSource } from '../lib/source'

import { diffWordsWithSpace } from 'diff'
import { markAddedNodes } from '../lib/diff'
import { MarkdownRuntime } from '../lib/markdown-runtime'
import { renderNode } from '../lib/mdx-code-block'
import { useAddedHighlighter } from '../lib/_diff'
import { useScrollToFirstAddedIfAtTop } from '../lib/diff-highlight'
import { getFilesForSource } from '../lib/source.server'
import { getOpenapiDocument, getOpenapiUrl } from '../lib/openapi.server'
import { ScalarOpenApi } from '../components/scalar'
import { APIPageInner } from 'fumadocs-openapi/render/api-page-inner'
const openapiPath = `/api-reference`

type MediaAssetProp = PageMediaAsset & { asset?: MediaAsset }

export function meta({ data, matches }: Route.MetaArgs) {
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
            return {
                type: 'openapi_fumadocs' as const,
                ...rest,
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
        title: markdownData.title,
        githubFolder: site.githubFolder,
        description: frontmatter.description,
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

export default function Page(props: Route.ComponentProps) {
    const { type } = props.loaderData
    const rootData = useRouteLoaderData(
        'root',
    ) as RootRoute.ComponentProps['loaderData']
    const docsJson = rootData?.docsJson as DocsJsonType

    if (type === 'openapi_scalar') {
        const { openapiUrl } = props.loaderData

        return <ScalarOpenApi url={openapiUrl} />
    }
    if (props.loaderData.type === 'openapi_fumadocs') {
        const { openapiUrl, processedOpenAPI, operations } = props.loaderData
        return <div>api</div>
        // return (
        //     <APIPageInner
        //         {...{
        //             processed: processedOpenAPI,
        //             hasHead: true,
        //             operations,
        //             // disablePlayground: true,
        //         }}
        //     />
        // )
    }
    return <PageContent {...props} />
}

function PageContent(props: Route.ComponentProps) {
    const loaderData = props.loaderData
    const rootData = useRouteLoaderData(
        'root',
    ) as RootRoute.ComponentProps['loaderData']
    const { slug, slugs, githubPath, lastEditedAt } = loaderData || {}
    const owner = rootData.githubOwner
    const repo = rootData.githubRepo
    const githubBranch = rootData.githubBranch
    const branchId = rootData.branchId
    let { title, description, toc } = useDocsState(
        useShallow((state) => {
            const { title, description } = loaderData || {}
            const toc = state.toc || loaderData?.toc
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
            {toc?.length > 0 && (
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
                        githubUrl={`https://github.com/${owner}/${repo}/blob/${githubBranch}/${githubPath}`}
                        contextual={docsJson?.contextual}
                    />
                    <AskAIButton />
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

const components = {
    ...mdxComponents,
    // TODO do the same for Image?
    img(props) {
        const src = props.src || ''
        const { mediaAssets } =
            useLoaderData() as Route.ComponentProps['loaderData']

        const media = mediaAssets.find((asset) => asset.assetSlug === src)

        if (media) {
            return (
                <mdxComponents.img
                    width={media.asset?.width}
                    height={media.asset?.height}
                    {...props}
                />
            )
        }
        return <mdxComponents.img {...props} />
    },
}

function DocsMarkdown() {
    const loaderData = useLoaderData<typeof loader>()
    let { ast, markdown, isStreaming } = useDocsState(
        useShallow((x) => {
            const { filesInDraft, isMarkdownStreaming: isStreaming } = x

            const override = filesInDraft[loaderData.githubPath]

            if (override) {
                return {
                    markdown: override.content,
                    isStreaming,
                    ast: undefined,
                }
            }
            console.log(
                `no override for githubPath ${loaderData.githubPath}, using loader data`,
            )

            return {
                isStreaming,

                ast: loaderData.ast,
                markdown: '',
            }
        }),
    )
    const showDiff = true
    useScrollToFirstAddedIfAtTop({ enabled: showDiff })
    useAddedHighlighter({ enabled: showDiff })
    const extension = loaderData.githubPath.split('.').pop()

    if (!ast) {
        const previousMarkdown = loaderData.markdown
        // console.log(markdown)
        return (
            <MarkdownRuntime
                {...{
                    extension,
                    isStreaming,
                    showDiff,
                    markdown,
                    previousMarkdown,
                }}
            />
        )
    }
    return (
        <Markdown
            isStreaming={false}
            markdown={markdown}
            renderNode={renderNode}
            components={components}
            ast={ast}
        />
    )
}

// Global variable to store last successful server loader data
let lastServerLoaderData = null as any

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

        function removeGithubFolder(p) {
            let githubFolder = lastServerLoaderData?.githubFolder || ''
            if (p.startsWith(githubFolder)) {
                return p.slice(githubFolder.length + 1)
            }
            return p
        }
        // Look for draft files that could serve this slug
        for (const [githubPath, draft] of Object.entries(filesInDraft)) {
            if (!draft) continue

            const source = getFumadocsSource({
                ...lastServerLoaderData?.i18n,
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
                const f = await getProcessor({ extension }).process(draft)
                const data = f.data as ProcessorData

                // Use cached server data as base structure, without fields available in root
                const baseData: {} = lastServerLoaderData || {
                    locale: 'en',
                    i18n: null,
                }

                const frontmatter: ProcessorDataFrontmatter =
                    (data.frontmatter as any) || {}
                return {
                    ...baseData,
                    mediaAssets: [] as MediaAssetProp[],
                    type: 'page' as const,
                    toc: data.toc,
                    title: frontmatter.title,
                    description: frontmatter.description,
                    markdown: draft.content,
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
