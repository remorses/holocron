import { useEffect } from 'react'
import { useLoaderData } from 'react-router'
import type { Route } from './+types/test-promise'

export async function loader({}: Route.LoaderArgs) {
    const promise = new Promise<string>((resolve) => {
        setTimeout(() => {
            resolve('Promise resolved after 5 seconds!')
        }, 5000)
    })
    
    return { promise }
}

export default function TestPromise() {
    const { promise } = useLoaderData<typeof loader>()
    
    useEffect(() => {
        promise.then((message) => {
            alert(message)
        })
    }, [promise])
    
    return <div>Waiting for promise to resolve...</div>
}