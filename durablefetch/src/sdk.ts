export const defaultDurablefetchHost = 'durablefetch.fumabase.com'

function isRelativePath(url: string): boolean {
    return (
        !url.startsWith('http://') &&
        !url.startsWith('https://') &&
        !url.startsWith('//')
    )
}
const logger = console

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
        const realHost = url.host
        const realPathname = url.pathname
        url.host = this.durablefetchHost
        url.pathname = `/${realHost}${realPathname}`

        logger.log(`fetching ${url.toString()}`)
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

        logger.log(`fetching ${checkUrl.toString()}`)
        const response = await fetch(checkUrl.toString(), {
            method: 'POST',
            body: JSON.stringify({
                url: urlObj.toString(),
            }),
        })

        const text = await response.text()
        try {
            return JSON.parse(text)
        } catch (e) {
            throw new Error(
                `/in-progress returned invalid JSON: ${text.slice(0, 1000)}`,
            )
        }
    }
}

function headersToObject(headers?: HeadersInit): Record<string, string> {
    if (!headers) {
        return {}
    }

    if (headers instanceof Headers) {
        const obj: Record<string, string> = {}
        headers.forEach((value, key) => {
            obj[key] = value
        })
        return obj
    }

    if (Array.isArray(headers)) {
        const obj: Record<string, string> = {}
        for (const [key, value] of headers) {
            obj[key] = value
        }
        return obj
    }

    return headers as Record<string, string>
}
