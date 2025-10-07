import { prisma } from 'db'
import { Outlet } from 'react-router'
import { getSession } from '../lib/better-auth'
import type { Route } from './+types/org.$orgId'
import { ClientOnly } from 'website/src/components/client-only'
import { KnownError } from '../lib/errors'

export type { Route }

export async function loader({ request, params: { orgId } }: Route.LoaderArgs) {
  // Check if request is aborted early
  if (request.signal.aborted) {
    throw new KnownError('Request aborted')
  }

  const session = await getSession({ request })
  const userId = session.userId || undefined

  // Check signal before database query
  if (request.signal.aborted) {
    throw new KnownError('Request aborted')
  }

  // If no userId, return early with undefined fields
  if (!userId) {
    return {
      userId: undefined,
      orgId,
      orgUser: undefined,
      userSites: undefined,
    }
  }

  // Check if user has access to this org
  const orgUser = await prisma.orgsUsers.findUnique({
    where: {
      userId_orgId: {
        userId: userId,
        orgId: orgId,
      },
    },
  })

  // Check signal before fetching user sites
  if (request.signal.aborted) {
    throw new KnownError('Request aborted')
  }

  // If user is not org member, return with undefined fields
  if (!orgUser) {
    return {
      userId,
      orgId,
      orgUser: undefined,
      userSites: undefined,
    }
  }

  // Fetch user sites for sidebar
  const userSites = await prisma.site.findMany({
    where: {
      org: {
        users: {
          some: {
            userId,
          },
        },
      },
    },
    include: {
      org: true,
      branches: {
        include: {
          _count: {
            select: {
              pages: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return {
    userId,
    orgId,
    orgUser,
    userSites,
  }
}
export function Component({ loaderData }: Route.ComponentProps) {
  return (
    <ClientOnly>
      <Outlet />
    </ClientOnly>
  )
}
