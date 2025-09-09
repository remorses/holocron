export function getHost(request: Request): string {
    const xForwardedHost = request.headers.get('x-forwarded-host')
    if (xForwardedHost) {
        return xForwardedHost.split(',')[0].trim()
    }

    const hostHeader = request.headers.get('host')
    if (hostHeader) {
        return hostHeader.split(',')[0].trim()
    }

    const url = new URL(request.url)
    return url.hostname
}
