import { prisma } from 'db'
import { Outlet } from 'react-router'
import { getSession } from '../lib/better-auth'
import type { Route } from './+types/org.$orgId.branch.$branchId'
import { env } from '../lib/env'

export type { Route }

export async function loader({
  request,
  params: { orgId, branchId },
}: Route.LoaderArgs) {
  // Check if request is aborted early
  if (request.signal.aborted) {
    throw new Error('Request aborted')
  }

  // Get session but don't require it
  const session = await getSession({ request })
  const userId = session.userId || undefined

  // Check signal before database queries
  if (request.signal.aborted) {
    throw new Error('Request aborted')
  }

  // Fetch all data in parallel
  const [siteBranch, chatHistory] = await Promise.all([
    prisma.siteBranch.findFirst({
      where: {
        branchId: branchId,
      },
      select: {
        branchId: true,
        title: true,
        githubBranch: true,
        createdAt: true,
        updatedAt: true,
        lastGithubSyncAt: true,
        lastGithubSyncCommit: true,
        docsJson: true,
        site: {
          select: {
            siteId: true,
            name: true,
            orgId: true,
            visibility: true,
            githubOwner: true,
            githubRepo: true,
            githubFolder: true,
            defaultLocale: true,
            createdAt: true,
            org: {
              select: {
                orgId: true,
                users: {
                  select: {
                    userId: true,
                  },
                },
              },
            },
            githubInstallations: {
              where: {
                appId: env.GITHUB_APP_ID!,
              },
              select: {
                installationId: true,
                appId: true,
              },
            },
          },
        },
      },
    }),
    userId
      ? prisma.chat.findMany({
          where: {
            userId,
            branchId,
          },
          select: {
            chatId: true,
            title: true,
            createdAt: true,
            branch: {
              select: {
                githubBranch: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
  ])

  if (!siteBranch) {
    throw new Error('Branch not found')
  }

  const site = siteBranch.site
  const isPublic = site.visibility === 'public'
  const isOrgMember = userId && site.org.users.some((u) => u.userId === userId)

  // For private sites, require user to be org member
  if (!isPublic && !isOrgMember) {
    throw new Error('Access denied')
  }

  const siteId = site.siteId

  // Now fetch all branches for this site
  const siteBranches = await prisma.siteBranch.findMany({
    where: {
      siteId,
    },
    select: {
      branchId: true,
      githubBranch: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  return {
    site,
    siteId,
    branchId,
    siteBranch,
    chatHistory,
    siteBranches,
  }
}
export function Component({ loaderData }: Route.ComponentProps) {
  return <Outlet />
}
