import type { Route } from './+types/api.search'
import { createI18nSearchAPI } from 'fumadocs-core/search/server'

import { structure } from 'fumadocs-core/mdx-plugins'
import { createTokenizer } from '@orama/tokenizers/mandarin'
import { getFumadocsSource } from '../lib/source.server'
import { prisma } from 'db'

export async function loader({ request }: Route.LoaderArgs) {
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
            locales: true,
            tabs: true,
        },
    })
    const tabId = site?.tabs[0]?.tabId

    if (!tabId) {
        throw new Response('Tab not found', { status: 404 })
    }

    const defaultLocale = site?.defaultLocale
    const locales = site?.locales.map((x) => x.locale)
    const source = await getFumadocsSource({ tabId, defaultLocale, locales })
    const server = createI18nSearchAPI('advanced', {
        i18n: source._i18n!,
        localeMap: {
            cn: {
                tokenizer: createTokenizer(),
            },
        },
        indexes: source.getLanguages().flatMap((entry) => {
            return entry.pages.map((page) => ({
                id: page.url,
                url: page.url,
                title: page.data.title ?? '',
                description: page.data.description,
                structuredData: page.data.structuredData || {},
                locale: entry.language,
            }))
        }),
    })
    return server.GET(request)
}
