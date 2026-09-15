'use client'

// Listens for postMessage from the dashboard parent window. On receiving an
// override key it sets a first-party cookie and calls router.refresh() for a
// smooth in-place config update without a full page reload. The cookie also
// persists across internal navigations so the override stays active when
// clicking sidebar links.

import { useEffect } from 'react'
import { router } from 'spiceflow/react'
import { CONFIG_OVERRIDE_COOKIE } from '../lib/config-override.ts'

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

type ConfigOverrideInboundMessage =
  | ConfigOverrideMessage
  | ConfigOverrideClearMessage

/** Listens for postMessage from the parent window. On receiving an
 *  override key, sets a cookie and calls router.refresh() for a smooth
 *  in-place update without full page reload.
 *
 *  The cookie uses SameSite=None;Secure so it works in cross-site iframes
 *  (the dashboard embedding *.holocron.so). The cookie persists across
 *  internal page navigations inside the iframe.
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
