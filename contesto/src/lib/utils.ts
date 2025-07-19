import memoizePkg from 'micro-memoize'
const memoize = memoizePkg['default'] || memoizePkg

export async function* readableStreamToAsyncIterable<T>(
    stream: ReadableStream<T>,
): AsyncIterableIterator<T> {
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

/**
 * teeAsync(iterable) → [cloneA, cloneB]
 * -------------------------------------
 * Clones any AsyncIterable<T> using ReadableStream.tee().
 */

export function teeAsyncIterable<T>(
    iterable: AsyncIterable<T>,
): [AsyncIterableIterator<T>, AsyncIterableIterator<T>] {
    const srcIter = iterable[Symbol.asyncIterator]()

    // Wrap the source iterator in a stream.
    const srcStream = new ReadableStream<T>({
        async pull(ctrl) {
            try {
                const { value, done } = await srcIter.next()
                done ? ctrl.close() : ctrl.enqueue(value as T)
            } catch (err) {
                ctrl.error(err)
            }
        },
        async cancel() {
            if (typeof srcIter.return === 'function') {
                try {
                    await srcIter.return()
                } catch {
                    /* ignore */
                }
            }
        },
    })

    // Duplicate the stream and convert each branch back into an iterator.
    const [s1, s2] = srcStream.tee()
    return [
        readableStreamToAsyncIterable(s1),
        readableStreamToAsyncIterable(s2),
    ]
}

export async function* throttleGenerator<T>(
    generator: AsyncIterable<T>,
    delayMs: number = 16,
): AsyncIterable<T[]> {
    let buffer: T[] = []
    let lastYield = 0

    for await (const item of generator) {
        buffer.push(item)

        const now = Date.now()
        if (now - lastYield >= delayMs) {
            yield [...buffer]
            buffer = []
            lastYield = now
        }
    }

    if (buffer.length > 0) {
        yield buffer
    }
}

export function isReadableStream(obj: any): obj is ReadableStream<any> {
    return (
        obj != null &&
        typeof obj === 'object' &&
        typeof obj.getReader === 'function' &&
        typeof obj.tee === 'function' &&
        typeof obj.cancel === 'function'
    )
}
