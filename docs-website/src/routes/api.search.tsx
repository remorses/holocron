import type { Route } from './+types/api.search'

import { prisma } from 'db'
import { searchDocsWithSearchApi } from '../lib/search-api-search'
import type { FileUpdate } from '../lib/edit-tool'
import { getHost } from '../lib/get-host'

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const domain = getHost(request)

  const params = url.searchParams
  const query = params.get('query') || ''
  const locale = params.get('locale') || ''
  const tag = params.get('tag') || ''
  const chatId = params.get('chatId') || ''

  const [siteBranch, chat] = await Promise.all([
    prisma.siteBranch.findFirst({
      where: {
        domains: {
          some: {
            host: domain,
          },
        },
      },
      include: {
        site: {
          include: {
            locales: true,
          },
        },
      },
    }),
    chatId
      ? prisma.chat.findFirst({
          where: {
            chatId,
          },
        })
      : Promise.resolve(null),
  ])

  const site = siteBranch?.site
  const branchId = siteBranch?.branchId

  if (!branchId || !site) {
    throw new Response('Branch not found', { status: 404 })
  }

  const defaultLanguage = site?.defaultLocale
  const languages = site?.locales?.map((x) => x.locale)

  let filesInDraft: Record<string, FileUpdate> | undefined

  if (chat?.filesInDraft && chat.branchId === branchId) {
    filesInDraft = chat.filesInDraft as Record<string, FileUpdate>
  }

  const results = await searchDocsWithSearchApi({
    branchId: branchId,
    query,
    filesInDraft,
  })
  return new Response(JSON.stringify(results, null, 2), {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
