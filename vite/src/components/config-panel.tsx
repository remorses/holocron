'use client'

// Loads the DialKit config panel asynchronously when the browser is idle.
//
// Also exports ConfigOverrideListener: listens for postMessage from the
// notaku dashboard parent window. Sets a first-party cookie with the
// override key and calls router.refresh() for smooth config updates
// without a full page reload. The cookie also persists across internal
// navigations so the override stays active when clicking sidebar links.

import React, { useEffect, useState } from 'react'
import type { HolocronConfig } from '../config.ts'
import { configToDialConfig, CONFIG_OVERRIDE_COOKIE } from '../lib/config-override.ts'
import { router } from 'spiceflow/react'

// ── Iframe preview protocol ──────────────────────────────────────────
//
// Messages sent from the notaku dashboard (parent) to the holocron
// iframe (child) via window.postMessage.

/** Sent by the parent after storing a new config in the DO.
 *  `key` is `doId:hash` referencing the ConfigOverrideDO record. */
type ConfigOverrideMessage = {
  type: 'config-override'
  key: string
}

/** Sent by the parent when the user saves or clears edits.
 *  The iframe removes the override cookie and refreshes. */
type ConfigOverrideClearMessage = {
  type: 'config-override-clear'
}

/** All inbound message types. */
type ConfigOverrideInboundMessage =
  | ConfigOverrideMessage
  | ConfigOverrideClearMessage

// ── Components ───────────────────────────────────────────────────────

/** Schedule a callback for when the browser is idle, with a fallback
 *  to setTimeout for browsers that don't support requestIdleCallback. */
function whenIdle(cb: () => void, timeout = 3000) {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(cb, { timeout })
    return () => cancelIdleCallback(id)
  }
  const id = setTimeout(cb, 100)
  return () => clearTimeout(id)
}

// Lazy module reference — only populated after idle load
let ConfigPanelInner: React.ComponentType<{
  config: HolocronConfig
}> | null = null

export function ConfigPanel({ config }: { config: HolocronConfig }) {
  const [loaded, setLoaded] = useState(false)
  const configKey = JSON.stringify(configToDialConfig(config))

  useEffect(() => {
    if (ConfigPanelInner) {
      setLoaded(true)
      return
    }
    let cancelled = false
    const cancelIdle = whenIdle(() => {
      void import('./config-panel-inner.tsx').then((mod) => {
        if (cancelled) return
        ConfigPanelInner = mod.default
        setLoaded(true)
      })
    }, 3000)
    return () => {
      cancelled = true
      cancelIdle()
    }
  }, [])

  if (!loaded || !ConfigPanelInner) return null
  return <ConfigPanelInner key={configKey} config={config} />
}

/** Listens for postMessage from the parent window. On receiving an
 *  override key, sets a cookie and calls router.refresh() for a
 *  smooth in-place update without full page reload.
 *
 *  The cookie uses SameSite=None;Secure so it works in cross-site
 *  iframes (notaku.so embedding *.holocron.so). The cookie persists
 *  across internal page navigations inside the iframe.
 *
 *  Always mounted in the layout. Does nothing when not in an iframe
 *  (no messages arrive, zero overhead). */
export function ConfigOverrideListener() {
  useEffect(() => {
    // Skip if not embedded in an iframe
    if (window === window.parent) {
      return
    }

    function onMessage(event: MessageEvent) {
      const data = event.data as ConfigOverrideInboundMessage | null
      if (!data) {
        return
      }

      if (data.type === 'config-override' && data.key) {
        document.cookie = `${CONFIG_OVERRIDE_COOKIE}=${data.key}; path=/; samesite=none; secure`
        router.refresh()
      }

      if (data.type === 'config-override-clear') {
        document.cookie = `${CONFIG_OVERRIDE_COOKIE}=; path=/; max-age=0; samesite=none; secure`
        router.refresh()
      }
    }

    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [])

  return null
}
