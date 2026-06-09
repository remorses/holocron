/**
 * Client component: handles all MDX processing and Remotion rendering.
 * Modules are eagerly imported (no async), so the Player renders immediately.
 */

'use client'

import { Player } from '@remotion/player'
import { useCallback, useMemo, useRef, useState } from 'react'
import { eagerModules } from 'virtual:egaki-modules'
import { createMdxComposition } from './mdx-video'
import { renderInBrowser } from './render-client'

export function PlayerPage({ mdxSource }: { mdxSource: string }) {
  const { Component, durationInFrames } = useMemo(
    () => createMdxComposition({ mdx: mdxSource, modules: eagerModules, baseUrl: './' }),
    [mdxSource],
  )

  const [rendering, setRendering] = useState(false)
  const [progress, setProgress] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const handleExport = useCallback(async () => {
    setRendering(true)
    setProgress(0)
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const blob = await renderInBrowser({
        component: Component,
        durationInFrames,
        onProgress: (p) => setProgress(p),
        signal: controller.signal,
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'video.mp4'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      if ((err as Error).message?.includes('cancelled')) {
        console.log('Export cancelled')
      } else {
        console.error('Export failed:', err)
      }
    } finally {
      setRendering(false)
      abortRef.current = null
    }
  }, [Component, durationInFrames])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: '#fff', marginBottom: 20 }}>
        Video Preview
      </h1>

      <div style={{ borderRadius: 12, overflow: 'hidden' }}>
        <Player
          component={Component}
          durationInFrames={durationInFrames}
          fps={30}
          compositionWidth={1920}
          compositionHeight={1080}
          controls
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        {rendering ? (
          <>
            <button
              onClick={handleCancel}
              style={{
                padding: '10px 20px',
                borderRadius: 12,
                border: '1px solid rgba(239,68,68,0.3)',
                background: 'rgba(239,68,68,0.05)',
                color: '#f87171',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 128, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.round(progress * 100)}%`,
                    height: '100%',
                    borderRadius: 3,
                    background: '#6366f1',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
              <span style={{ fontSize: 14, color: '#71717a', fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(progress * 100)}%
              </span>
            </div>
          </>
        ) : (
          <button
            onClick={handleExport}
            style={{
              padding: '10px 24px',
              borderRadius: 12,
              background: '#6366f1',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              border: 'none',
            }}
          >
            Export MP4
          </button>
        )}
      </div>
    </div>
  )
}
