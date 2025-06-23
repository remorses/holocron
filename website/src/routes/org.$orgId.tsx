import { Outlet } from 'react-router'
import type { Route } from './+types/org.$orgId'


export type { Route }

export async function loader({ request, params: { orgId } }: Route.LoaderArgs) {
    return { xxx: true }
}
export function Component({ loaderData }: Route.ComponentProps) {
    return <Outlet />
}
