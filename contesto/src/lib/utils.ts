import memoizePkg from 'micro-memoize'
const memoize = memoizePkg['default'] || memoizePkg

export async function* readableStreamToAsyncIterable<T>(
    stream: ReadableStream<T>
): AsyncIterable<T> {
    const reader = stream.getReader()
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

export { memoize }
