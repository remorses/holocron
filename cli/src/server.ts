import { WebSocketServer } from 'ws'
import { Tunnel } from 'cloudflared'
import net from 'net'

/**
 * Finds an available port on localhost and returns it.
 * @returns {Promise<number>} The available port found.
 */
async function findAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer()
        server.listen(0, () => {
            const address = server.address()
            if (typeof address === 'object' && address?.port) {
                const port = address.port
                server.close(() => resolve(port))
            } else {
                server.close(() => reject(new Error('failed to get port')))
            }
        })
        server.on('error', reject)
    })
}
type WebSocketWithTunnel = {
    wss: WebSocketServer
    tunnel: any
    port: number
    stop: () => void
    websocketUrl: string
}

export function startWebSocketWithTunnel({ port }: { port?: number } = {}) {
    return new Promise<WebSocketWithTunnel>(async (resolve, reject) => {
        let actualPort: number
        try {
            actualPort = port ?? (await findAvailablePort())
        } catch (err) {
            reject(err)
            return
        }

        // 1) local WebSocket server
        const wss = new WebSocketServer({ port: actualPort }, () =>
            console.log(`ws://localhost:${actualPort} ready`),
        )

        // 2) Cloudflare Tunnel (npm "cloudflared")
        const tunnel = Tunnel.quick(`http://localhost:${actualPort}`, {
            '--no-autoupdate': true,
            '--loglevel': 'info',
        })
        const start = Date.now()

        let tunnelUrl: string | undefined

        tunnel.on('url', (url: string) => {
            tunnelUrl = `ws://${url.slice(8)}`
            const elapsed = Date.now() - start
            const websocketUrl = tunnelUrl.replace(/^ws:/, 'wss:')
            console.log(`🌐 Public WebSocket endpoint → ${websocketUrl}`)
            console.log(
                `⏱ Tunnel URL obtained in ${(elapsed / 1000).toFixed(2)}s`,
            )
            resolve({
                wss,
                tunnel,
                port: actualPort,
                websocketUrl,
                stop,
            })
        })

        tunnel.on('error', (err: any) => {
            reject(err)
        })

        // tunnel.on('stdout', (d: any) => process.stdout.write(`[cf] ${d}`))
        // tunnel.on('stderr', (d: any) => process.stderr.write(`[cf] ${d}`))

        // 3) graceful shutdown
        const stop = () => {
            console.log('\n⏹ shutting down…')
            tunnel.stop()
            wss.close()
        }

        const shutdown = () => {
            stop()
            process.exit()
        }

        process.on('SIGINT', shutdown)
        process.on('SIGTERM', shutdown)
    })
}
