// Refreshes the deploy page every 5 seconds so the server can redirect once
// the project's first deployment lands. Avoids an internal client fetch route.
'use client'

import { useEffect } from 'react'
import { router } from 'spiceflow/react'

export function DeployPoller() {
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 5000)
    return () => clearInterval(interval)
  }, [])

  return null
}
