import { Outlet } from 'react-router'
import type { Route } from './+types/org.$orgId.site.$siteId'


export type { Route }

export async function loader({
    request,
    params: { orgId, siteId },
}: Route.LoaderArgs) {
    return { xxx: true }
}
export function Component({ loaderData }: Route.ComponentProps) {
    return <Outlet />
}
