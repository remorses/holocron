// Shared utility helpers for composing Tailwind and shadcn-style classes.
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format an epoch-ms timestamp as "3 days ago", "just now", etc. */
export function timeAgo(epochMs: number): string {
  const seconds = Math.round((Date.now() - epochMs) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(seconds / 3600)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(seconds / 86400)
  if (days < 30) return `${days}d ago`
  const months = Math.round(seconds / 2592000)
  if (months < 12) return `${months}mo ago`
  const years = Math.round(seconds / 31536000)
  return `${years}y ago`
}

/** Format epoch-ms as "Jan 15, 2026" */
export function formatTime(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
