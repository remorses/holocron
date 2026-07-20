/**
 * Inline SVG icons for the chat assistant UI.
 * All icons use currentColor so they inherit the parent's text color.
 */

export function InfoCircleIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 16 16'
      fill='currentColor'
    >
      <path d='M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm9-3a1 1 0 11-2 0 1 1 0 012 0zM6.92 7.42a.75.75 0 01.99-.37.25.25 0 01.14.22v3.48a.25.25 0 01-.25.25H7a.75.75 0 010-1.5h.25V8.35a.75.75 0 01-.33-.93z' />
    </svg>
  )
}

export function SparkleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='currentColor'
    >
      <path d='M11.06 3.63a1 1 0 011.88 0l1.62 4.42a1 1 0 00.59.6l4.42 1.61a1 1 0 010 1.88l-4.42 1.62a1 1 0 00-.6.59l-1.61 4.42a1 1 0 01-1.88 0l-1.62-4.42a1 1 0 00-.59-.6l-4.42-1.61a1 1 0 010-1.88l4.42-1.62a1 1 0 00.6-.59l1.61-4.42z' />
      <path d='M19.3 15.8a.5.5 0 01.94 0l.53 1.43 1.43.53a.5.5 0 010 .94l-1.43.53-.53 1.43a.5.5 0 01-.94 0l-.53-1.43-1.43-.53a.5.5 0 010-.94l1.43-.53.53-1.43z' />
    </svg>
  )
}

export function ArrowRightIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 16 16'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.75'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M3 8h10M9 4l4 4-4 4' />
    </svg>
  )
}

export function ArrowUpIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 16 16'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M8 12V4M4 8l4-4 4 4' />
    </svg>
  )
}

export function StopSquareIcon({ size = 10 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 10 10'
      fill='currentColor'
    >
      <rect width='10' height='10' rx='1.5' />
    </svg>
  )
}

export function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <polyline points='3 6 5 6 21 6' />
      <path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
    </svg>
  )
}

export function PlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <line x1='12' y1='5' x2='12' y2='19' />
      <line x1='5' y1='12' x2='19' y2='12' />
    </svg>
  )
}

export function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <line x1='18' y1='6' x2='6' y2='18' />
      <line x1='6' y1='6' x2='18' y2='18' />
    </svg>
  )
}

export function MenuIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <line x1='3' y1='6' x2='21' y2='6' />
      <line x1='3' y1='12' x2='21' y2='12' />
      <line x1='3' y1='18' x2='21' y2='18' />
    </svg>
  )
}

export function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 16 16'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.5'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <rect x='5' y='5' width='9' height='9' rx='1.5' />
      <path d='M2 11V2.5A.5.5 0 012.5 2H11' />
    </svg>
  )
}

export function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 16 16'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.75'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M3 8.5l3.5 3.5 6.5-8' />
    </svg>
  )
}

export function RefreshIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M21 12a9 9 0 1 1-2.64-6.36' />
      <path d='M21 3v6h-6' />
    </svg>
  )
}

export function ChevronDownIcon({
  size = 16,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M6 9l6 6 6-6' />
    </svg>
  )
}
