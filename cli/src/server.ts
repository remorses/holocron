import WebSocket from 'ws'
import crypto from 'crypto'

type WebSocketWithTunnel = {
  ws: WebSocket
  stop: () => void
  websocketId: string
}

export function startWebSocketWithTunnel(existingWebsocketId?: string) {
  return new Promise<WebSocketWithTunnel>((resolve, reject) => {
    const start = Date.now()

    try {
      // Use existing websocket ID if provided, otherwise generate a new one
      const websocketId =
        existingWebsocketId || crypto.randomBytes(8).toString('hex')

      // Connect to the upstream WebSocket
      const upstreamUrl = `wss://holocron.so/_tunnel/upstream?id=${websocketId}`
      const ws = new WebSocket(upstreamUrl)

      // Track if we've successfully connected
      let connected = false

      ws.on('open', () => {
        connected = true
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

      ws.on('close', (code, reason) => {
        // Handle close during connection phase (before open event)

        if (
          code === 4009 ||
          (reason && reason.toString().includes('Upstream already connected'))
        ) {
          // Connection rejected due to existing upstream
          console.error(
            '\n❌ Connection failed: Another upstream is already connected with this ID!',
          )
          console.error(
            '   This usually means another instance of holocron dev is running.',
          )
          console.error('   Solutions:')
          console.error('   1. Stop the other instance first')
          console.error('   2. Use a different directory/project')
          console.error('   3. Wait for the other instance to disconnect\n')
          const error = new Error(
            'Connection rejected: Another upstream already connected',
          )
          reject(error)
          return
        }
        // Generic connection failure
        const error = new Error(
          `WebSocket closed during connection: ${code} - ${reason}`,
        )
        reject(error)
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
