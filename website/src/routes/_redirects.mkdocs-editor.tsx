import { redirect, href } from 'react-router'

export function loader() {
    // old holocron path redirect
    throw redirect(href('/'))
}