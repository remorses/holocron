
import { app } from '../lib/spiceflow'

export const loader = async ({ request }) => {
    const res = await app.handle(request)
    return res
}
export const action = ({ request }) => app.handle(request)
