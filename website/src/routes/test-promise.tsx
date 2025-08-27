import { useEffect } from 'react'
import { useLoaderData } from 'react-router'
import type { Route } from './+types/test-promise'

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url)
    const hasError = url.searchParams.has('error')
    const shouldThrow = url.searchParams.has('throw')

    const promise = new Promise<string | Error>((resolve, reject) => {
        setTimeout(() => {
            if (shouldThrow) {
                reject(new Error('Promise rejected after 5 seconds!'))
            } else if (hasError) {
                resolve(new Error('Something went wrong after 5 seconds!'))
            } else {
                resolve('Promise resolved after 5 seconds!')
            }
        }, 4000)
    })

    return { promise }
}

export default function TestPromise() {
    const { promise } = useLoaderData<typeof loader>()

    useEffect(() => {
        promise
            .then((message) => {
                alert(message)
            })
            .catch((error) => {
                alert(`Caught error: ${error.message}`)
            })
    }, [promise])

    return <div>Waiting for promise to resolve...</div>
}
