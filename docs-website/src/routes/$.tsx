import { useShallow } from 'zustand/react/shallow'
import { getCacheTagForMediaAsset, getKeyForMediaAsset, s3 } from '../lib/s3'

import type { Route } from './+types/$'

import { TrieveSDK } from 'trieve-ts-sdk'

import { prisma } from 'db'

import { DocsLayout } from 'fumadocs-ui/layouts/docs'

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
import { Markdown } from '../lib/safe-mdx'
import { getFumadocsSource } from '../lib/source.server'

export function meta({ data }: Route.MetaArgs) {
    if (!data) return {}
    const site = data.site
    const customization = site?.customization
    const suffix = ''
    const og = '' // TODO generate og image
    const favicon = customization?.faviconUrl
    return [
        {
            title: data.title
                ? `${data.title}${suffix ? ` - ${suffix}` : ''}`
                : '',
        },
        { name: 'description', content: data.description },
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
            customization: true,
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

    const tree = source.getPageTree(locale)

    // fs.writeFileSync('scripts/rendered-mdx.mdx', page.markdown)
    // fs.writeFileSync('scripts/rendered-mdx.jsonc', JSON.stringify(ast, null, 2))

    const { data } = await processMdxInServer({
        extension: page.extension,
        markdown: page.markdown,
    })

    return {
        ...data,
        slug,
        locale,
        i18n: source._i18n,
        page,
        githubPath: page.githubPath,

        tree,
        site,
    }
}

let trieveClient: TrieveSDK
export default function Page({ loaderData }: Route.ComponentProps) {
    return (
        <Providers loaderData={loaderData}>
            <MainDocsPage loaderData={loaderData} />
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
            {children}
        </RootProvider>
    )
}
function MainDocsPage({
    loaderData,
}: {
    loaderData: Route.ComponentProps['loaderData']
}) {
    const { i18n, site, slug } = loaderData
    let { tree, title, description, toc } = useDocsState(
        useShallow((state) => {
            const { title, description } = loaderData
            const tree = state.tree || loaderData.tree
            const toc = state.toc || loaderData.toc
            return { title, description, tree, toc }
        }),
    )

    return (
        <DocsLayout
            nav={{
                title: site.name || 'Documentation',
            }}
            i18n={i18n}
            // tabMode='navbar'
            tree={tree as any}
        >
            <DocsPage
                tableOfContentPopover={{ style: 'clerk' }}
                toc={toc as any}
            >
                {title && <DocsTitle>{title}</DocsTitle>}
                {description && (
                    <DocsDescription>{description}</DocsDescription>
                )}
                <DocsBody>
                    <DocsMarkdown />
                </DocsBody>
            </DocsPage>
        </DocsLayout>
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
                    markdown: override.markdown,
                    isStreaming,
                    ast: undefined,
                }
            }
            console.log(`no override for githubPath ${loaderData.githubPath}, using loader data`)
            console.log(filesInDraft)

            return { isStreaming, ast: loaderData.ast, markdown: '' }
        }),
    )

    return <Markdown isStreaming={isStreaming} markdown={markdown} ast={ast} />
}

function CustomSearchDialog(props: SharedProps) {
    return <TrieveSearchDialog trieveClient={trieveClient} {...props} />
}
