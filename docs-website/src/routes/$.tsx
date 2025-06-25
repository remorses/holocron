import { useShallow } from 'zustand/react/shallow'
import { getCacheTagForMediaAsset, getKeyForMediaAsset, s3 } from '../lib/s3'
import type { Route } from './+types/$'
import { prisma } from 'db'
import { processMdxInServer } from 'docs-website/src/lib/mdx.server'
import { useLoaderData, useRouteLoaderData } from 'react-router'
import { useDocsState } from '../lib/docs-state'

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
import { LLMCopyButton, ViewOptions } from '../components/llm'
import { PoweredBy } from '../components/poweredby'
import { Rate } from '../components/rate'
import { LOCALES } from '../lib/locales'
import { Markdown } from '../lib/markdown'
import { DocsJsonType } from '../lib/docs-json'

export function meta({ data }: Route.MetaArgs) {
    if (!data) return {}
    const site = data.site
    const docsConfig = site?.docsJson as any
    const suffix = site?.name || ''
    const og = '' // TODO generate og image

    const favicon = (() => {
        if (!docsConfig?.favicon) {
            return undefined
        }
        if (typeof docsConfig.favicon === 'string') {
            return docsConfig.favicon
        }
        if (docsConfig.favicon?.light) {
            return docsConfig.favicon.light
        }
        return undefined
    })()

    return [
        {
            title: data.title
                ? `${data.title}${suffix ? ` - ${suffix}` : ''}`
                : '',
        },
        {
            name: 'description',
            content: data.description || docsConfig?.description,
        },
        ...(og
            ? [
                  { property: 'og:image', content: og },
                  { name: 'twitter:card', content: 'summary_large_image' },
                  { name: 'twitter:image', content: og },
              ]
            : []),
        ...(favicon
            ? [
                  { rel: 'icon', href: favicon },
                  { rel: 'apple-touch-icon', href: favicon },
              ]
            : []),
    ].filter(Boolean)
}

export async function loader({ params, request }: Route.LoaderArgs) {
    const url = new URL(request.url)
    const domain = url.hostname.split(':')[0]

    const site = await prisma.site.findFirst({
        where: {
            domains: {
                some: {
                    host: domain,
                },
            },
        },
        include: {
            domains: true,
            tabs: {
                take: 1,
            },
            locales: true,
        },
    })

    if (!site) {
        console.log('Site not found for domain:', domain)
        throw new Response('Site not found', { status: 404 })
    }

    const tab = site.tabs[0]
    if (!tab) {
        console.log('Tab not found for site:', site?.siteId)
        throw new Response('Tab not found', { status: 404 })
    }
    const locales = site.locales.map((x) => x.locale)
    const { getFumadocsSource } = await import('../lib/source.server')
    const source = await getFumadocsSource({
        defaultLocale: site.defaultLocale,
        tabId: tab.tabId,
        locales,
    })

    let slugs = params['*']?.split('/').filter((v) => v.length > 0) || []

    let locale = site.defaultLocale
    if (slugs[0] && LOCALES.includes(slugs[0] as any)) {
        locale = slugs[0]
        slugs = slugs.slice(1)
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

                tabId: tab.tabId,
            },
        }),
        prisma.mediaAsset.findFirst({
            where: {
                slug,
                tabId: tab.tabId,
            },
        }),
    ])

    if (!page && mediaAsset) {
        const siteId = site.siteId
        const tabId = tab.tabId
        const key = getKeyForMediaAsset({
            siteId,
            slug,
            tabId,
        })
        const file = s3.file(key)
        const [stat, blob] = await Promise.all([file.stat(), file.blob()])
        throw new Response(blob, {
            headers: {
                'Content-Type': stat.type,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Cache-Tag': getCacheTagForMediaAsset({ siteId, slug, tabId }),
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
                    tabId: tab.tabId,
                },
            }),
            prisma.markdownPage.findFirst({
                where: {
                    tabId: tab.tabId,
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

    const docsJson: DocsJsonType = site.docsJson as any
    return {
        ...data,
        slugs,
        slug,
        locale,
        i18n: source._i18n,
        page,
        githubPath: page.githubPath,
        githubOwner: site.githubOwner,
        githubRepo: site.githubRepo,
        tree,
        site,
        docsJson,
        lastEditedAt: page.lastEditedAt || new Date(),
    }
}

export default function Page(props: Route.ComponentProps) {
    return <PageContent {...props} />
}


function PageContent(props: Route.ComponentProps) {
    const loaderData = props.loaderData
    const { slug, slugs, githubPath, lastEditedAt } = loaderData
    const owner = loaderData.githubOwner
    const repo = loaderData.githubRepo
    let { title, description, toc } = useDocsState(
        useShallow((state) => {
            const { title, description } = loaderData
            const toc = state.toc || loaderData.toc
            return { title, description, toc }
        }),
    )
    const githubUrl = `https://github.com/${owner}/${repo}`
    const tableOfContentStyle = 'clerk'
    
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
                    <LLMCopyButton slug={slugs} contextual={loaderData.docsJson?.contextual} />
                    <ViewOptions
                        markdownUrl={`${slug}.mdx`}
                        githubUrl={new URL(
                            `/blob/dev/apps/docs/content/docs/${githubPath}`,
                            githubUrl,
                        ).toString()}
                        contextual={loaderData.docsJson?.contextual}
                    />
                </div>

                <div className='prose flex-1 text-fd-foreground/80'>
                    <DocsMarkdown />
                </div>
                <div className='grow'></div>
                <Rate
                    onRateAction={async () => {
                        return { success: true, githubUrl: '' }
                    }}
                />
                <div className='flex items-center gap-2'>
                    {lastEditedAt && <PageLastUpdate date={lastEditedAt} />}
                    <div className='grow'></div>
                    <PoweredBy />
                </div>

                <PageFooter />
            </PageArticle>

            <PageTOC>
                <PageTOCTitle />
                <PageTOCItems variant={tableOfContentStyle} />
            </PageTOC>
        </PageRoot>
    )
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

    return (
        <Markdown
            previousMarkdown={loaderData.markdown}
            previousAst={loaderData.ast}
            isStreaming={isStreaming}
            addDiffAttributes={true}
            markdown={markdown}
            ast={ast}
        />
    )
}

