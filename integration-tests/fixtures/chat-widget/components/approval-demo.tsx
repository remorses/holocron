/**
 * Client component for e2e testing of tool approvals. Imported in approval.mdx.
 *
 * Renders a test panel with a protected email input (wrapped in
 * data-holocron-requires-approval) and an unprotected display-name input,
 * plus a "Rename account" button the highlight test points at. Registers
 * the browser automation pageTools with the chat widget so the model can
 * type into the inputs (browser_type goes through the approval flow when
 * the target is inside a data-holocron-requires-approval container).
 */

'use client'

import { useEffect, useState } from 'react'
// Use the src/* export for internal modules not in the public API
import { chatWidgetStore } from '@holocron.so/vite/src/chat/chat-widget-store.ts'
import { pageTools } from '@holocron.so/vite/chat'

const browserTools = pageTools([
  {
    path: '/approval',
    description: 'Account management test page with email and display name inputs.',
    actions: [
      {
        name: 'change_email',
        description: 'Type a new email into the protected email input (requires approval)',
        selector: '[data-action="email-input"]',
      },
      {
        name: 'change_display_name',
        description: 'Type a new display name into the name input',
        selector: '[data-action="name-input"]',
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
  const [email, setEmail] = useState('old@example.com')
  const [name, setName] = useState('Old Name')

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
      <div data-testid='account-email'>Account email: {email}</div>
      <div data-testid='account-name'>Account name: {name}</div>
      <div className='flex flex-col gap-2'>
        <div data-holocron-requires-approval='This will change the account email'>
          <input
            data-action='email-input'
            aria-label='Email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className='rounded-md border border-border px-3 py-1'
          />
        </div>
        <input
          data-action='name-input'
          aria-label='Display name'
          value={name}
          onChange={(e) => setName(e.target.value)}
          className='rounded-md border border-border px-3 py-1'
        />
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
