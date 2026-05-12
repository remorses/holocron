// Polls /api/deploy-status every 5 seconds after the deploy page loads.
// When the project's first deployment lands, redirects to the project dashboard.
'use client'

import { useEffect, useRef } from 'react'

export function DeployPoller({ projectId }: { projectId: string }) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch(`/api/deploy-status?projectId=${encodeURIComponent(projectId)}`)
        if (!res.ok) return
        const data = await res.json() as { deployed: boolean }
        if (data.deployed) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          window.location.href = `/dashboard/projects/${projectId}`
        }
      } catch {
        // network error, retry next interval
      }
    }

    intervalRef.current = setInterval(check, 5000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [projectId])

  return null
}
