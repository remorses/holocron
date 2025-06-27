import { describe, it, expect } from 'vitest'
import { startWebSocketWithTunnel } from './server.js'

describe('startWebSocketWithTunnel', () => {
    it(
        'should start the WebSocket server and tunnel (smoke test)',
        async () => {
            const { wss, tunnel, stop } = await startWebSocketWithTunnel()
            // Wait 2 seconds to ensure server starts
            await new Promise((resolve) => setTimeout(resolve, 10 * 1000))
            expect(wss.address()).toBeTruthy()
            stop()
        },
        30 * 1000,
    )
})
