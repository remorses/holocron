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

export function MessageCircleIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 16 16'
      fill='currentColor'
    >
      <path d='M8 1.5a6.5 6.5 0 00-4.88 10.92L1.8 14.6a.5.5 0 00.62.65l2.4-.8A6.5 6.5 0 108 1.5z' />
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

export function HolocronLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 155.7 40'
      fill='currentColor'
      aria-label='Holocron'
      role='img'
      className={className}
    >
      <path d='m113 22c-0.4-1.2-1.1-2-3-2s-5.4 2.8-7.4 5.2l0.2-0.2c0-0.1 1.2-2.8 1.6-3.9 0.2-1.1-0.4-2.4-2.4-2.4-0.7 0-1.3 1.1-1.6 2l-1.7 3.7c-2 2.9-8.1 8.9-14.1 9.1-1.9 0-3.4-1-3.2-3.5 0.2-2.4 5.2-7.4 8-7.2 0.6 0.1-0.9 3.2 1.7 2.9 2.9-0.7 3-6.6-1.8-6.6-2.6 0-5.6 1.8-8.3 4.5-1.5-0.8-4-0.2-5.7-1.8-1-1-1.8-2.6-5.1-2.6-2.5 0-5.5 2-7.9 5.4-1.5 2.2-3.4 4.5-7.3 7.4-3.6 2.3-5.7 1.4-5.4-3.2 2.4-2.2 12.3-11.7 14-19.3 1.4-5.9-2.8-7.8-6-4.9-4.2 3.9-7.8 11.9-10.3 18.4-2.3 0.2-4.5 0.1-6.1-1.8s-7.2-4.8-12.8 4.1l-1.5 2.2c-0.9 1.1-4.8 4.9-6.6 5.3-3.4 0.6 2.7-8.1 1.1-11.4-2.1-4.8-8.3 0.3-11 2.8 2-2.7 7.8-15.6 9.2-18.7 0.7-1.4-1.5-3.8-3.1-1.9-2.5 4.3-7.1 14.9-10.1 20.1-1.4 2.6-3 4.8-4.5 6.7-0.7 0.9-0.2 2.2 0.7 3-0.1 0.1-1.7 3.2 1.7 3.2 0.6 0 1.2-0.9 1.8-2 2.2-3 7.2-8.7 10.9-10.9 3.4-1.8-2.7 6.4-1.4 10.4 0.7 2.3 3.3 2.9 6 1.7 1.6-0.8 3.3-2 4.9-3.6 0.5 2.3 2.1 4.4 5.6 4.4 4.7 0 9.6-5.7 10-10.7 1 0.3 2.9 0.4 4.1 0.4-1.1 6.3 0.8 10.2 5.4 10.2 2.8 0 5.5-1.6 8-4.1 0.5 3 3 4.2 6 4.2 4.3 0 9.8-5.7 9.6-10.8l3.9 0.4h0.1c-0.6 1.1-1.3 2.6-1.4 4.1-0.2 2.8 1.6 6.2 5.9 6.2 3.7 0.3 7.9-1.6 11.6-4.2-0.5 1.2-0.9 2.1-0.7 3 0.4 2.1 2.8 1.4 3.2 0.8 2.6-4.6 7.8-10.6 11.4-12.4h0.3c0.8 1.3 1.2 4 3.1 3.8 0.7 0 1.5-0.6 1.7-2.1-0.6-0.8-1.2-2.3-1.3-3.4zm-52.9-15.2c0.8 1.1-1.5 7.2-8.4 14.8l-0.5 0.5c2.4-4.7 5-12.2 8.9-15.3zm-27.9 26.6c-3.2 0.1-2.2-4.7-0.1-7.3 1.1-1.7 2.8-3.3 4.3-3.5 0.4 1.5 1.3 1.8 2.3 2.3 0.4 4.2-4 8.2-6.5 8.5zm33 0.1c-2.6 0-2.2-4.7 1-8.2 1.2-1.5 2.7-2.5 3.5-2.5 0.2 1.5 1.4 1.8 2 2.1 0.3 3.9-4.3 8.6-6.5 8.6z' />
      <path d='m152.1 28.8c-0.6 0-3 3.2-5 3.7-2.1 0.5 0.5-4.6 1.4-7.9 0.3-3.2-1.2-5.4-4-4.6-2.6 0.9-5.8 3.8-6.9 5.4h0.3-0.2l-0.1 0.2 0.2-0.1c-0.1 0-0.2 0.1-0.2 0.1h-0.1l0.2-0.1-0.1 0.1h-0.1l0.3-0.1-0.2 0.1 0.3-0.3-0.1 0.1-0.1 0.2h-0.5c0.8-1.6 3-5.1 2-6-0.5-1-2.1-1-2.6-0.4-0.6 0.7-1.1 2.1-1.6 3.6-2.9 0.7-5.6 0-6.8-1.6-0.6-0.8-2.1-2.1-4.8-2.1-3.6 0-9.2 5-10 10.5-0.4 3.9 1.2 7 5.2 7 5.4 0.2 10.4-6.5 10.4-10.8l4.5 0.5c-1 2.7-3.3 7.2-3.4 8.7 0.1 2.1 2.5 2 3.3 1.1 3.2-5.2 10.2-12 11.2-12 1.3 0.8-3.6 7.9-0.5 11.3 2.8 2.6 8.9-2.5 10-4.4 0.9-1.1-0.6-2.9-2-2.2zm-33.5 4.6c-2.6-0.8-1-7.1 3.2-10l0.3-0.2 0.5-0.3 0.6-0.2c0.4 1.4 1.3 1.7 2.2 2.2 0.7 3.5-4.5 9-6.8 8.5z' />
    </svg>
  )
}
