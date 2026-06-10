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
import { Suspense, useCallback, useEffect, useRef, useSyncExternalStore, useState, type ReactNode } from 'react'
import { AbsoluteFill, Series, useDelayRender } from 'remotion'
import { Audio } from '@remotion/media'
import { renderInBrowser } from './render-client'
import { egakiSDK } from './sdk'

// Module-level stable callbacks for useSyncExternalStore (never re-subscribes)
const subscribeNoop = () => () => {}
const getClientMounted = () => true
const getServerMounted = () => false

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
  jsx: ReactNode
}

function VideoComposition({
  sections,
  totalDuration,
  soundtrack,
}: {
  sections: SectionProps[]
  totalDuration: number
  soundtrack?: string
}) {
  return (
    <AbsoluteFill style={{ background: '#050505' }}>
      {/* Soundtrack plays for the entire composition, behind all sections */}
      {soundtrack && <Audio src={soundtrack} />}
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
              {/* Background components inside jsx self-position as AbsoluteFill
                  layers behind content via DOM order (rendered first = behind). */}
              <AbsoluteFill style={{ background: '#050505' }}>
                <AbsoluteFill
                  style={{
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '5% 8%',
                    gap: 'clamp(1rem, 2vw, 2.5rem)',
                  }}
                >
                  {section.jsx}
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
  totalDuration,
  soundtrack,
}: {
  sections: SectionProps[]
  totalDuration: number
  soundtrack?: string
}) {
  // Stable component function that reads latest props from a ref.
  // Created once so its identity never changes between renders.
  // Remotion Player doesn't remount when component identity is stable.
  const propsRef = useRef({ sections, totalDuration, soundtrack })
  propsRef.current = { sections, totalDuration, soundtrack }

  const [Component] = useState(() => () => (
    <VideoComposition {...propsRef.current} />
  ))

  const playerRef = useRef<PlayerRef>(null)

  // Register the composition with the SDK so agents can call
  // window.egakiSDK.seekTo() / .screenshot() / .export() via Playwriter.
  useEffect(() => {
    egakiSDK.register({
      component: Component,
      totalDuration,
      fps: 30,
      width: 1920,
      height: 1080,
      sectionCount: sections.length,
      playerRef,
    })
  }, [Component, totalDuration, sections.length])

  // Defer Player mount to client only. Remotion's Player and all composition
  // components (Series, AbsoluteFill, Audio, Video) use React context provided
  // by Player at runtime. During SSR there's no Remotion context, so hooks like
  // useCurrentFrame/useVideoConfig crash with "Cannot read properties of null
  // (reading 'useContext')". useSyncExternalStore returns false on the server
  // and true on the client synchronously during hydration (no useEffect tick).
  const mounted = useSyncExternalStore(subscribeNoop, getClientMounted, getServerMounted)

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
        {mounted ? (
          <Player
            ref={playerRef}
            component={Component}
            durationInFrames={totalDuration}
            fps={30}
            compositionWidth={1920}
            compositionHeight={1080}
            controls
            style={{ width: '100%' }}
          />
        ) : (
          <div style={{ aspectRatio: '16/9', background: '#050505' }} />
        )}
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
