'use client'

// Loads the DialKit config panel asynchronously when the browser is idle.
// Uses requestIdleCallback to defer the import until the page is not busy,
// so the main bundle and first paint are unaffected. DialKit renders its
// own toggle button in the top-right corner; we don't need a custom one.
//
// Also exports ConfigOverrideListener: listens for postMessage from a
// parent iframe (notaku dashboard) to update the config override cookie
// and trigger a spiceflow router.refresh(). This enables live preview of
// docs.json changes made in the AI chat without a full page reload.

import React, { useEffect, useState } from 'react'
import type { HolocronConfig } from '../config.ts'
import { configToDialConfig, CONFIG_OVERRIDE_PARAM } from '../lib/config-override.ts'
import { router } from 'spiceflow/react'

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

// Allowed parent origins for postMessage. Only the notaku dashboard
// should be able to push config overrides into the iframe.
const ALLOWED_PARENT_ORIGINS = new Set([
  'https://notaku.so',
  'https://www.notaku.so',
  'http://localhost:7664',
  'http://localhost:3000',
])

/** Listens for postMessage from a parent window (notaku dashboard iframe).
 *
 *  Messages:
 *  - `{ type: 'config-override', key: 'doId:hash' }` — update the
 *    configOverride query param and refresh the page with the new config.
 *  - `{ type: 'config-override-clear' }` — remove the override and
 *    refresh back to the base deployed config.
 *
 *  Uses the query param as the source of truth (not cookies). This avoids
 *  third-party cookie issues and ensures router.refresh() always picks
 *  up the latest override via resolveConfigOverride reading the URL.
 *
 *  Mounted when previewProps=true (always present in the notaku dashboard
 *  iframe URL), so the listener is ready before any override key exists. */
export function ConfigOverrideListener() {
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Validate origin: only accept messages from known notaku origins
      if (!ALLOWED_PARENT_ORIGINS.has(event.origin)) {
        return
      }
      // Validate source: only accept from the parent window
      if (event.source !== window.parent) {
        return
      }

      const data = event.data
      if (!data) {
        return
      }

      if (data.type === 'config-override' && data.key) {
        // Update the query param so resolveConfigOverride reads it
        const url = new URL(window.location.href)
        url.searchParams.set(CONFIG_OVERRIDE_PARAM, data.key)
        // Use history.replaceState to update URL without navigation,
        // then router.refresh() to re-run loaders with the new param
        history.replaceState(null, '', url.toString())
        router.refresh()

        event.source?.postMessage(
          { type: 'config-override-ack', key: data.key },
          { targetOrigin: event.origin },
        )
      }

      if (data.type === 'config-override-clear') {
        const url = new URL(window.location.href)
        url.searchParams.delete(CONFIG_OVERRIDE_PARAM)
        history.replaceState(null, '', url.toString())
        router.refresh()

        event.source?.postMessage(
          { type: 'config-override-clear-ack' },
          { targetOrigin: event.origin },
        )
      }
    }

    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [])

  return null
}
