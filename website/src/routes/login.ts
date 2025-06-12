import { redirect } from 'react-router'
import { auth } from '../lib/better-auth'

export async function loader() {
    const res = await auth.api.signInSocial({
        body: {
            provider: 'google',
            callbackURL: '/',
        },
    })
    if (!res.url) {
        throw new Error('No URL returned from signInSocial')
    }
    throw redirect(res.url)
}
