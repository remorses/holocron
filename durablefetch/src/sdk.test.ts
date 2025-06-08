import {
    type EventSourceMessage,
    EventSourceParserStream,
} from 'eventsource-parser/stream'
import { describe, it, expect } from 'vitest'
import { DurableFetchClient } from './sdk'

describe(
    'DurableFetchClient',
    () => {
        const client = new DurableFetchClient()
        const randomId = Math.random().toString(36).substring(7)
        const sseUrl = `https://postman-echo.com/server-events/5?randomId=${randomId}`
        it('should check in-progress status', async () => {
            const status = await client.isInProgress(sseUrl)
            expect(status.inProgress).toBe(false)
        })
        it('should fetch first event from stream', async () => {
            const controller1 = new AbortController()
            const response1 = await client.fetch(sseUrl, {
                signal: controller1.signal,
            })
            const iterator1 = streamSseEvents(response1.body!)
            const event1 = await iterator1.next()
            expect(event1.done).toBe(false)
            expect(JSON.parse(event1.value.data)).toMatchInlineSnapshot(`
                  {
                    "counter": 1,
                    "message": "This is the first server-sent event.",
                    "randomId": "${randomId}",
                  }
                `)
            controller1.abort()
        })
        it('should check in-progress status', async () => {
            const status = await client.isInProgress(sseUrl)
            expect(typeof status.inProgress).toBe('boolean')
            expect(typeof status.activeConnections).toBe('number')
            expect(typeof status.chunksStored).toBe('number')
            expect(status.inProgress).toBe(true)
        })

        it('should resume stream from second event after first fetch', async () => {
            const controller2 = new AbortController()
            const response2 = await client.fetch(sseUrl, {
                signal: controller2.signal,
            })
            const iterator2 = streamSseEvents(response2.body!)
            const event2 = await iterator2.next()
            expect(event2.done).toBe(false)
            expect(JSON.parse(event2.value.data)).toMatchInlineSnapshot(`
                  {
                    "counter": 2,
                    "message": "This is the second server-sent event.",
                    "randomId": "${randomId}",
                  }
                `)
            controller2.abort()
        })

        it('should continue resuming stream from third event', async () => {
            const controller3 = new AbortController()
            const response3 = await client.fetch(sseUrl, {
                signal: controller3.signal,
            })
            const iterator3 = streamSseEvents(response3.body!)
            const event3 = await iterator3.next()
            expect(event3.done).toBe(false)
            expect(JSON.parse(event3.value.data)).toMatchInlineSnapshot(`
                  {
                    "counter": 3,
                    "message": "This is the third server-sent event.",
                    "randomId": "${randomId}",
                  }
                `)
            controller3.abort()
        })

        it('should fetch a single event and match raw text response', async () => {
            const singleEventUrl = `https://postman-echo.com/server-events/1?randomId=${randomId}`
            const response = await client.fetch(singleEventUrl)
            const responseText = await response.text()
            expect(responseText).toMatchInlineSnapshot(`
              "id: 1
              data: {\\"randomId\\":\\"${randomId}\\",\\"counter\\":1,\\"message\\":\\"This is the first server-sent event.\\"}
              name: message

              "
            `)
        })
    },
    { timeout: 30000 },
)

/**
 * Collects items from an async generator until a specified timeout.
 * @param generator The async generator to collect from
 * @param ms Timeout in milliseconds
 * @returns Promise that resolves to an array of collected items
 */
async function collectGeneratorUntil<T>(
    generator: AsyncGenerator<T>,
    ms: number,
): Promise<T[]> {
    const items: T[] = []
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), ms)
    })

    try {
        while (true) {
            const result = await Promise.race([
                generator.next(),
                timeoutPromise,
            ])
            if (result.done) break
            items.push(result.value)
        }
    } catch (error) {
        if (error.message !== 'Timeout') throw error
    }

    return items
}

/**
 * An async generator that wraps a response stream and yields parsed SSE events.
 * This function uses `EventSourceParserStream` to handle the transformation.
 * @param stream The ReadableStream from the response body.
 * @returns An async generator that yields `EventSourceMessage` objects.
 */
async function* streamSseEvents(
    stream: ReadableStream<Uint8Array>,
): AsyncGenerator<EventSourceMessage> {
    const eventStream = stream
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream())

    const reader = eventStream.getReader()
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            yield value
        }
    } finally {
        reader.releaseLock()
    }
}
