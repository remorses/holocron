import clsx from 'clsx'
import React from 'react'

export function Expandable({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)

  return (
    <div className='border border-border rounded-lg my-4'>
      <button
        onClick={() => {
          setIsOpen(!isOpen)
        }}
        className='w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors'
      >
        <span className='font-medium'>{title}</span>
        <svg
          className={clsx('size-4 transition-transform', isOpen && 'rotate-180')}
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'
        >
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
        </svg>
      </button>
      {isOpen && <div className='px-4 pb-4 border-t border-border'>{children}</div>}
    </div>
  )
}
