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
