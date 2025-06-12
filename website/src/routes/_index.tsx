import { redirect } from 'react-router'
import { getSupabaseSession } from '../lib/better-auth'
import type { Route } from './+types/_index'

export async function loader({ request }) {
    const { userId, redirectTo } = await getSupabaseSession({ request })
    if (redirectTo) {
        throw redirect(redirectTo)
    }
    return {}
}
export default function Index() {
    return (
        <div className='min-h-screen w-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500'></div>
    )
}
