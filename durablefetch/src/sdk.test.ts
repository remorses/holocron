import {
    type EventSourceMessage,
    EventSourceParserStream,
} from 'eventsource-parser/stream'
import { describe, it, expect } from 'vitest'
import { defaultDurablefetchHost, DurableFetchClient } from './sdk'

describe(
    'DurableFetchClient',
    () => {
        const iterationInterval = 300
        const client = new DurableFetchClient()
        const randomId = Math.random().toString(36).substring(7)
        const sseUrl = `https://${defaultDurablefetchHost}/durablefetch-example-stream-sse?n=5&randomId=${randomId}`
        console.log(sseUrl)
        it('should check in-progress status', async () => {
            const status = await client.isInProgress(sseUrl)
            expect(status).toMatchInlineSnapshot(`
              {
                "activeConnections": 0,
                "chunksStored": 0,
                "completed": false,
                "inProgress": false,
              }
            `)
        })

        it('should fetch a single event and match raw text response', async () => {
            const singleEventUrl = `https://${defaultDurablefetchHost}/durablefetch-example-stream-sse?n=1&randomId=${randomId}`
            const response = await client.fetch(singleEventUrl)
            expect(response.headers.get('x-example')).toBe('test')
            const responseText = await response.text()
            expect(responseText).toMatchInlineSnapshot(`
              "data: {"number":1}

              data: [DONE]

              "
            `)
        })
        it('should fetch first events from stream', async () => {
            const controller1 = new AbortController()
            const response1 = await client.fetch(sseUrl, {
                signal: controller1.signal,
            })
            expect(response1.headers.get('x-example')).toBe('test')
            const iterator1 = streamSseEvents(response1.body!)
            const events = await collectGeneratorUntil(
                iterator1,
                iterationInterval,
            )
            console.log('aborting')
            controller1.abort()

            expect(events.map((e) => e.data)).toMatchInlineSnapshot(`
              [
                "{"number":1}",
              ]
            `)
        })
        it('should check in-progress status', async () => {
            const status = await client.isInProgress(sseUrl)
            expect(status).toMatchInlineSnapshot(`
              {
                "activeConnections": 1,
                "chunksStored": 1,
                "completed": false,
                "inProgress": true,
              }
            `)
            expect(status.inProgress).toBe(true)
        })

        it('should resume stream from third event', async () => {
            const controller2 = new AbortController()
            const response2 = await client.fetch(sseUrl, {
                signal: controller2.signal,
            })
            expect(response2.headers.get('x-example')).toBe('test')
            const iterator2 = streamSseEvents(response2.body!)
            const events = await collectGeneratorUntil(
                iterator2,
                iterationInterval,
            )
            console.log('aborting')
            controller2.abort()

            expect(events.map((e) => e.data)).toMatchInlineSnapshot(`
              [
                "{"number":1}",
                "{"number":2}",
                "{"number":3}",
              ]
            `)
        })

        it('should continue resuming stream and get the last event', async () => {
            const controller3 = new AbortController()
            const response3 = await client.fetch(sseUrl, {
                signal: controller3.signal,
            })
            expect(response3.headers.get('x-example')).toBe('test')
            const iterator3 = streamSseEvents(response3.body!)
            const events = await collectGeneratorUntil(
                iterator3,
                iterationInterval,
            )
            console.log('aborting')
            controller3.abort()

            expect(events.map((e) => e.data)).toMatchInlineSnapshot(`
              [
                "{"number":1}",
                "{"number":2}",
                "{"number":3}",
                "{"number":4}",
              ]
            `)
        })

        it('should continue resuming stream and get the last event 1', async () => {
            const response3 = await client.fetch(sseUrl, {})
            expect(response3.headers.get('x-example')).toBe('test')
            const iterator3 = streamSseEvents(response3.body!)
            const events = await collectGeneratorUntil(iterator3, 1000 * 10)

            expect(events.map((e) => e.data)).toMatchInlineSnapshot(`
              [
                "{"number":1}",
                "{"number":2}",
                "{"number":3}",
                "{"number":4}",
                "{"number":5}",
                "[DONE]",
              ]
            `)
        })

        it('should continue resuming stream and get the last event 1', async () => {
            const response3 = await client.fetch(sseUrl, {})
            expect(response3.headers.get('x-example')).toBe('test')
            const iterator3 = streamSseEvents(response3.body!)
            const events = await collectGeneratorUntil(iterator3, 1000 * 10)

            expect(events.map((e) => e.data)).toMatchInlineSnapshot(`
              [
                "{"number":1}",
                "{"number":2}",
                "{"number":3}",
                "{"number":4}",
                "{"number":5}",
                "[DONE]",
              ]
            `)
        })
        it('should check in-progress status', async () => {
            const status = await client.isInProgress(sseUrl)
            expect(status).toMatchInlineSnapshot(`
              {
                "activeConnections": 0,
                "chunksStored": 6,
                "completed": true,
                "inProgress": false,
              }
            `)
            expect(status.inProgress).toBe(false)
            expect(status.completed).toBe(true)
        })
    },
    30 * 1000,
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
    const eventStream = stream.pipeThrough(new TextDecoderStream()).pipeThrough(
        new EventSourceParserStream({
            onError: (e) => console.error('eventsource-parser error', e),
        }),
    )

    const reader = eventStream.getReader()
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            console.log(value)
            yield value
        }
    } finally {
        reader.releaseLock()
    }
}
