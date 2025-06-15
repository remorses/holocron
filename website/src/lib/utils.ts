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

export async function* inParallel(tasks, concurrency = Infinity) {
    const queue = tasks.slice() // ✓ don’t mutate caller’s array
    const pending = queue
        .splice(0, concurrency) // start the first batch
        .map((fn) => fn())

    while (pending.length) {
        // tag the *current* pending list so we know which one wins the race
        const tagged = pending.map((p, i) =>
            p.then(
                (value) => ({ i, value, ok: true }),
                (err) => ({ i, err, ok: false }),
            ),
        )

        const { i, value, err, ok } = await Promise.race(tagged)

        pending.splice(i, 1) // drop the finished promise
        if (queue.length) pending.push(queue.shift()()) // top up to the limit

        if (ok)
            yield value // stream the value
        else throw err // abort on first error
    }
}
