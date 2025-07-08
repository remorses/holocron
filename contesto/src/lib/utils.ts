import memoizePkg from 'micro-memoize'
const memoize = memoizePkg['default'] || memoizePkg

export async function* readableStreamToAsyncIterable<T>(
    stream: ReadableStream<T>,
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

export function asyncIterableToReadableStream<T>(
    iterable: AsyncIterable<T>,
): ReadableStream<T> {
    return new ReadableStream<T>({
        async pull(controller) {
            const iterator = (this as any).iterator as
                | AsyncIterator<T>
                | undefined
            if (!iterator) {
                ;(this as any).iterator = iterable[Symbol.asyncIterator]()
            }
            const { value, done } = await (
                (this as any).iterator as AsyncIterator<T>
            ).next()
            if (done) {
                controller.close()
            } else {
                controller.enqueue(value)
            }
        },
        async cancel() {
            const iterator = (this as any).iterator as
                | AsyncIterator<T>
                | undefined
            if (iterator && typeof iterator.return === 'function') {
                await iterator.return()
            }
        },
    })
}

export { memoize }
