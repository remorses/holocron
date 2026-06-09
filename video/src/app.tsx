/**
 * Vite entry point. Renders the Holocron video in a <Player> component
 * with controls and an "Export MP4" button for client-side rendering.
 * No Remotion Studio, no Webpack, no remotion.config.ts needed.
 */

import { Player } from '@remotion/player'
import { useCallback, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HolocronVideo } from './holocron-video'
import { renderInBrowser } from './render-client'
import './styles.css'

function App() {
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
        onProgress: (p) => setProgress(p),
        signal: controller.signal,
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'holocron.mp4'
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
  }, [])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return (
    <div className="mx-auto max-w-[960px] px-5 py-10">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight text-white">
        Holocron Video
      </h1>

      <Player
        component={HolocronVideo}
        durationInFrames={1230}
        fps={30}
        compositionWidth={1920}
        compositionHeight={1080}
        controls
        style={{ width: '100%' }}
        className="rounded-xl overflow-hidden"
      />

      <div className="mt-5 flex items-center gap-4">
        {rendering ? (
          <>
            <button
              onClick={handleCancel}
              className="group relative inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-2.5 text-sm font-medium text-red-400 cursor-pointer transition-all hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300 active:scale-[0.98]"
            >
              <svg className="size-4" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Cancel
            </button>

            <div className="flex items-center gap-3">
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <span className="tabular-nums text-sm text-zinc-500">
                {Math.round(progress * 100)}%
              </span>
            </div>
          </>
        ) : (
          <button
            onClick={handleExport}
            className="group relative inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-medium text-white cursor-pointer shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-400 hover:shadow-indigo-500/40 active:scale-[0.98]"
          >
            <svg className="size-4" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12v1h10v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export MP4
          </button>
        )}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
