'use client'

/**
 * Client component: Remotion Player wrapper + MP4 export UI.
 *
 * Receives pre-rendered JSX sections from the server (via RSC flight).
 * All MDX processing (parsing, module resolution, safe-mdx rendering)
 * is done server-side in app.tsx. This component only handles:
 * - Wrapping sections in Remotion's Series/Sequence composition
 * - Rendering the Player
 * - MP4 export via WebCodecs
 */

import { Player, type PlayerRef } from '@remotion/player'
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AbsoluteFill, Sequence, Series, useDelayRender } from 'remotion'
import { renderInBrowser } from './render-client'

/**
 * Remotion-aware Suspense fallback. When a section suspends (throws a promise),
 * this component calls delayRender() to prevent Remotion from taking a
 * screenshot of the incomplete frame. When the suspended component resolves
 * and this fallback unmounts, continueRender() fires and rendering proceeds.
 *
 * This is the same pattern Remotion uses internally in <Composition> (see
 * packages/core/src/Composition.tsx in the Remotion source).
 */
function SuspenseFallback() {
  const { delayRender, continueRender } = useDelayRender()
  useEffect(() => {
    const handle = delayRender('Waiting for section to unsuspend', {
      timeoutInMilliseconds: 10 * 60 * 1000,
    })
    return () => continueRender(handle)
  }, [delayRender, continueRender])

  // delayRender is a no-op in the Player, so this loading UI is only
  // visible during preview. During export, rendering pauses until the
  // suspended component resolves, then this fallback unmounts before
  // the screenshot is taken.
  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#050505',
      }}
    >
      <span
        style={{
          fontSize: 48,
          fontWeight: 500,
          color: '#52525b',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
          letterSpacing: '-0.01em',
        }}
      >
        Loading…
      </span>
    </AbsoluteFill>
  )
}

interface SectionProps {
  heading: string | null
  durationInFrames: number
  backgroundJsx: ReactNode
  contentJsx: ReactNode
}

function VideoComposition({
  sections,
  globalBgJsx,
  totalDuration,
}: {
  sections: SectionProps[]
  globalBgJsx: ReactNode
  totalDuration: number
}) {
  return (
    <AbsoluteFill style={{ background: '#050505' }}>
      {/* Global backgrounds span entire composition */}
      {globalBgJsx && (
        <Sequence from={0} durationInFrames={totalDuration}>
          <Suspense fallback={<SuspenseFallback />}>
            {globalBgJsx}
          </Suspense>
        </Sequence>
      )}

      {/* Sequential sections */}
      <Series>
        {sections.map((section, i) => (
          <Series.Sequence
            key={i}
            durationInFrames={section.durationInFrames}
            // @ts-ignore — name prop exists on Series.Sequence
            name={section.heading || `Section ${i}`}
          >
            <Suspense fallback={<SuspenseFallback />}>
              <AbsoluteFill style={{ background: '#050505' }}>
                {section.backgroundJsx}
                <AbsoluteFill
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '5% 8%',
                    gap: 'clamp(1rem, 2vw, 2.5rem)',
                  }}
                >
                  {section.contentJsx}
                </AbsoluteFill>
              </AbsoluteFill>
            </Suspense>
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  )
}

export function PlayerPage({
  sections,
  globalBgJsx,
  totalDuration,
}: {
  sections: SectionProps[]
  globalBgJsx: ReactNode
  totalDuration: number
}) {
  // Stable component function that reads latest props from a ref.
  // Created once so its identity never changes between renders.
  // Remotion Player doesn't remount when component identity is stable.
  const propsRef = useRef({ sections, globalBgJsx, totalDuration })
  propsRef.current = { sections, globalBgJsx, totalDuration }

  const [Component] = useState(() => () => (
    <VideoComposition {...propsRef.current} />
  ))

  // When RSC delivers new props (HMR), bump a revision counter passed
  // as inputProps. Remotion re-renders the composition when inputProps
  // reference changes (useMemo in Player watches it), which causes the
  // stable component to re-read fresh props from propsRef.
  // Revision counter bumped on every HMR update (via rsc:update event)
  // or when RSC delivers new sections. Passed as inputProps so Remotion
  // re-renders the composition, which re-reads fresh props from propsRef.
  const playerRef = useRef<PlayerRef>(null)

  // Listen for rsc:update HMR events. Bump revision which changes the
  // Player's React key, forcing a full remount with fresh client component
  // code. This loses playback position but ensures edits are visible.


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
        durationInFrames: totalDuration,
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
  }, [Component, totalDuration])

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
          // key={revision}
          ref={playerRef}
          component={Component}
          durationInFrames={totalDuration}
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
