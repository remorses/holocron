export function Chevron() {
  return (
    <span className='ml-auto flex shrink-0 items-center text-muted-foreground'>
      <svg className='block h-4 w-4 group-open:hidden' viewBox='0 0 16 16' fill='none' aria-hidden='true'>
        <path d='M6 4.5 9.5 8 6 11.5' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
      <svg className='hidden h-4 w-4 group-open:block' viewBox='0 0 16 16' fill='none' aria-hidden='true'>
        <path d='M4.5 6 8 9.5 11.5 6' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
    </span>
  )
}