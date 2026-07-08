'use client'

/**
 * Bridge between holocron's useHolocronData and the standalone chat widget store.
 * Initializes chatWidgetStore with holocron-specific values (basePath, currentSlug,
 * siteName) so ChatDrawer can be holocron-agnostic.
 */

import { useLayoutEffect, useEffect } from 'react'
import { useHolocronData } from '../router.ts'
import { chatWidgetStore } from '../chat/chat-widget-store.ts'
import { ChatDrawer } from '../chat/chat-drawer.tsx'
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
      // portalTarget stays null → ChatDrawer falls back to document.body
    })
  }, [basePath, currentPageHref, site.config?.name])

  // Eagerly restore the persisted conversation on page load when a session
  // cookie exists. This pre-populates chatStore so the sidebar and drawer
  // show the previous conversation immediately instead of waiting for
  // the user to open the chat.
  useEffect(() => {
    if (hasExistingSession()) {
      void ensureSessionRestored()
    }
  }, [])

  return <ChatDrawer />
}
