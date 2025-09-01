import { describe, test, expect } from 'vitest'
import WebSocket from 'ws'

const WS_URL = 'wss://preview.holocron.so/_tunnel'

describe.concurrent('Tunnel WebSocket', () => {
    // Generate unique IDs for each test to avoid conflicts
    const getTunnelId = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}`

    test('upstream and client can exchange messages', async () => {
        const tunnelId = getTunnelId()

        // Connect upstream
        const upstream = new WebSocket(`${WS_URL}/upstream?id=${tunnelId}`)
        await new Promise((resolve, reject) => {
            upstream.on('open', resolve)
            upstream.on('error', reject)
        })

        // Connect client (downstream)
        const client = new WebSocket(`${WS_URL}/downstream?id=${tunnelId}`)
        await new Promise((resolve, reject) => {
            client.on('open', resolve)
            client.on('error', reject)
        })

        // Test upstream -> client message flow
        const clientMessagePromise = new Promise<string>((resolve) => {
            client.on('message', (data) => resolve(data.toString()))
        })

        upstream.send('hello from upstream')
        const clientReceivedMessage = await clientMessagePromise
        expect(clientReceivedMessage).toBe('hello from upstream')

        // Test client -> upstream message flow
        const upstreamMessagePromise = new Promise<string>((resolve) => {
            upstream.on('message', (data) => resolve(data.toString()))
        })

        client.send('hello from client')
        const upstreamReceivedMessage = await upstreamMessagePromise
        expect(upstreamReceivedMessage).toBe('hello from client')

        // Clean up
        upstream.close()
        client.close()
    })

    test('multiple clients can connect and receive messages from upstream', async () => {
        const tunnelId = getTunnelId()

        // Connect upstream
        const upstream = new WebSocket(`${WS_URL}/upstream?id=${tunnelId}`)
        await new Promise((resolve, reject) => {
            upstream.on('open', resolve)
            upstream.on('error', reject)
        })

        // Connect two clients
        const client1 = new WebSocket(`${WS_URL}/downstream?id=${tunnelId}`)
        const client2 = new WebSocket(`${WS_URL}/downstream?id=${tunnelId}`)

        await Promise.all([
            new Promise((resolve, reject) => {
                client1.on('open', resolve)
                client1.on('error', reject)
            }),
            new Promise((resolve, reject) => {
                client2.on('open', resolve)
                client2.on('error', reject)
            })
        ])

        // Set up message listeners
        const client1Messages: string[] = []
        const client2Messages: string[] = []

        client1.on('message', (data) => client1Messages.push(data.toString()))
        client2.on('message', (data) => client2Messages.push(data.toString()))

        // Send message from upstream
        upstream.send('broadcast message')

        // Wait a bit for messages to propagate
        await new Promise(resolve => setTimeout(resolve, 100))

        // Both clients should receive the message
        expect(client1Messages).toContain('broadcast message')
        expect(client2Messages).toContain('broadcast message')

        // Clean up
        upstream.close()
        client1.close()
        client2.close()
    })

    test('connecting upstream twice should fail', async () => {
        const tunnelId = getTunnelId()

        // Connect first upstream
        const upstream1 = new WebSocket(`${WS_URL}/upstream?id=${tunnelId}`)
        await new Promise((resolve, reject) => {
            upstream1.on('open', resolve)
            upstream1.on('error', reject)
        })

        // Try to connect second upstream - should be rejected
        const upstream2 = new WebSocket(`${WS_URL}/upstream?id=${tunnelId}`)

        const closePromise = new Promise<{ code: number; reason: string }>((resolve) => {
            upstream2.on('close', (code, reason) => {
                resolve({ code, reason: reason.toString() })
            })
        })

        // Wait for the second connection to be closed
        const closeEvent = await closePromise

        expect(closeEvent.code).toBe(4009)
        expect(closeEvent.reason).toBe('Upstream already connected')

        // First upstream should still be connected
        expect(upstream1.readyState).toBe(WebSocket.OPEN)

        // Clean up
        upstream1.close()
    })

    test('clients disconnect when upstream closes', async () => {
        const tunnelId = getTunnelId()

        // Connect upstream
        const upstream = new WebSocket(`${WS_URL}/upstream?id=${tunnelId}`)
        await new Promise((resolve, reject) => {
            upstream.on('open', resolve)
            upstream.on('error', reject)
        })

        // Connect client
        const client = new WebSocket(`${WS_URL}/downstream?id=${tunnelId}`)
        await new Promise((resolve, reject) => {
            client.on('open', resolve)
            client.on('error', reject)
        })

        // Set up close listener for client
        const clientClosePromise = new Promise<{ code: number; reason: string }>((resolve) => {
            client.on('close', (code, reason) => {
                resolve({ code, reason: reason.toString() })
            })
        })

        // Close upstream
        upstream.close()

        // Wait for client to be closed
        const closeEvent = await clientClosePromise

        expect(closeEvent.code).toBe(1012)
        expect(closeEvent.reason).toBe('upstream closed')
    })

    test('upstream receives messages from multiple clients', async () => {
        const tunnelId = getTunnelId()

        // Connect upstream
        const upstream = new WebSocket(`${WS_URL}/upstream?id=${tunnelId}`)
        await new Promise((resolve, reject) => {
            upstream.on('open', resolve)
            upstream.on('error', reject)
        })

        // Connect two clients
        const client1 = new WebSocket(`${WS_URL}/downstream?id=${tunnelId}`)
        const client2 = new WebSocket(`${WS_URL}/downstream?id=${tunnelId}`)

        await Promise.all([
            new Promise((resolve, reject) => {
                client1.on('open', resolve)
                client1.on('error', reject)
            }),
            new Promise((resolve, reject) => {
                client2.on('open', resolve)
                client2.on('error', reject)
            })
        ])

        // Collect upstream messages
        const upstreamMessages: string[] = []
        upstream.on('message', (data) => upstreamMessages.push(data.toString()))

        // Send messages from both clients
        client1.send('message from client 1')
        client2.send('message from client 2')

        // Wait for messages to arrive
        await new Promise(resolve => setTimeout(resolve, 100))

        // Upstream should receive both messages
        expect(upstreamMessages).toContain('message from client 1')
        expect(upstreamMessages).toContain('message from client 2')

        // Clean up
        upstream.close()
        client1.close()
        client2.close()
    })
})
