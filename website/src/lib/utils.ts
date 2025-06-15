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
