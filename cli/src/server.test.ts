import { describe, it, expect } from 'vitest'
import { startWebSocketWithTunnel } from './server.js'

describe('startWebSocketWithTunnel', () => {
    it(
        'should start the WebSocket server and tunnel (smoke test)',
        async () => {
            const { wss, tunnel, stop } = await startWebSocketWithTunnel()
            expect(wss.address()).toBeTruthy()
            stop()
        },
        10 * 1000,
    )
})
