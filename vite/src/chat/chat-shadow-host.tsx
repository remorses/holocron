'use client'

/**
 * ChatShadowHost — renders chat components inside a Shadow DOM for style
 * isolation when the widget is embedded in third-party pages.
 *
 * Uses React createPortal to render children into a mount point inside the
 * shadow DOM. This keeps a single React root (the parent app's) so there are
 * no dual-root lifecycle conflicts or HMR "removeChild" races.
 *
 * Pill ↔ drawer morph uses Motion layoutId. The drawer portals into a node
 * *inside* LayoutGroup (not the outer mount) so shared layout stays in one
 * projection tree.
 *
 * No SSR/DSD needed — the widget is client-only.
 */

import React, { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LayoutGroup } from 'motion/react'

import { chatCssBundle } from './chat-css-bundle.ts'

export function ChatShadowHost({
  children,
  className,
  style,
  dark,
  onMountPoint,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  dark?: boolean
  onMountPoint?: (mount: HTMLElement) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const portalRef = useRef<HTMLDivElement>(null)
  const [mountPoint, setMountPoint] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return

    const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' })

    if (!shadow.querySelector('style[data-holocron-chat]')) {
      const styleEl = document.createElement('style')
      styleEl.setAttribute('data-holocron-chat', '')
      styleEl.textContent = chatCssBundle
      shadow.appendChild(styleEl)
    }

    let mount = shadow.querySelector<HTMLDivElement>('[data-mount]')
    if (!mount) {
      mount = document.createElement('div')
      mount.setAttribute('data-mount', '')
      shadow.appendChild(mount)
    }

    // Token defaults target .holocron-chat; keep mount class in sync with theme.
    mount.className = dark ? 'holocron-chat dark' : 'holocron-chat'
    setMountPoint(mount)

    return () => {
      setMountPoint(null)
    }
  }, [dark])

  // Drawer portals here (inside LayoutGroup), not onto the outer mount.
  useLayoutEffect(() => {
    if (portalRef.current) onMountPoint?.(portalRef.current)
  }, [onMountPoint, mountPoint])

  return (
    <div
      ref={hostRef}
      className={`holocron-chat${dark ? ' dark' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      data-holocron-chat-host=''
    >
      {mountPoint
        ? createPortal(
            <LayoutGroup id='holocron-chat'>
              <div ref={portalRef} data-holocron-chat-portal='' />
              {children}
            </LayoutGroup>,
            mountPoint,
          )
        : null}
    </div>
  )
}
