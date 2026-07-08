/**
 * Client component that mounts the standalone ChatWidget and exposes
 * useChatWidget() controls for testing the full widget API surface.
 *
 * Validates: shadow DOM rendering, CSS injection, cross-origin RSC streaming,
 * portal targeting, default/custom trigger, and the hook API.
 */

'use client'

import { useState } from 'react'
import { ChatWidget, useChatWidget, defineTool, pageTools } from '@holocron.so/vite/chat'
import { z } from 'zod'

function CustomTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type='button'
      onClick={onClick}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        padding: '12px 20px',
        borderRadius: 12,
        border: '1px solid #e5e5e5',
        background: '#fff',
        color: '#1a1a1a',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 500,
        boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)',
        zIndex: 199,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 18 }}>💬</span>
      Ask AI
    </button>
  )
}

function WidgetControls() {
  const { isOpen, isGenerating, messages, open, close, toggle, clear } =
    useChatWidget()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        borderRadius: 8,
        border: '1px solid #e5e5e5',
        background: '#fafafa',
      }}
    >
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
        useChatWidget() state
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          fontSize: 13,
          fontFamily: 'monospace',
        }}
      >
        <div>
          isOpen: <strong>{String(isOpen)}</strong>
        </div>
        <div>
          isGenerating: <strong>{String(isGenerating)}</strong>
        </div>
        <div>
          messages: <strong>{messages.length}</strong>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['open', 'close', 'toggle', 'clear'] as const).map((action) => (
          <button
            key={action}
            type='button'
            onClick={{ open, close, toggle, clear }[action]}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid #d4d4d4',
              background: '#fff',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {action}()
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Example client-side tools ───────────────────────────────────────

const exampleTools = [
  defineTool({
    name: 'get_time',
    description: 'Get the current date and time.',
    input: z.object({}),
    async run() {
      return { time: new Date().toISOString() }
    },
  }),

  ...pageTools([
    {
      path: '/',
      description: 'Main test page with email input, theme controls, and chat widget controls.',
      actions: [
        { name: 'update_email', description: 'Type into the email input field', selector: 'input[name=email]' },
        { name: 'save', description: 'Click the Save button', selector: 'button[data-action=save]' },
        { name: 'delete_account', description: 'Delete the account (destructive, requires approval)', selector: 'button[data-action=delete-account]' },
      ],
    },
  ]),
]

const exampleContext = {
  userId: 'u_demo_1',
  email: 'tommy@example.com',
  plan: 'pro',
}

// ── ChatDemo ────────────────────────────────────────────────────────

const themeOptions = ['system', 'light', 'dark'] as const
type Theme = (typeof themeOptions)[number]

/** Docs site the widget talks to. Overridable via ?domain=<host> so the
 *  example can point at any running holocron site (e.g. a tunnel URL)
 *  without editing code. Read lazily — location doesn't exist during SSR. */
function getWidgetDomain(): string {
  if (typeof location === 'undefined') return 'localhost:7664'
  return new URLSearchParams(location.search).get('domain') || 'localhost:7664'
}

export function ChatDemo() {
  const [useCustomTrigger, setUseCustomTrigger] = useState(false)
  const [theme, setTheme] = useState<Theme>('system')
  const [email, setEmail] = useState('old@example.com')
  const [domain] = useState(getWidgetDomain)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 24 }}>ChatWidget standalone test</h1>
        <p style={{ margin: '8px 0 0', color: '#666' }}>
          This page tests the <code>{'<ChatWidget>'}</code> component from{' '}
          <code>@holocron.so/vite/chat</code> in a plain spiceflow app. Click
          the bubble (bottom-right) to open the chat drawer, or use the controls
          below.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type='checkbox'
              checked={useCustomTrigger}
              onChange={(e) => setUseCustomTrigger(e.target.checked)}
            />
            Custom trigger
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 500 }}>Theme:</span>
            {themeOptions.map((t) => (
              <button
                key={t}
                type='button'
                onClick={() => setTheme(t)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid #d4d4d4',
                  background: theme === t ? '#0a0a0a' : '#fff',
                  color: theme === t ? '#fff' : '#1a1a1a',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: theme === t ? 600 : 400,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <WidgetControls />
      </div>

      {/* Test form for browser tools */}
      <div
        style={{
          padding: 16,
          borderRadius: 8,
          border: '1px solid #e5e5e5',
          background: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
          Test form (for browser tools)
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 500 }}>Email:</label>
          <input
            name='email'
            type='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #d4d4d4',
              fontSize: 13,
              flex: 1,
            }}
          />
          <button
            type='button'
            data-action='save'
            onClick={() => alert(`Saved email: ${email}`)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid #d4d4d4',
              background: '#0a0a0a',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Save
          </button>
          {/* Protected action: browser_click on this button shows an
              Approve/Deny prompt with the attribute value as the message */}
          <span data-holocron-requires-approval='This will delete the demo account'>
            <button
              type='button'
              data-action='delete-account'
              onClick={() => alert('Account deleted!')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid #dc2626',
                background: '#fff',
                color: '#dc2626',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Delete account
            </button>
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: '#999' }}>
          Try asking the AI: "change the email to newemail@test.com", "what time is
          it?", or "delete my account" (requires approval).
        </p>
      </div>

      <div
        style={{
          padding: 16,
          borderRadius: 8,
          border: '1px solid #e5e5e5',
          background: '#f5f5f5',
          fontSize: 14,
          color: '#666',
        }}
      >
        <p style={{ margin: 0 }}>
          <strong>What this validates:</strong> shadow DOM rendering, CSS
          injection, cross-origin RSC federation streaming from holocron.so,
          portal targeting (drawer backdrop inside shadow root), default and
          custom triggers, theme switching, the useChatWidget() hook API,
          client-side tool execution (get_time, browser_* tools), and user
          context injection.
        </p>
      </div>

      <ChatWidget
        domain={domain}
        siteName='Holocron Docs'
        theme={theme}
        trigger={useCustomTrigger ? CustomTrigger : undefined}
        tools={exampleTools}
        context={exampleContext}
      />
    </div>
  )
}
