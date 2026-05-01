'use client'

/** Mintlify-compatible Frame component using Holocron surface tokens. */

import React from 'react'

export function Frame({
  as: Component = 'div',
  title,
  description,
  caption,
  hint,
  style,
  className = '',
  children,
}: {
  as?: React.ElementType
  title?: string
  description?: string
  caption?: string
  hint?: string
  style?: React.CSSProperties
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className} data-component-part='frame-container'>
      {title && (
        <div className='not-prose flex items-center gap-2 pb-4'>
          <svg
            aria-hidden='true'
            className='size-4 flex-none fill-current text-muted-foreground'
            viewBox='0 0 512 512'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path d='M224 320c0 17.69 14.33 32 32 32h64c17.67 0 32-14.31 32-32s-14.33-32-32-32h-64C238.3 288 224 302.3 224 320zM267.6 256H352c17.67 0 32-14.31 32-32s-14.33-32-32-32h-80v40C272 240.5 270.3 248.5 267.6 256zM272 160H480c17.67 0 32-14.31 32-32s-14.33-32-32-32h-208.8C271.5 98.66 272 101.3 272 104V160zM320 416c0-17.69-14.33-32-32-32H224c-17.67 0-32 14.31-32 32s14.33 32 32 32h64C305.7 448 320 433.7 320 416zM202.1 355.8C196 345.6 192 333.3 192 320c0-5.766 1.08-11.24 2.51-16.55C157.4 300.6 128 269.9 128 232V159.1C128 151.2 135.2 144 143.1 144S160 151.2 159.1 159.1l0 69.72C159.1 245.2 171.3 271.1 200 271.1C222.1 271.1 240 254.1 240 232v-128C240 81.91 222.1 64 200 64H136.6C103.5 64 72.03 80 52.47 106.8L26.02 143.2C9.107 166.5 0 194.5 0 223.3V312C0 387.1 60.89 448 136 448h32.88C163.4 438.6 160 427.7 160 416C160 388.1 178 364.6 202.1 355.8z' />
          </svg>
          <div className='font-medium text-sm text-foreground'>{title}</div>
        </div>
      )}
      <Component
        className='not-prose relative overflow-hidden rounded-2xl bg-muted/30 p-2'
        data-component-part='frame'
        data-name='frame'
        style={style}
      >
        <div
          aria-hidden='true'
          className='absolute inset-0 opacity-50'
          data-component-part='frame-background-pattern'
          style={{
            backgroundImage: 'linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            backgroundPosition: '10px 10px',
          }}
        />
        <div
          className='relative flex w-full justify-center overflow-hidden rounded-xl bg-background'
          data-component-part='frame-content'
        >
          {children}
        </div>

        {(description || caption || hint) && (
          <div
            className='relative flex w-full justify-center rounded-2xl bg-background px-8 pb-2 pt-3 text-sm text-muted-foreground'
            contentEditable={false}
            data-component-part='frame-description'
          >
            {description ?? caption ?? hint}
          </div>
        )}
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 rounded-2xl border border-border-subtle'
          data-component-part='frame-border'
        />
      </Component>
    </div>
  )
}
