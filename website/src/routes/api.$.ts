import { Route } from './+types/api.$'
import { app } from '../lib/spiceflow'

export const loader = async ({ request, context }: Route.LoaderArgs) => {
    const res = await app.handle(request)
    return res
}
export const action = async ({ request, context }: Route.ActionArgs) => {
    const res = await app.handle(request)
    return res
}
