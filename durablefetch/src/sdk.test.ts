import { describe, it, expect } from 'vitest'
import { DurableFetchClient } from './sdk'

describe('DurableFetchClient', () => {
    const client = new DurableFetchClient()
    const sseUrl =
        'https://stream.wikimedia.org/v2/stream/recentchange?randomId=' +
        Math.random().toString(36).substring(7)

    console.log('Testing with SSE URL:', sseUrl)

    it('should fetch SSE stream and allow abort', async () => {
        console.log('Starting test: fetch SSE stream and allow abort')
        const controller = new AbortController()

        console.log('Fetching SSE stream...')
        const response = await client.fetch(sseUrl, {
            signal: controller.signal,
        })

        console.log('Response status:', response.status, response.statusText)
        expect(response.ok).toBe(true)

        // Start reading then abort
        console.log('Getting reader and reading first chunk...')
        const reader = response.body?.getReader()
        const firstChunk = await reader?.read()
        console.log(
            'First chunk received, done:',
            firstChunk?.done,
            'bytes:',
            firstChunk?.value?.length,
        )
        expect(firstChunk?.done).toBe(false)

        console.log('Aborting request...')
        controller.abort()
        reader?.releaseLock()
        console.log('Request aborted and reader released')
    })

    it('should fetch same stream again after abort', async () => {
        console.log('Starting test: fetch same stream again after abort')

        console.log('Fetching same SSE stream again...')
        const response = await client.fetch(sseUrl)

        console.log('Response status:', response.status, response.statusText)
        expect(response.ok).toBe(true)

        console.log('Getting reader and reading chunk...')
        const reader = response.body?.getReader()
        const chunk = await reader?.read()
        console.log(
            'Chunk received, done:',
            chunk?.done,
            'bytes:',
            chunk?.value?.length,
        )
        expect(chunk?.done).toBe(false)
        expect(chunk?.value).toBeDefined()

        reader?.releaseLock()
        console.log('Reader released')
    })

    it('should check in-progress status', async () => {
        console.log('Starting test: check in-progress status')

        console.log('Checking in-progress status for URL:', sseUrl)
        const status = await client.isInProgress(sseUrl)

        console.log('Status received:', status)
        expect(typeof status.inProgress).toBe('boolean')
        expect(typeof status.activeConnections).toBe('number')
        expect(typeof status.chunksStored).toBe('number')

        console.log('In progress:', status.inProgress)
        console.log('Active connections:', status.activeConnections)
        console.log('Chunks stored:', status.chunksStored)
    })
})
