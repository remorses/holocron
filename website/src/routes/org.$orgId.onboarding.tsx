import { href, redirect } from 'react-router'
import { getSession } from '../lib/better-auth'
import { createSite } from '../lib/site'
import type { Route } from './+types/org.$orgId.onboarding'

export async function loader({ request, params }: Route.LoaderArgs) {
  const sessionData = await getSession({ request })
  if (sessionData.redirectTo) {
    throw redirect(sessionData.redirectTo)
  }
  const userId = sessionData.userId
  const orgId = params.orgId
  const name = `holocron-starter`
  
  // Create site with empty files (creates initial structure)
  const result = await createSite({
    name,
    orgId,
    userId,
    files: [],
  })
  
  const { siteId, branchId, chatId } = result
  throw redirect(
    href('/org/:orgId/branch/:branchId/chat/:chatId', {
      orgId,
      branchId,
      chatId,
    }),
  )
}
