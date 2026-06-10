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

import './styles.css'
import { Player, type PlayerRef } from '@remotion/player'
import { Suspense, useCallback, useEffect, useRef, useSyncExternalStore, useState, type ReactNode } from 'react'
import { AbsoluteFill, Series, useDelayRender } from 'remotion'
import { renderInBrowser } from './render-client'
import { egakiSDK } from './sdk'
import { LayoutEditor, type SectionMeta } from './layout-editor.tsx'

// Module-level stable callbacks for useSyncExternalStore (never re-subscribes)
const subscribeNoop = () => () => {}
const getClientMounted = () => true
const getServerMounted = () => false

function ToolbarSeparator() {
  return <div className='w-px h-4 bg-white/15' />
}

function DownloadIcon() {
  return (
    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
      <polyline points='7 10 12 15 17 10' />
      <line x1='12' y1='15' x2='12' y2='3' />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <line x1='18' y1='6' x2='6' y2='18' />
      <line x1='6' y1='6' x2='18' y2='18' />
    </svg>
  )
}

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
  preamble,
}: {
  sections: SectionProps[]
  totalDuration: number
  preamble?: ReactNode
}) {
  return (
    <AbsoluteFill style={{ background: '#050505' }}>
      {/* Preamble: MDX content before the first heading. Rendered at
          composition level so it persists across all sections. Runs in the
          background behind the Series (earlier DOM order = behind). */}
      {preamble}
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
  preamble,
}: {
  sections: SectionProps[]
  totalDuration: number
  preamble?: ReactNode
}) {
  // Stable component function that reads latest props from a ref.
  // Created once so its identity never changes between renders.
  // Remotion Player doesn't remount when component identity is stable.
  const propsRef = useRef({ sections, totalDuration, preamble })
  propsRef.current = { sections, totalDuration, preamble }

  const [Component] = useState(() => () => (
    <VideoComposition {...propsRef.current} />
  ))

  const playerRef = useRef<PlayerRef>(null)
  const playerContainerRef = useRef<HTMLDivElement>(null)

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

  const [editing, setEditing] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [rendering, setRendering] = useState(false)
  const [progress, setProgress] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  // Force pause while editing — catches play via spacebar, API calls, etc.
  useEffect(() => {
    if (!editing) return
    const player = playerRef.current
    if (!player) return
    if (player.isPlaying()) player.pause()
    const onPlay = () => player.pause()
    player.addEventListener('play', onPlay)
    return () => player.removeEventListener('play', onPlay)
  }, [editing])

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
    <div className='flex flex-col items-center justify-center min-h-screen bg-black px-5 py-10'>
      {/* Player — centered vertically */}
      <div ref={playerContainerRef} className='w-full max-w-[960px] rounded-xl overflow-hidden'>
        {mounted ? (
          <Player
            key={resetKey}
            ref={playerRef}
            component={Component}
            durationInFrames={totalDuration}
            fps={30}
            compositionWidth={1920}
            compositionHeight={1080}
            controls
            clickToPlay={!editing}
            spaceKeyToPlayOrPause
            style={{ width: '100%' }}
          />
        ) : (
          <div className='aspect-video bg-[#050505]' />
        )}
      </div>

      {/* Floating toolbar — fixed at bottom center */}
      <div className='fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-[#1c1c1c] border border-white/10 px-2 py-1.5 shadow-2xl'>
        {rendering ? (
          <>
            <button
              onClick={handleCancel}
              className='flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer'
            >
              <XIcon />
              Cancel
            </button>
            <ToolbarSeparator />
            <div className='flex items-center gap-2.5 px-2'>
              <div className='w-24 h-1 rounded-full bg-white/10 overflow-hidden'>
                <div
                  className='h-full rounded-full bg-sky-400 transition-[width] duration-300'
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <span className='text-[13px] text-zinc-500 tabular-nums'>
                {Math.round(progress * 100)}%
              </span>
            </div>
          </>
        ) : (
          <button
            onClick={handleExport}
            className='flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-sky-950 bg-sky-200 hover:bg-sky-100 transition-colors cursor-pointer'
          >
            <DownloadIcon />
            Export MP4
          </button>
        )}

        <ToolbarSeparator />

        <LayoutEditor
          playerContainerRef={playerContainerRef}
          playerRef={playerRef}
          editing={editing}
          onEditingChange={setEditing}
          onReset={() => setResetKey((k) => k + 1)}
          sections={sections}
          fps={30}
        />
      </div>
    </div>
  )
}
