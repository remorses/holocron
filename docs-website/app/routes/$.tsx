import type { Route } from '.react-router/types/app/routes/+types/$'
import { ReactPortal } from 'react'
import fs from 'fs'

import { TrieveSDK } from 'trieve-ts-sdk'

import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'

import { generateToc } from '@/lib/toc'
import { prisma } from 'db'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'

import defaultMdxComponents from 'fumadocs-ui/mdx'
import {
    DocsBody,
    DocsDescription,
    DocsPage,
    DocsTitle,
} from 'fumadocs-ui/page'
import { SafeMdxRenderer, type CustomTransformer } from 'safe-mdx/src/safe-mdx'

import { Suspense } from 'react'

import { processMdx } from '@/lib/mdx'
import { buildTree } from '@/lib/tree'
import { TrieveSearchDialog } from '@/trieve/search-dialog-trieve'
import { SharedProps } from 'fumadocs-ui/components/dialog/search'
import { RootProvider } from 'fumadocs-ui/provider/base'
import { mdxComponents } from '@/components/mdx-components'
import { PageTree } from 'fumadocs-core/server'
export function meta({ data }: Route.MetaArgs) {
    const site = data.site
    const customization = site?.customization
    const suffix = customization?.seoTitleSuffix || ''
    const og = data.page.ogImage
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
            customization: true,
            analytics: true,
            aiCustomization: true,
        },
    })

    if (!site) {
        console.log('Site not found for domain:', domain)
        throw new Response('Site not found', { status: 404 })
    }

    const tab = site.tabs[0]
    if (!tab) {
        console.log('Tab not found for site:', site?.id)
        throw new Response('Tab not found', { status: 404 })
    }

    const slugs = params['*']?.split('/').filter((v) => v.length > 0) || []
    const slug = '/' + slugs.join('/')

    let page = await prisma.markdownPage.findFirst({
        where: {
            slug,
            tabId: tab.tabId,
        },
    })

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

    const allPages = await prisma.markdownPage.findMany({
        where: {
            tabId: tab.tabId,
        },
        omit: {
            frontmatter: true,
            markdown: true,
            description: true,
        },
    })

    const tree = buildTree(allPages)
    // console.log('tree', tree)


    // fs.writeFileSync('scripts/rendered-mdx.mdx', page.markdown)
    // fs.writeFileSync('scripts/rendered-mdx.jsonc', JSON.stringify(ast, null, 2))

    const title = file.data.title || page.title || ''
    const description =
        file.data.description ||
        // page.frontmatter?.description ||
        page.description ||
        ''

    const tableOfContents = generateToc(ast)

    return {
        page,
        ast,
        title,
        description,
        toc: tableOfContents,
        tree,
        site,
    }
}


let trieveClient: TrieveSDK

export default function Page({ loaderData }: Route.ComponentProps) {
    const { page, ast, toc, tree, site, title, description } = loaderData
    if (!trieveClient && site.trieveReadApiKey) {
        trieveClient = new TrieveSDK({
            apiKey: site.trieveReadApiKey!,
            datasetId: site.trieveDatasetId || undefined,
        })
    }

    return (
        <RootProvider
            search={{
                SearchDialog: CustomSearchDialog,
                enabled: !!site.trieveDatasetId,
            }}
        >
            <DocsLayout
                nav={{
                    title: site.name || 'Documentation',
                }}
                // tabMode='navbar'
                tree={tree as PageTree.Root}
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
                        <Suspense fallback={<div>Loading...</div>}>

                        </Suspense>
                    </DocsBody>
                </DocsPage>
            </DocsLayout>
        </RootProvider>
    )
}

function CustomSearchDialog(props: SharedProps) {
    return (
        <TrieveSearchDialog
            showTrieve={false}
            trieveClient={trieveClient}
            {...props}
        />
    )
}
