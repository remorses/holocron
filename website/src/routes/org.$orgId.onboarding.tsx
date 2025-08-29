import { ulid } from 'ulid'
import { prisma } from 'db'
import { DocsJsonType } from 'docs-website/src/lib/docs-json'
import {
    defaultDocsJsonComments,
    defaultStartingHolocronJson,
} from 'docs-website/src/lib/docs-json-examples'
import { href, redirect } from 'react-router'
import { getSession } from '../lib/better-auth'
import { env } from '../lib/env'
import { assetsFromFilesList, syncSite } from '../lib/sync'
import { slugKebabCaseKeepExtension } from '../lib/utils'
import type { Route } from './+types/org.$orgId.onboarding'

export async function loader({ request, params }: Route.LoaderArgs) {
    const sessionData = await getSession({ request })
    if (sessionData.redirectTo) {
        throw redirect(sessionData.redirectTo)
    }
    const userId = sessionData.userId
    const url = new URL(request.url)
    const siteId = ulid()
    const branchId = ulid()
    const userName = slugKebabCaseKeepExtension(
        sessionData.user?.name || 'holocron',
    )
    const orgId = params.orgId
    let name = `holocron-starter`
    const randomHash = Math.random().toString(36).substring(2, 10)

    const internalHost = `${userName}-${randomHash}.${env.APPS_DOMAIN}`
    const domains =
        process.env.NODE_ENV === 'development'
            ? [`${userName}-${randomHash}.localhost`, internalHost]
            : [internalHost]
    const docsJson: DocsJsonType = {
        ...defaultStartingHolocronJson,
        siteId,
        name,
        domains,
    }
    // Then create the site with the repository ID
    const site = await prisma.site.create({
        data: {
            name,
            siteId,
            orgId: orgId,

            branches: {
                create: {
                    branchId,
                    title: 'Main',
                },
            },
        },
    })

    console.log(`created site ${siteId}`)
    const files = assetsFromFilesList({
        files: [],
        githubFolder: '',
        docsJson,
        docsJsonComments: {
            ...defaultDocsJsonComments,
        },
    })
    const { pageCount } = await syncSite({
        files,
        githubFolder: site.githubFolder,
        branchId,
        siteId,
        name: `${userName} docs`,
        docsJson,
    })

    // Create a chat for the branch
    const chat = await prisma.chat.create({
        data: {
            userId,
            branchId,
        },
    })
    const chatId = chat.chatId
    throw redirect(
        href('/org/:orgId/branch/:branchId/chat/:chatId', {
            orgId,
            branchId,
            chatId,
        }),
    )
}
