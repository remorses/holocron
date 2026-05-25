'use client'

// Loads the DialKit config panel asynchronously when the browser is idle.
// Uses requestIdleCallback to defer the import until the page is not busy,
// so the main bundle and first paint are unaffected. DialKit renders its
// own toggle button in the top-right corner; we don't need a custom one.
//
// The inner panel is keyed by DialKit defaults so loader refreshes remount the
// hook with fresh values after the config override cookie changes.

import React, { useEffect, useState } from 'react'
import type { HolocronConfig } from '../config.ts'
import { configToDialConfig } from '../lib/config-override.ts'

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
