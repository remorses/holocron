import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export const isTruthy = <T>(value: T): value is NonNullable<T> => {
    return Boolean(value)
}

export const safeJsonParse = <T = unknown>(json: string): T | null => {
    try {
        return JSON.parse(json)
    } catch {
        return null
    }
}

export function slugKebabCase(str) {
    return str
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/\//g, '-')
        .replace(/\./g, '-')
        .replace(/-+/g, '-')
        .toLowerCase()
}

export const mdxRegex = /\.mdx?$/

export async function* yieldTasksInParallel<T>(
    concurrency = Infinity,
    tasks: Array<() => Promise<T>>,
) {
    const queue = tasks.slice() // ✓ don’t mutate caller’s array
    const pending = queue
        .splice(0, concurrency) // start the first batch
        .map((fn) => fn())

    while (pending.length) {
        // tag the *current* pending list so we know which one wins the race
        const tagged = pending.map((p, i) =>
            p.then(
                (value: T) => ({ i, value, ok: true as const }),
                (err: any) => ({ i, err, ok: false as const }),
            ),
        )

        const result = await Promise.race(tagged)

        pending.splice(result.i, 1) // drop the finished promise
        if (queue.length) {
            const nextFn = queue.shift()
            if (nextFn) pending.push(nextFn())
        }

        if (result.ok)
            yield result.value // stream the value
        else throw result.err // abort on first error
    }
}

/**
 * Splits an array into groups of size N.
 * @param arr The input array.
 * @param n The size of each group.
 * @returns An array of arrays, each of which is at most length n.
 */
export function groupByN<T>(arr: T[], n: number): T[][] {
    if (n <= 0) throw new Error('n must be greater than 0')
    const result: T[][] = []
    for (let i = 0; i < arr.length; i += n) {
        result.push(arr.slice(i, i + n))
    }
    return result
}

export function debounce<T extends (...args: any[]) => any>(
    delay: number,
    fn: T,
): T {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let pendingPromise: Promise<any> | null = null
    return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
        if (timeoutId) clearTimeout(timeoutId)
        if (pendingPromise) return pendingPromise
        pendingPromise = new Promise<any>((resolve, reject) => {
            timeoutId = setTimeout(() => {
                Promise.resolve(fn.apply(this, args))
                    .then(resolve, reject)
                    .finally(() => {
                        pendingPromise = null
                    })
            }, delay)
        })
        return pendingPromise
    } as any
}


// teeAsync.ts
// Requires the DOM lib for `ReadableStream` types (e.g. `tsconfig.json` → `"lib": ["esnext", "dom"]`).

/**
 * Turn a WHATWG ReadableStream<T> into an AsyncIterableIterator<T>.
 * Keeps the “reader” hidden so callers only see the iterator interface.
 */
export function streamToAsyncIterator<T>(
    stream: ReadableStream<T>,
): AsyncIterableIterator<T> {
    const reader = stream.getReader()

    return {
        async next(): Promise<IteratorResult<T>> {
            return reader.read() as Promise<IteratorResult<T>>
        },
        async return(value?: unknown): Promise<IteratorResult<T>> {
            await reader.cancel()
            return { value, done: true }
        },
        async throw(err: unknown): Promise<never> {
            await reader.cancel(err)
            throw err
        },
        [Symbol.asyncIterator]() {
            return this
        },
    }
}

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
    return [streamToAsyncIterator(s1), streamToAsyncIterator(s2)]
}
