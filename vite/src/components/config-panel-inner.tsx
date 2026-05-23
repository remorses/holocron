'use client'

// DialKit panel integration for live docs.json customization.
// This module is lazy-loaded (only imported when the user clicks the
// config panel button). Imports dialkit + motion + styles here so they
// stay out of the main bundle.

import React, { useEffect, useRef } from 'react'
import { router } from 'spiceflow/react'
import { useDialKit, DialRoot } from 'dialkit'
import 'dialkit/styles.css'
import type { HolocronConfig } from '../config.ts'
import {
  CONFIG_OVERRIDE_COOKIE,
  configToDialConfig,
  dialValuesToOverride,
  configOverrideToDocsJsonPartial,
} from '../lib/config-override.ts'
import { saveConfigOverride } from '../lib/config-actions.ts'

/** Read the existing doId from the cookie on the client side. */
function getExistingDoId(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CONFIG_OVERRIDE_COOKIE}=([^;]*)`),
  )
  if (!match?.[1]) return undefined
  const colonIdx = match[1].indexOf(':')
  return colonIdx > 0 ? match[1].slice(0, colonIdx) : undefined
}

/** Set the override cookie on the client. */
function setOverrideCookie(key: string) {
  document.cookie = `${CONFIG_OVERRIDE_COOKIE}=${key}; path=/; samesite=lax`
}

/** Clear the override cookie on the client. */
function clearOverrideCookie() {
  document.cookie = `${CONFIG_OVERRIDE_COOKIE}=; path=/; samesite=lax; max-age=0`
}

export default function ConfigPanelInner({
  config,
  onReset,
}: {
  config: HolocronConfig
  onReset: () => void
}) {
  const dialConfig = configToDialConfig(config)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialRenderRef = useRef(true)

  // Save-latest loop refs: ensures we never drop a pending change.
  // If a save is in-flight when a new change arrives, the loop keeps
  // going until latestJson matches savedJson.
  const latestJsonRef = useRef<string>('')
  const savedJsonRef = useRef<string>('')
  const savingRef = useRef(false)

  const params = useDialKit('docs.json', dialConfig, {
    onAction: (actionPath: string) => {
      if (actionPath === 'actions.copy') {
        const override = dialValuesToOverride(params)
        const partial = configOverrideToDocsJsonPartial(override)
        navigator.clipboard.writeText(JSON.stringify(partial, null, 2))
      }
      if (actionPath === 'actions.reset') {
        clearOverrideCookie()
        onReset()
        router.refresh()
      }
    },
  })

  // Derive a stable string from params so the effect only fires when
  // values actually change, not on every render.
  const paramsJson = JSON.stringify(dialValuesToOverride(params))

  async function saveLatest() {
    if (savingRef.current) return
    savingRef.current = true
    try {
      // Keep saving until latestJson matches what we last saved.
      // This handles the case where a new change arrives while we're
      // still saving the previous one.
      while (latestJsonRef.current !== savedJsonRef.current) {
        const jsonToSave = latestJsonRef.current
        const override = JSON.parse(jsonToSave)
        const existingDoId = getExistingDoId()
        const { key } = await saveConfigOverride(override, existingDoId)
        setOverrideCookie(key)
        savedJsonRef.current = jsonToSave
      }
      // RSC refresh: re-runs loaders with the new cookie so the page
      // updates with the overridden config. Preserves client state
      // (including the DialKit panel) unlike window.location.reload().
      router.refresh()
    } finally {
      savingRef.current = false
    }
  }

  // Debounced save: fires when paramsJson changes. Skips the initial
  // render so we don't save before the user has changed anything.
  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false
      latestJsonRef.current = paramsJson
      savedJsonRef.current = paramsJson
      return
    }
    if (paramsJson === latestJsonRef.current) return
    latestJsonRef.current = paramsJson

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveLatest()
    }, 200)
  }, [paramsJson])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <>
      <DialRoot position='top-right' defaultOpen theme='system' productionEnabled />
    </>
  )
}
