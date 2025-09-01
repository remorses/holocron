// http://localhost:7664/markdown-editor
import { redirect, href } from 'react-router'
import { serialize } from 'cookie'
import { PREFERS_EDITOR_VIEW_COOKIE } from '../lib/constants'

export function loader() {
    // old holocron path redirect
    const headers = new Headers()
    headers.set('Set-Cookie', serialize(PREFERS_EDITOR_VIEW_COOKIE, 'true', {
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        sameSite: 'lax'
    }))
    throw redirect(href('/'), { headers })
}
