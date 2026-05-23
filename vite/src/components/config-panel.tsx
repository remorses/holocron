'use client'

// Loads the DialKit config panel asynchronously when the browser is idle.
// Uses requestIdleCallback to defer the import until the page is not busy,
// so the main bundle and first paint are unaffected. DialKit renders its
// own toggle button in the top-right corner; we don't need a custom one.
//
// A resetKey counter forces a full remount of ConfigPanelInner when the
// user clicks "reset". This destroys the DialKit hook, unregisters the
// panel, and re-registers it with fresh default values from the config.

import React, { useCallback, useEffect, useState } from 'react'
import type { HolocronConfig } from '../config.ts'

/** Schedule a callback for when the browser is idle, with a fallback
 *  to setTimeout for browsers that don't support requestIdleCallback. */
function whenIdle(cb: () => void, timeout = 3000) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(cb, { timeout })
  } else {
    setTimeout(cb, 100)
  }
}

// Lazy module reference — only populated after idle load
let ConfigPanelInner: React.ComponentType<{
  config: HolocronConfig
  onReset: () => void
}> | null = null

export function ConfigPanel({ config }: { config: HolocronConfig }) {
  const [loaded, setLoaded] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  const handleReset = useCallback(() => {
    setResetKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (ConfigPanelInner) {
      setLoaded(true)
      return
    }
    whenIdle(() => {
      import('./config-panel-inner.tsx').then((mod) => {
        ConfigPanelInner = mod.default as any
        setLoaded(true)
      })
    })
  }, [])

  if (!loaded || !ConfigPanelInner) return null
  return <ConfigPanelInner key={resetKey} config={config} onReset={handleReset} />
}
