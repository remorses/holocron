const defaultDurablefetchHost = 'durablefetch.fumabase.com'

export async function durableFetch(
    input: RequestInfo | URL,
    init?: RequestInit & { durablefetchHost?: string },
): Promise<Response> {
    const url =
        typeof input === 'string'
            ? new URL(input)
            : input instanceof URL
              ? input
              : new URL(input.url)

    url.host = init?.durablefetchHost || defaultDurablefetchHost

    return fetch(url.toString(), init)
}
