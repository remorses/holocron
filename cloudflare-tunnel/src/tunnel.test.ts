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
      }),
    ])

    // Set up message listeners
    const client1Messages: string[] = []
    const client2Messages: string[] = []

    client1.on('message', (data) => client1Messages.push(data.toString()))
    client2.on('message', (data) => client2Messages.push(data.toString()))

    // Send message from upstream
    upstream.send('broadcast message')

    // Wait a bit for messages to propagate
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Both clients should receive the message
    expect(client1Messages).toContain('broadcast message')
    expect(client2Messages).toContain('broadcast message')

    // Clean up
    upstream.close()
    client1.close()
    client2.close()
  })

  test('connecting upstream twice replaces the first', async () => {
    const tunnelId = getTunnelId()

    // Connect first upstream
    const upstream1 = new WebSocket(`${WS_URL}/upstream?id=${tunnelId}`)
    await new Promise((resolve, reject) => {
      upstream1.on('open', resolve)
      upstream1.on('error', reject)
    })

    const upstream1ClosePromise = new Promise<{ code: number; reason: string }>((resolve) => {
      upstream1.on('close', (code, reason) => {
        resolve({ code, reason: reason.toString() })
      })
    })

    // Connect second upstream - should replace the first
    const upstream2 = new WebSocket(`${WS_URL}/upstream?id=${tunnelId}`)
    await new Promise((resolve, reject) => {
      upstream2.on('open', resolve)
      upstream2.on('error', reject)
    })

    // First upstream should be closed
    const closeEvent = await upstream1ClosePromise

    expect(closeEvent.code).toBe(4009)
    expect(closeEvent.reason).toBe('Upstream already connected')

    // Second upstream should still be connected
    expect(upstream2.readyState).toBe(WebSocket.OPEN)

    // Clean up
    upstream2.close()
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
    const clientClosePromise = new Promise<{
      code: number
      reason: string
    }>((resolve) => {
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
      }),
    ])

    // Collect upstream messages
    const upstreamMessages: string[] = []
    upstream.on('message', (data) => upstreamMessages.push(data.toString()))

    // Send messages from both clients
    client1.send('message from client 1')
    client2.send('message from client 2')

    // Wait for messages to arrive
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Upstream should receive both messages
    expect(upstreamMessages).toContain('message from client 1')
    expect(upstreamMessages).toContain('message from client 2')

    // Clean up
    upstream.close()
    client1.close()
    client2.close()
  })

  test('client connection fails when no upstream is connected', async () => {
    const tunnelId = getTunnelId()

    // Try to connect client without upstream
    const client = new WebSocket(`${WS_URL}/downstream?id=${tunnelId}`)

    // Track both open and close events
    const eventPromise = new Promise<{ code: number; reason: string }>((resolve, reject) => {
      client.on('open', () => {
        // Connection opened, wait for close
      })
      client.on('close', (code, reason) => {
        resolve({ code, reason: reason.toString() })
      })
      client.on('error', (error) => {
        reject(error)
      })
    })

    // Wait for the connection to be closed
    const closeEvent = await eventPromise

    expect(closeEvent.code).toBe(4008)
    expect(closeEvent.reason).toBe('No upstream available')
  })

  test('single id with namespace works', async () => {
    const namespace = getTunnelId()
    const id = 'channel-1'

    const upstream = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id}`)
    await new Promise((resolve, reject) => {
      upstream.on('open', resolve)
      upstream.on('error', reject)
    })

    const client = new WebSocket(`${WS_URL}/downstream?namespace=${namespace}&id=${id}`)
    await new Promise((resolve, reject) => {
      client.on('open', resolve)
      client.on('error', reject)
    })

    const clientMessagePromise = new Promise<string>((resolve) => {
      client.on('message', (data) => {
        resolve(data.toString())
      })
    })

    upstream.send('hello with namespace')
    const received = await clientMessagePromise
    expect(received).toBe('hello with namespace')

    upstream.close()
    client.close()
  })

  test('multi-subscribe receives wrapped messages from multiple upstreams', async () => {
    const namespace = getTunnelId()
    const id1 = 'channel-1'
    const id2 = 'channel-2'

    const upstream1 = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id1}`)
    const upstream2 = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id2}`)

    await Promise.all([
      new Promise((resolve, reject) => {
        upstream1.on('open', resolve)
        upstream1.on('error', reject)
      }),
      new Promise((resolve, reject) => {
        upstream2.on('open', resolve)
        upstream2.on('error', reject)
      }),
    ])

    const client = new WebSocket(`${WS_URL}/downstream?namespace=${namespace}&id=${id1}&id=${id2}`)
    await new Promise((resolve, reject) => {
      client.on('open', resolve)
      client.on('error', reject)
    })

    const messages: Array<{ id: string; data: string }> = []
    client.on('message', (data) => {
      messages.push(JSON.parse(data.toString()))
    })

    upstream1.send('from upstream 1')
    upstream2.send('from upstream 2')

    await new Promise((resolve) => {
      setTimeout(resolve, 200)
    })

    expect(messages).toContainEqual({ id: id1, data: 'from upstream 1' })
    expect(messages).toContainEqual({ id: id2, data: 'from upstream 2' })

    upstream1.close()
    upstream2.close()
    client.close()
  })

  test('multi-subscribe downstream can send to specific upstream', async () => {
    const namespace = getTunnelId()
    const id1 = 'channel-1'
    const id2 = 'channel-2'

    const upstream1 = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id1}`)
    const upstream2 = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id2}`)

    await Promise.all([
      new Promise((resolve, reject) => {
        upstream1.on('open', resolve)
        upstream1.on('error', reject)
      }),
      new Promise((resolve, reject) => {
        upstream2.on('open', resolve)
        upstream2.on('error', reject)
      }),
    ])

    const client = new WebSocket(`${WS_URL}/downstream?namespace=${namespace}&id=${id1}&id=${id2}`)
    await new Promise((resolve, reject) => {
      client.on('open', resolve)
      client.on('error', reject)
    })

    const upstream1Messages: string[] = []
    const upstream2Messages: string[] = []
    upstream1.on('message', (data) => {
      upstream1Messages.push(data.toString())
    })
    upstream2.on('message', (data) => {
      upstream2Messages.push(data.toString())
    })

    client.send(JSON.stringify({ id: id1, data: 'to upstream 1' }))
    client.send(JSON.stringify({ id: id2, data: 'to upstream 2' }))

    await new Promise((resolve) => {
      setTimeout(resolve, 200)
    })

    expect(upstream1Messages).toContain('to upstream 1')
    expect(upstream2Messages).toContain('to upstream 2')

    upstream1.close()
    upstream2.close()
    client.close()
  })

  test('multi-subscribe client receives upstream_closed event but stays connected', async () => {
    const namespace = getTunnelId()
    const id1 = 'channel-1'
    const id2 = 'channel-2'

    const upstream1 = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id1}`)
    const upstream2 = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id2}`)

    await Promise.all([
      new Promise((resolve, reject) => {
        upstream1.on('open', resolve)
        upstream1.on('error', reject)
      }),
      new Promise((resolve, reject) => {
        upstream2.on('open', resolve)
        upstream2.on('error', reject)
      }),
    ])

    const client = new WebSocket(`${WS_URL}/downstream?namespace=${namespace}&id=${id1}&id=${id2}`)
    await new Promise((resolve, reject) => {
      client.on('open', resolve)
      client.on('error', reject)
    })

    const messages: Array<{ id: string; event?: string; data?: string }> = []
    client.on('message', (data) => {
      messages.push(JSON.parse(data.toString()))
    })

    upstream1.close()

    await new Promise((resolve) => {
      setTimeout(resolve, 200)
    })

    expect(messages).toContainEqual({ id: id1, event: 'upstream_closed' })
    expect(client.readyState).toBe(WebSocket.OPEN)

    upstream2.send('still working')

    await new Promise((resolve) => {
      setTimeout(resolve, 100)
    })

    expect(messages).toContainEqual({ id: id2, data: 'still working' })

    upstream2.close()
    client.close()
  })

  test('multiple upstreams with same id in namespace replaces old upstream', async () => {
    const namespace = getTunnelId()
    const id = 'channel-1'

    const upstream1 = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id}`)
    await new Promise((resolve, reject) => {
      upstream1.on('open', resolve)
      upstream1.on('error', reject)
    })

    const upstream1ClosePromise = new Promise<{ code: number; reason: string }>((resolve) => {
      upstream1.on('close', (code, reason) => {
        resolve({ code, reason: reason.toString() })
      })
    })

    const upstream2 = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id}`)
    await new Promise((resolve, reject) => {
      upstream2.on('open', resolve)
      upstream2.on('error', reject)
    })

    const closeEvent = await upstream1ClosePromise
    expect(closeEvent.code).toBe(4009)
    expect(closeEvent.reason).toBe('Upstream already connected')

    expect(upstream2.readyState).toBe(WebSocket.OPEN)

    upstream2.close()
  })

  test('different ids in same namespace are isolated', async () => {
    const namespace = getTunnelId()
    const id1 = 'channel-1'
    const id2 = 'channel-2'

    const upstream1 = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id1}`)
    const upstream2 = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id2}`)

    await Promise.all([
      new Promise((resolve, reject) => {
        upstream1.on('open', resolve)
        upstream1.on('error', reject)
      }),
      new Promise((resolve, reject) => {
        upstream2.on('open', resolve)
        upstream2.on('error', reject)
      }),
    ])

    const client1 = new WebSocket(`${WS_URL}/downstream?namespace=${namespace}&id=${id1}`)
    const client2 = new WebSocket(`${WS_URL}/downstream?namespace=${namespace}&id=${id2}`)

    await Promise.all([
      new Promise((resolve, reject) => {
        client1.on('open', resolve)
        client1.on('error', reject)
      }),
      new Promise((resolve, reject) => {
        client2.on('open', resolve)
        client2.on('error', reject)
      }),
    ])

    const client1Messages: string[] = []
    const client2Messages: string[] = []
    client1.on('message', (data) => {
      client1Messages.push(data.toString())
    })
    client2.on('message', (data) => {
      client2Messages.push(data.toString())
    })

    upstream1.send('only for client 1')
    upstream2.send('only for client 2')

    await new Promise((resolve) => {
      setTimeout(resolve, 200)
    })

    expect(client1Messages).toEqual(['only for client 1'])
    expect(client2Messages).toEqual(['only for client 2'])

    upstream1.close()
    upstream2.close()
    client1.close()
    client2.close()
  })

  test('multi-subscribe client connects with partial upstream availability', async () => {
    const namespace = getTunnelId()
    const id1 = 'channel-1'
    const id2 = 'channel-2'

    const upstream1 = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id1}`)
    await new Promise((resolve, reject) => {
      upstream1.on('open', resolve)
      upstream1.on('error', reject)
    })

    const client = new WebSocket(`${WS_URL}/downstream?namespace=${namespace}&id=${id1}&id=${id2}`)
    await new Promise((resolve, reject) => {
      client.on('open', resolve)
      client.on('error', reject)
    })

    const messages: Array<{ id: string; data: string }> = []
    client.on('message', (data) => {
      messages.push(JSON.parse(data.toString()))
    })

    upstream1.send('from upstream 1')

    await new Promise((resolve) => {
      setTimeout(resolve, 100)
    })

    expect(messages).toContainEqual({ id: id1, data: 'from upstream 1' })

    const upstream2 = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id2}`)
    await new Promise((resolve, reject) => {
      upstream2.on('open', resolve)
      upstream2.on('error', reject)
    })

    upstream2.send('from upstream 2')

    await new Promise((resolve) => {
      setTimeout(resolve, 100)
    })

    expect(messages).toContainEqual({ id: id2, data: 'from upstream 2' })

    upstream1.close()
    upstream2.close()
    client.close()
  })

  test('both upstreams close sends two upstream_closed events', async () => {
    const namespace = getTunnelId()
    const id1 = 'channel-1'
    const id2 = 'channel-2'

    const upstream1 = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id1}`)
    const upstream2 = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id2}`)

    await Promise.all([
      new Promise((resolve, reject) => {
        upstream1.on('open', resolve)
        upstream1.on('error', reject)
      }),
      new Promise((resolve, reject) => {
        upstream2.on('open', resolve)
        upstream2.on('error', reject)
      }),
    ])

    const client = new WebSocket(`${WS_URL}/downstream?namespace=${namespace}&id=${id1}&id=${id2}`)
    await new Promise((resolve, reject) => {
      client.on('open', resolve)
      client.on('error', reject)
    })

    const messages: Array<{ id: string; event?: string }> = []
    client.on('message', (data) => {
      messages.push(JSON.parse(data.toString()))
    })

    upstream1.close()
    upstream2.close()

    await new Promise((resolve) => {
      setTimeout(resolve, 300)
    })

    expect(messages).toContainEqual({ id: id1, event: 'upstream_closed' })
    expect(messages).toContainEqual({ id: id2, event: 'upstream_closed' })
    expect(client.readyState).toBe(WebSocket.OPEN)

    client.close()
  })

  test('mixed single and multi-subscribe clients receive correct format', async () => {
    const namespace = getTunnelId()
    const id1 = 'channel-1'

    const upstream = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id1}`)
    await new Promise((resolve, reject) => {
      upstream.on('open', resolve)
      upstream.on('error', reject)
    })

    const singleClient = new WebSocket(`${WS_URL}/downstream?namespace=${namespace}&id=${id1}`)
    const multiClient = new WebSocket(`${WS_URL}/downstream?namespace=${namespace}&id=${id1}&id=other-id`)

    await Promise.all([
      new Promise((resolve, reject) => {
        singleClient.on('open', resolve)
        singleClient.on('error', reject)
      }),
      new Promise((resolve, reject) => {
        multiClient.on('open', resolve)
        multiClient.on('error', reject)
      }),
    ])

    const singleMessages: string[] = []
    const multiMessages: string[] = []
    singleClient.on('message', (data) => {
      singleMessages.push(data.toString())
    })
    multiClient.on('message', (data) => {
      multiMessages.push(data.toString())
    })

    upstream.send('hello')

    await new Promise((resolve) => {
      setTimeout(resolve, 100)
    })

    expect(singleMessages).toEqual(['hello'])
    expect(multiMessages).toEqual([JSON.stringify({ id: id1, data: 'hello' })])

    upstream.close()
    singleClient.close()
    multiClient.close()
  })

  test('multiple multi-subscribe clients all receive messages', async () => {
    const namespace = getTunnelId()
    const id1 = 'channel-1'
    const id2 = 'channel-2'

    const upstream1 = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id1}`)
    const upstream2 = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id2}`)

    await Promise.all([
      new Promise((resolve, reject) => {
        upstream1.on('open', resolve)
        upstream1.on('error', reject)
      }),
      new Promise((resolve, reject) => {
        upstream2.on('open', resolve)
        upstream2.on('error', reject)
      }),
    ])

    const client1 = new WebSocket(`${WS_URL}/downstream?namespace=${namespace}&id=${id1}&id=${id2}`)
    const client2 = new WebSocket(`${WS_URL}/downstream?namespace=${namespace}&id=${id1}&id=${id2}`)

    await Promise.all([
      new Promise((resolve, reject) => {
        client1.on('open', resolve)
        client1.on('error', reject)
      }),
      new Promise((resolve, reject) => {
        client2.on('open', resolve)
        client2.on('error', reject)
      }),
    ])

    const client1Messages: Array<{ id: string; data: string }> = []
    const client2Messages: Array<{ id: string; data: string }> = []
    client1.on('message', (data) => {
      client1Messages.push(JSON.parse(data.toString()))
    })
    client2.on('message', (data) => {
      client2Messages.push(JSON.parse(data.toString()))
    })

    upstream1.send('from 1')
    upstream2.send('from 2')

    await new Promise((resolve) => {
      setTimeout(resolve, 200)
    })

    expect(client1Messages).toContainEqual({ id: id1, data: 'from 1' })
    expect(client1Messages).toContainEqual({ id: id2, data: 'from 2' })
    expect(client2Messages).toContainEqual({ id: id1, data: 'from 1' })
    expect(client2Messages).toContainEqual({ id: id2, data: 'from 2' })

    upstream1.close()
    upstream2.close()
    client1.close()
    client2.close()
  })

  test('multi-subscribe client message to unavailable upstream is silently dropped', async () => {
    const namespace = getTunnelId()
    const id1 = 'channel-1'
    const id2 = 'channel-2'

    const upstream1 = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id1}`)
    await new Promise((resolve, reject) => {
      upstream1.on('open', resolve)
      upstream1.on('error', reject)
    })

    const client = new WebSocket(`${WS_URL}/downstream?namespace=${namespace}&id=${id1}&id=${id2}`)
    await new Promise((resolve, reject) => {
      client.on('open', resolve)
      client.on('error', reject)
    })

    const upstream1Messages: string[] = []
    upstream1.on('message', (data) => {
      upstream1Messages.push(data.toString())
    })

    client.send(JSON.stringify({ id: id1, data: 'to upstream 1' }))
    client.send(JSON.stringify({ id: id2, data: 'to non-existent upstream' }))

    await new Promise((resolve) => {
      setTimeout(resolve, 200)
    })

    expect(upstream1Messages).toEqual(['to upstream 1'])
    expect(client.readyState).toBe(WebSocket.OPEN)

    upstream1.close()
    client.close()
  })

  test('multiplexer with single id receives wrapped messages', async () => {
    const tunnelId = getTunnelId()

    const upstream = new WebSocket(`${WS_URL}/upstream?id=${tunnelId}`)
    await new Promise((resolve, reject) => {
      upstream.on('open', resolve)
      upstream.on('error', reject)
    })

    const client = new WebSocket(`${WS_URL}/multiplexer?id=${tunnelId}`)
    await new Promise((resolve, reject) => {
      client.on('open', resolve)
      client.on('error', reject)
    })

    const messages: Array<{ id: string; data: string }> = []
    client.on('message', (data) => {
      messages.push(JSON.parse(data.toString()))
    })

    upstream.send('hello')

    await new Promise((resolve) => {
      setTimeout(resolve, 100)
    })

    expect(messages).toEqual([{ id: tunnelId, data: 'hello' }])

    upstream.close()
    client.close()
  })

  test('multiplexer client can send wrapped messages to upstream', async () => {
    const tunnelId = getTunnelId()

    const upstream = new WebSocket(`${WS_URL}/upstream?id=${tunnelId}`)
    await new Promise((resolve, reject) => {
      upstream.on('open', resolve)
      upstream.on('error', reject)
    })

    const client = new WebSocket(`${WS_URL}/multiplexer?id=${tunnelId}`)
    await new Promise((resolve, reject) => {
      client.on('open', resolve)
      client.on('error', reject)
    })

    const upstreamMessages: string[] = []
    upstream.on('message', (data) => {
      upstreamMessages.push(data.toString())
    })

    client.send(JSON.stringify({ id: tunnelId, data: 'hello from multiplexer' }))

    await new Promise((resolve) => {
      setTimeout(resolve, 100)
    })

    expect(upstreamMessages).toEqual(['hello from multiplexer'])

    upstream.close()
    client.close()
  })

  test('multiplexer receives upstream_closed event instead of disconnect', async () => {
    const tunnelId = getTunnelId()

    const upstream = new WebSocket(`${WS_URL}/upstream?id=${tunnelId}`)
    await new Promise((resolve, reject) => {
      upstream.on('open', resolve)
      upstream.on('error', reject)
    })

    const client = new WebSocket(`${WS_URL}/multiplexer?id=${tunnelId}`)
    await new Promise((resolve, reject) => {
      client.on('open', resolve)
      client.on('error', reject)
    })

    const messages: Array<{ id: string; event?: string }> = []
    client.on('message', (data) => {
      messages.push(JSON.parse(data.toString()))
    })

    upstream.close()

    await new Promise((resolve) => {
      setTimeout(resolve, 200)
    })

    expect(messages).toEqual([{ id: tunnelId, event: 'upstream_closed' }])
    expect(client.readyState).toBe(WebSocket.OPEN)

    client.close()
  })

  test('multiplexer with namespace and multiple ids works', async () => {
    const namespace = getTunnelId()
    const id1 = 'channel-1'
    const id2 = 'channel-2'

    const upstream1 = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id1}`)
    const upstream2 = new WebSocket(`${WS_URL}/upstream?namespace=${namespace}&id=${id2}`)

    await Promise.all([
      new Promise((resolve, reject) => {
        upstream1.on('open', resolve)
        upstream1.on('error', reject)
      }),
      new Promise((resolve, reject) => {
        upstream2.on('open', resolve)
        upstream2.on('error', reject)
      }),
    ])

    const client = new WebSocket(`${WS_URL}/multiplexer?namespace=${namespace}&id=${id1}&id=${id2}`)
    await new Promise((resolve, reject) => {
      client.on('open', resolve)
      client.on('error', reject)
    })

    const messages: Array<{ id: string; data: string }> = []
    client.on('message', (data) => {
      messages.push(JSON.parse(data.toString()))
    })

    upstream1.send('from 1')
    upstream2.send('from 2')

    await new Promise((resolve) => {
      setTimeout(resolve, 200)
    })

    expect(messages).toContainEqual({ id: id1, data: 'from 1' })
    expect(messages).toContainEqual({ id: id2, data: 'from 2' })

    upstream1.close()
    upstream2.close()
    client.close()
  })
})
