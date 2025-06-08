const defaultDurablefetchHost = 'durablefetch.fumabase.com'

function isRelativePath(url: string): boolean {
    return (
        !url.startsWith('http://') &&
        !url.startsWith('https://') &&
        !url.startsWith('//')
    )
}

export class DurableFetchClient {
    constructor(private options: { durablefetchHost?: string } = {}) {
        this.durablefetchHost =
            options.durablefetchHost ?? defaultDurablefetchHost
    }

    private durablefetchHost: string

    private resolveUrl(input: string | URL | Request): URL {
        if (typeof input === 'string') {
            if (isRelativePath(input)) {
                if (typeof window === 'undefined') {
                    throw new Error(
                        'Cannot resolve relative URL in Node.js environment without base URL',
                    )
                }
                return new URL(input, window.location.href)
            } else {
                return new URL(input)
            }
        } else if (input instanceof URL) {
            return input
        } else if (input instanceof Request) {
            return new URL(input.url)
        } else {
            return new URL(input)
        }
    }

    async fetch(
        input: RequestInfo | URL | string,
        init?: RequestInit,
    ): Promise<Response> {
        const url = this.resolveUrl(input)
        url.host = this.durablefetchHost

        return fetch(url.toString(), init)
    }

    async isInProgress(url: string | URL): Promise<{
        inProgress: boolean
        activeConnections: number
        chunksStored: number
    }> {
        const urlObj = this.resolveUrl(url)

        const checkUrl = new URL(
            '/in-progress',
            `https://${this.durablefetchHost}`,
        )
        checkUrl.pathname = urlObj.pathname + '/in-progress'
        checkUrl.search = urlObj.search

        const response = await fetch(checkUrl.toString(), {
            method: 'POST',
        })

        return response.json()
    }
}
