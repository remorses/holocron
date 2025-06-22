import { useShallow } from 'zustand/react/shallow'
import { ThemeProvider, useTheme } from 'next-themes'
import { LargeSearchToggle } from 'fumadocs-ui/components/layout/search-toggle'

import { getCacheTagForMediaAsset, getKeyForMediaAsset, s3 } from '../lib/s3'

import type { Route } from './+types/$'

import { TrieveSDK } from 'trieve-ts-sdk'

import { prisma } from 'db'

// import { DocsLayout,  } from 'fumadocs-ui/layouts/docs'
import { DocsLayout } from 'fumadocs-ui/layouts/notebook'

import {
    DocsBody,
    DocsDescription,
    DocsPage,
    DocsTitle,
} from 'fumadocs-ui/page'

import { processMdxInServer } from 'docs-website/src/lib/mdx.server'
import { TrieveSearchDialog } from 'docs-website/src/trieve/search-dialog-trieve'
import { SharedProps } from 'fumadocs-ui/components/dialog/search'
import { RootProvider } from 'fumadocs-ui/provider/base'
import { useLoaderData } from 'react-router'
import { useDocsState } from '../lib/docs-state'

import { LOCALE_LABELS, LOCALES } from '../lib/locales'
import { Markdown } from '../lib/markdown'
import { getFumadocsSource } from '../lib/source.server'
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
import { Rate } from '../components/rate'
import {
    PageArticle,
    PageTOCItems,
    PageTOCPopoverItems,
    PageTOCTitle,
} from 'fumadocs-ui/layouts/docs/page'
import { buttonVariants } from 'fumadocs-ui/components/ui/button'
import { Sparkles } from 'lucide-react'
import { ButtonHTMLAttributes, useState } from 'react'
import { cn } from '../lib/cn'
import { LinkItemType } from 'fumadocs-ui/layouts/links'
import { PoweredBy } from '../components/poweredby'
import { DocsConfigType } from '../lib/docs-json'

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
        lastEditedAt: page.lastEditedAt || new Date(),
    }
}

let trieveClient: TrieveSDK
export default function Page(props: Route.ComponentProps) {
    return (
        <Providers loaderData={props.loaderData}>
            <MainDocsPage {...props} />
        </Providers>
    )
}

function Providers({
    loaderData,
    children,
}: {
    loaderData: Route.ComponentProps['loaderData']
    children: React.ReactNode
}) {
    const { i18n, tree, toc, locale, site } = loaderData
    if (!trieveClient && site.trieveReadApiKey) {
        trieveClient = new TrieveSDK({
            apiKey: site.trieveReadApiKey!,
            datasetId: site.trieveDatasetId || undefined,
        })
    }

    return (
        <RootProvider
            search={{
                // SearchDialog: CustomSearchDialog,
                options: {},
                enabled: !!site.trieveDatasetId,
            }}
            i18n={{
                locale,
                locales: i18n?.languages.map((locale) => {
                    return { locale, name: LOCALE_LABELS[locale] || '' }
                }),
            }}
        >
            <ThemeProvider
                attribute='class'
                defaultTheme='system'
                enableSystem
                disableTransitionOnChange
            >
                {site.cssStyles && (
                    <style
                        dangerouslySetInnerHTML={{ __html: site.cssStyles }}
                    />
                )}

                {children}
            </ThemeProvider>
        </RootProvider>
    )
}

