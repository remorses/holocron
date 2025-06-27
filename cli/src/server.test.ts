import { describe, it, expect } from 'vitest'
import { startWebSocketWithTunnel } from './server.js'

describe('startWebSocketWithTunnel', () => {
    it(
        'should connect to upstream tunnel (smoke test)',
        async () => {
            const { ws, websocketId, stop } = await startWebSocketWithTunnel()
            expect(websocketId).toBeTruthy()
            expect(websocketId).toHaveLength(32) // 16 bytes in hex = 32 chars
            expect(ws).toBeTruthy()
            expect(ws.readyState).toBe(ws.OPEN)
            stop()
        },
        10 * 1000,
    )
})
