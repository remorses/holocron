'use client'

import React, { useState, useRef } from 'react'

export function SidebarAssistant() {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    const text = inputValue.trim()
    if (!text) return
    setInputValue('')
    // TODO: open right-side drawer with assistant response
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className='w-full rounded-2xl bg-foreground/8 px-0.5 pt-px pb-0.5'>
      <div className='flex items-center gap-1.5 px-2.5 py-1.5'>
        <svg width='12' height='12' viewBox='0 0 16 16' fill='currentColor' className='text-(color:--text-secondary) shrink-0'>
          <path d='M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm9-3a1 1 0 11-2 0 1 1 0 012 0zM6.92 7.42a.75.75 0 01.99-.37.25.25 0 01.14.22v3.48a.25.25 0 01-.25.25H7a.75.75 0 010-1.5h.25V8.35a.75.75 0 01-.33-.93z' />
        </svg>
        <span className='text-[11px] text-(color:--text-secondary)'>Ask AI about this page</span>
      </div>
      <div className='bg-background rounded-[15px] p-2 flex flex-col gap-1.5'>
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='How can I help?'
          rows={1}
          className='w-full resize-none border-0 bg-transparent text-xs leading-5 text-(color:--text-primary) placeholder:text-(color:--text-tertiary) outline-none [field-sizing:content] min-h-5 max-h-40'
        />
        <div className='flex items-center justify-end'>
          <button
            onClick={handleSubmit}
            className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
              inputValue.trim()
                ? 'bg-foreground text-background'
                : 'bg-foreground/[0.06] text-(color:--text-tertiary)'
            }`}
            aria-label='Send message'
          >
            <svg width='12' height='12' viewBox='0 0 16 16' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M8 12V4M4 8l4-4 4 4' />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
