import WebSocket from 'ws'
import crypto from 'crypto'

type WebSocketWithTunnel = {
    ws: WebSocket
    stop: () => void
    websocketId: string
}

export function startWebSocketWithTunnel() {
    return new Promise<WebSocketWithTunnel>((resolve, reject) => {
        const start = Date.now()

        try {
            // Generate a strong unique websocket ID
            const websocketId = crypto.randomBytes(16).toString('hex')
            
            // Connect to the upstream WebSocket
            const upstreamUrl = `wss://fumabase.com/_tunnel/upstream?id=${websocketId}`
            const ws = new WebSocket(upstreamUrl)
            
            ws.on('open', () => {
                console.log(`Connected to upstream tunnel with ID: ${websocketId}`)
                const elapsed = Date.now() - start
                console.log(
                    `Tunnel connection established in ${(elapsed / 1000).toFixed(2)}s`,
                )
                
                resolve({
                    ws,
                    websocketId,
                    stop,
                })
            })
            
            ws.on('error', (err) => {
                console.error('Upstream WebSocket Error:', err)
                reject(err)
            })
            
            ws.on('close', () => {
                console.log('Upstream WebSocket closed')
            })

            // Graceful shutdown
            const stop = () => {
                console.log('\n⏹ shutting down…')
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close()
                }
            }

            const shutdown = () => {
                stop()
                process.exit()
            }

            process.on('SIGINT', shutdown)
            process.on('SIGTERM', shutdown)
            
            // Keep-alive ping for upstream connection
            const pingInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.ping()
                }
            }, 20000)
            
            ws.on('close', () => {
                clearInterval(pingInterval)
            })
            
        } catch (err) {
            reject(err)
        }
    })
}
