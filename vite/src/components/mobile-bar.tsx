'use client'

/**
 * Mobile toolbar shown under the logo bar on small screens (< lg).
 * "Ask AI" (left) opens the chat drawer,
 * "Menu" (right) opens the navigation drawer.
 */

import { chatState } from '../lib/chat-state.ts'
import { MenuIcon } from './chat-icons.tsx'

export function MobileBar() {
  return (
    <div className='flex items-center justify-between lg:hidden px-(--mobile-padding) py-2'>
      <button
        onClick={() => chatState.setState({ drawerState: 'open' })}
        style={{
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
        }}
      >
        Ask AI
      </button>
      <button
        onClick={() => chatState.setState({ navDrawerOpen: true })}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
        }}
      >
        <MenuIcon size={16} />
        Menu
      </button>
    </div>
  )
}