function MainDocsPage(props: Route.ComponentProps) {
    const loaderData = props.loaderData
    const { i18n, site, slug, slugs, githubPath, lastEditedAt } = loaderData
    const owner = loaderData.githubOwner
    const repo = loaderData.githubRepo
    let { tree, title, description, toc } = useDocsState(
        useShallow((state) => {
            const { title, description } = loaderData
            const tree = state.tree || loaderData.tree
            const toc = state.toc || loaderData.toc
            return { title, description, tree, toc }
        }),
    )
    const githubUrl = `https://github.com/${owner}/${repo}`

    const docsConfig = site.docsJson as any

    // TODO add to docs.json
    const navMode = 'auto'
    // TODO docs.json
    const disableThemeSwitch = false

    // TODO based on docsjson links
    const links: LinkItemType[] = [
        {
            // icon: <AlbumIcon />,
            text: 'Blog',
            url: '/blog',
            active: 'nested-url',
        },

        // {
        //     type: 'icon',
        //     url: 'https://github.com/fuma-nama/fumadocs',
        //     text: 'Github',
        //     icon: (
        //         <svg role='img' viewBox='0 0 24 24' fill='currentColor'>
        //             <path d='M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12' />
        //         </svg>
        //     ),
        //     external: true,
        // },
    ]

    // TODO add this to docs.json
    const navTransparentMode = 'top'

    // TODO add to docs.json
    const searchEnabled = true
    // TODO docs.json
    const navTabMode = 'navbar'
    // TODO
    const tableOfContentStyle = 'clerk'
    return (
        <DocsLayout
            searchToggle={{
                enabled: searchEnabled,
            }}
            nav={{
                mode: navMode,
                transparentMode: navTransparentMode,

                title: <Logo />,
            }}
            // TODO add tabMode to docs.json
            tabMode={navTabMode}
            sidebar={
                {
                    // footer: (
                    //     <div className='flex'>
                    //         <PoweredBy />
                    //     </div>
                    // ),
                    // banner: jsx
                    // tabs: [],
                    //
                }
            }
            i18n={i18n}
            // tabMode='navbar'
            tree={tree as any}
            {...{
                disableThemeSwitch, //
                // githubUrl,
                links,
            }}
        >
            <PageRoot
                toc={{
                    toc: toc as any,
                    // single: false,
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
                        <LLMCopyButton slug={slugs} />
                        <ViewOptions
                            markdownUrl={`${slug}.mdx`}
                            githubUrl={new URL(
                                `/blob/dev/apps/docs/content/docs/${githubPath}`,
                                githubUrl,
                            ).toString()}
                        />
                    </div>

                    <div className='prose flex-1 text-fd-foreground/80'>
                        <DocsMarkdown />
                    </div>
                    <div className='grow'></div>
                    <Rate
                        onRateAction={async () => {
                            // No-op: Fixes signature, but does nothing.
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
        </DocsLayout>
    )
}

function Logo() {
    const loaderData = useLoaderData<typeof loader>()
    const { site } = loaderData

    const { theme = 'light', resolvedTheme = 'light' } = useTheme()
    const currentTheme = resolvedTheme || theme
    const docsConfig = site.docsJson as DocsConfigType

    if (!docsConfig.logo) {
        return (
            <span className='font-medium [.uwu_&]:hidden max-md:hidden'>
                {docsConfig?.name || site.name || 'Documentation'}
            </span>
        )
    }

    const logoImageUrl =
        typeof docsConfig?.logo === 'string'
            ? docsConfig.logo
            : docsConfig?.logo?.[currentTheme] || docsConfig?.logo?.light || ''

    // TODO use docs.json
    let logo = (
        <>
            <img
                alt='logo'
                src={logoImageUrl}
                sizes='100px'
                className='hidden w-20 md:w-24 [.uwu_&]:block'
                aria-label='logo'
            />
        </>
    )
    return logo
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

            return { isStreaming, ast: loaderData.ast, markdown: '' }
        }),
    )

    return <Markdown isStreaming={isStreaming} markdown={markdown} ast={ast} />
}

function CustomSearchDialog(props: SharedProps) {
    return <TrieveSearchDialog trieveClient={trieveClient} {...props} />
}

function AISearchTrigger(props: ButtonHTMLAttributes<HTMLButtonElement>) {
    const [open, setOpen] = useState<boolean>()

    return (
        <>
            <button {...props} onClick={() => setOpen(true)} />
        </>
    )
}
