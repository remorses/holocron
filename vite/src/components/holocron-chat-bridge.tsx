'use client'

/**
 * Bridge between holocron's useHolocronData and the standalone chat widget store.
 * Initializes chatWidgetStore with holocron-specific values (basePath, currentSlug,
 * siteName) so ChatDrawer can be holocron-agnostic. Floating display reuses
 * ChatPill + ChatDrawer (same chrome as the embeddable ChatWidget).
 */

import { useLayoutEffect, useEffect, useCallback, useRef } from 'react'
import { LayoutGroup } from 'motion/react'
import { router } from 'spiceflow/react'
import { useHolocronData } from '../router.ts'
import { chatWidgetStore } from '../chat/chat-widget-store.ts'
import { ChatDrawer } from '../chat/chat-drawer.tsx'
import { ChatPill } from '../chat/chat-pill.tsx'
import { ensureSessionRestored, hasExistingSession } from '../chat/chat-submit.ts'

export function HolocronChatBridge() {
  const { currentPageHref, site } = useHolocronData()
  const basePath = site.base === '/' ? '' : `/${site.base.replace(/^\/+|\/+$/g, '')}`

  // Keep widget store in sync with holocron loader data.
  // chatApiUrl is relative (same-origin) for holocron integration.
  // useLayoutEffect so config is set before ChatDrawer's passive effects
  // fire (e.g. auto-submit on pendingSubmit).
  useLayoutEffect(() => {
    chatWidgetStore.setState({
      chatApiUrl: `${basePath}/holocron-api/chat`,
      currentSlug: currentPageHref || '/',
      siteName: site.config?.name || '',
      suggestions: site.config?.assistant?.suggestions || [],
      // portalTarget is set by FloatingChat; sidebar mode leaves it null
      // so ChatDrawer falls back to document.body
      navigate: (path: string) => router.push(path),
    })
  }, [basePath, currentPageHref, site.config?.name, site.config?.assistant?.suggestions])

  // Eagerly restore the persisted conversation on page load when a session
  // cookie exists. This pre-populates chatStore so the sidebar and drawer
  // show the previous conversation immediately instead of waiting for
  // the user to open the chat.
  useEffect(() => {
    if (hasExistingSession()) {
      void ensureSessionRestored()
    }
  }, [])

  if (site.config.assistant.display === 'floating') {
    return <FloatingChat />
  }

  return <ChatDrawer />
}

function FloatingChat() {
  const portalRef = useRef<HTMLDivElement>(null)
  const handleMountPoint = useCallback((mount: HTMLElement) => {
    chatWidgetStore.setState({ portalTarget: mount })
  }, [])

  useLayoutEffect(() => {
    if (portalRef.current) handleMountPoint(portalRef.current)
  }, [handleMountPoint])

  return (
    <LayoutGroup id='holocron-chat'>
      <div ref={portalRef} data-holocron-chat-portal='' />
      <ChatPill />
      <ChatDrawer />
    </LayoutGroup>
  )
}
