import { Route } from './+types/fumabaseInternalAPI.$'
import { docsApp } from '../lib/spiceflow-docs-app'

export const loader = async ({ request, context }: Route.LoaderArgs) => {
    const res = await docsApp.handle(request)
    return res
}
export const action = async ({ request, context }: Route.ActionArgs) => {
    const res = await docsApp.handle(request)
    return res
}
