/**
 * Client component for e2e testing of tool approvals. Imported in approval.mdx.
 *
 * Renders a test panel with a protected "Delete account" button (wrapped in
 * data-holocron-requires-approval) and an unprotected "Rename account" button,
 * and registers the browser automation pageTools with the chat widget so the
 * model can click them. Clicking either button mutates visible DOM state that
 * the e2e tests assert on.
 */

'use client'

import { useEffect, useState } from 'react'
// Use the src/* export for internal modules not in the public API
import { chatWidgetStore } from '@holocron.so/vite/src/chat/chat-widget-store.ts'
import { pageTools } from '@holocron.so/vite/chat'

const browserTools = pageTools([
  {
    path: '/approval',
    description: 'Account management test page with delete and rename buttons.',
    actions: [
      {
        name: 'delete_account',
        description: 'Click the Delete account button (destructive)',
        selector: '[data-action="delete-account"]',
      },
      {
        name: 'rename_account',
        description: 'Click the Rename account button',
        selector: '[data-action="rename-account"]',
      },
    ],
  },
])

export function ApprovalDemo() {
  const [status, setStatus] = useState('active')

  useEffect(() => {
    const prev = chatWidgetStore.getState().tools
    chatWidgetStore.setState({ tools: [...prev, ...browserTools] })
    return () => {
      const names = new Set(browserTools.map((t) => t.name))
      chatWidgetStore.setState({
        tools: chatWidgetStore.getState().tools.filter((t) => !names.has(t.name)),
      })
    }
  }, [])

  return (
    <div className='flex flex-col gap-3 rounded-lg border border-border p-4'>
      <div data-testid='account-status'>Account status: {status}</div>
      <div className='flex gap-2'>
        <div data-holocron-requires-approval='This will delete the test account'>
          <button
            type='button'
            data-action='delete-account'
            onClick={() => setStatus('deleted')}
            className='rounded-md border border-border px-3 py-1'
          >
            Delete account
          </button>
        </div>
        <button
          type='button'
          data-action='rename-account'
          onClick={() => setStatus('renamed')}
          className='rounded-md border border-border px-3 py-1'
        >
          Rename account
        </button>
      </div>
    </div>
  )
}
