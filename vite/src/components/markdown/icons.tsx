'use client'

/**
 * Inline SVG icons used by the sidebar (chevron + search magnifier).
 */

export function ChevronIcon({ expanded, className, animate }: { expanded: boolean; className?: string; animate?: boolean }) {
  return (
    <span className={`shrink-0 self-center inline-flex items-center justify-center p-1 -m-1 cursor-pointer ${className ?? ''}`}>
      <svg
        aria-hidden='true'
        viewBox='0 0 16 16'
        width='12'
        height='12'
        className={animate !== false ? 'transition-transform duration-150' : ''}
        style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
      >
        <path d='M6 4l4 4-4 4' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
    </span>
  )
}

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      width='14'
      height='14'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <circle cx='11' cy='11' r='8' />
      <path d='m21 21-4.34-4.34' />
    </svg>
  )
}
