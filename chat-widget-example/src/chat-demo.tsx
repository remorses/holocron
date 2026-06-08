/**
 * Client component that mounts the standalone ChatWidget and exposes
 * useChatWidget() controls for testing the full widget API surface.
 *
 * Validates: shadow DOM rendering, CSS injection, cross-origin RSC streaming,
 * portal targeting, default/custom trigger, and the hook API.
 */

'use client'

import { useState } from 'react'
import { ChatWidget, useChatWidget } from '@holocron.so/vite/chat'

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

const themeOptions = ['system', 'light', 'dark'] as const
type Theme = (typeof themeOptions)[number]

export function ChatDemo() {
  const [useCustomTrigger, setUseCustomTrigger] = useState(false)
  const [theme, setTheme] = useState<Theme>('system')

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
          custom triggers, theme switching, and the useChatWidget() hook API.
        </p>
      </div>

      <ChatWidget
        domain='localhost:7664'
        siteName='Holocron Docs'
        theme={theme}
        trigger={useCustomTrigger ? CustomTrigger : undefined}
      />
    </div>
  )
}
