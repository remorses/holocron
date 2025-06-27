import { WebSocketServer } from 'ws'
import { startTunnel } from 'untun'
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

        // 2) untun tunnel
        const start = Date.now()

        try {
            const tunnel = await startTunnel({
                port: actualPort,
                acceptCloudflareNotice: true,
                hostname: 'localhost',
                protocol: 'http',
            })
            if (!tunnel) throw new Error('Failed to create Cloudflare tunnel')

            const websocketUrl = (await tunnel.getURL()).replace(
                /^https?:/,
                'wss:',
            )
            const elapsed = Date.now() - start
            console.log(`🌐 Public WebSocket endpoint → ${websocketUrl}`)
            console.log(
                `⏱ Tunnel URL obtained in ${(elapsed / 1000).toFixed(2)}s`,
            )

            // 3) graceful shutdown
            const stop = () => {
                console.log('\n⏹ shutting down…')
                if (
                    tunnel &&
                    'close' in tunnel &&
                    typeof tunnel.close === 'function'
                ) {
                    tunnel.close()
                }
                wss.close()
            }

            const shutdown = () => {
                stop()
                process.exit()
            }

            process.on('SIGINT', shutdown)
            process.on('SIGTERM', shutdown)

            resolve({
                wss,
                tunnel,
                port: actualPort,
                websocketUrl,
                stop,
            })
        } catch (err) {
            reject(err)
        }
    })
}
