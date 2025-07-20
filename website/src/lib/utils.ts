import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { cn } from './cn'
import JSONC from 'tiny-jsonc'
export const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export { cn }

export const isTruthy = <T>(value: T): value is NonNullable<T> => {
    return Boolean(value)
}

export const safeJsoncParse = <T = unknown>(json: string): T | null => {
    try {
        return JSONC.parse(json)
    } catch {
        return null
    }
}

export function splitExtension(str: string): {
    base: string
    extension: string
} {
    const lastSlash = str.lastIndexOf('/')
    const lastDot = str.lastIndexOf('.')
    // Extension must come after the last slash and dot is not the first character after slash.
    if (lastDot > lastSlash + 1) {
        return {
            base: str.slice(0, lastDot),
            extension: str.slice(lastDot), // includes the dot
        }
    }
    return {
        base: str,
        extension: '',
    }
}

export function slugKebabCaseKeepExtension(str: string): string {
    const { base, extension } = splitExtension(str)
    // slugify base path
    let slug = base
        .toLowerCase()
        .split('/')
        .map((segment) => segment.split(' ').filter(Boolean).join('-'))
        .join('-')
        .replace(/-+/g, '-') // collapse multiple dashes
    if (slug.endsWith('-')) slug = slug.slice(0, -1)
    // Just concat extension if exists; keep as is because prompt says "keep it as is"
    return slug + extension
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



export async function* processGeneratorConcurrentlyInOrder<T, R>(
    iterable: AsyncIterable<T>,
    maxConcurrent = 3,
    mapper: (item: T) => Promise<R>,
): AsyncGenerator<R> {
    const queue: Promise<R>[] = []
    const iterator = iterable[Symbol.asyncIterator]()
    let done = false

    // fill the queue
    while (queue.length < maxConcurrent) {
        const { value, done: iterDone } = await iterator.next()
        if (iterDone) {
            done = true
            break
        }
        queue.push(mapper(value))
    }

    while (queue.length) {
        const nextPromise = queue.shift()!
        // Start next only if not done
        if (!done) {
            const { value, done: iterDone } = await iterator.next()
            if (!iterDone) {
                queue.push(mapper(value))
            } else {
                done = true
            }
        }
        yield await nextPromise
    }
}

