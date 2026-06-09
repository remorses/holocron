/**
 * Vite entry point. Renders the MDX-driven Holocron video in a <Player>
 * with controls and an "Export MP4" button for client-side rendering.
 *
 * No Remotion Studio, no Webpack, no remotion.config.ts needed.
 */

import { Player } from '@remotion/player'
import { useCallback, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  MeshGradientBg,
  BlurReveal,
  MaskedSlideReveal,
  StaggeredFadeUp,
  TerminalSimulator,
  GlassCodeBlock,
  AnimatedChart,
  FeaturePill,
  ShimmerSweep,
  SpringPopIn,
  type TerminalLine,
} from './components'
import { createMdxComposition, resolveModules, mdxParse } from './mdx-video'
import { renderInBrowser } from './render-client'
import './styles.css'
import HOLOCRON_MDX from './holocron.mdx?raw'

// Vite glob for resolving import statements inside MDX strings.
// Keys are relative paths like './components.tsx' that safe-mdx can match.
const lazyGlob = import.meta.glob<Record<string, any>>([
  './components.tsx',
])

// ---------------------------------------------------------------------------
// Data for the MDX video
// ---------------------------------------------------------------------------

const CREATE_LINES: TerminalLine[] = [
  { text: 'npx -y @holocron.so/cli create my-docs', type: 'command', delay: 0 },
  { text: '', type: 'dim', delay: 12 },
  { text: '  Creating project in ./my-docs...', type: 'log', delay: 8 },
  { text: '  Scaffolding files...', type: 'log', delay: 6, pause: 20 },
  { text: '', type: 'dim', delay: 4 },
  { text: '  ✓ Created docs.json', type: 'success', delay: 4 },
  { text: '  ✓ Created src/index.mdx', type: 'success', delay: 3 },
  { text: '  ✓ Created src/quickstart.mdx', type: 'success', delay: 3 },
  { text: '  ✓ Created vite.config.ts', type: 'success', delay: 3 },
  { text: '', type: 'dim', delay: 4 },
  { text: '  Installing dependencies...', type: 'log', delay: 6, pause: 30 },
  { text: '', type: 'dim', delay: 4 },
  { text: '  Done! Your docs site is ready.', type: 'success', delay: 6 },
  { text: '', type: 'dim', delay: 2 },
  { text: '  cd my-docs && pnpm dev', type: 'log', delay: 4 },
]

const DEPLOY_LINES: TerminalLine[] = [
  { text: 'npx -y @holocron.so/cli deploy', type: 'command', delay: 0 },
  { text: '', type: 'dim', delay: 10 },
  { text: '  Building docs...', type: 'log', delay: 6, pause: 24 },
  { text: '  ✓ 12 pages compiled', type: 'success', delay: 4 },
  { text: '  ✓ OpenAPI spec processed', type: 'success', delay: 3 },
  { text: '  ✓ Search index generated', type: 'success', delay: 3 },
  { text: '', type: 'dim', delay: 4 },
  { text: '  Deploying to edge...', type: 'log', delay: 6, pause: 18 },
  { text: '', type: 'dim', delay: 4 },
  { text: '  ✓ Live at https://my-docs.holocron.so', type: 'success', delay: 6 },
]

const DOCS_JSON_CODE = `{
  "name": "My Docs",
  "logo": {
    "light": "/logo-light.svg",
    "dark": "/logo-dark.svg"
  },
  "navigation": [
    {
      "group": "Getting Started",
      "pages": ["quickstart", "configuration"]
    }
  ]
}`

const FEATURES = [
  { label: 'MDX Components', icon: '✦' },
  { label: 'OpenAPI Reference', icon: '⬡' },
  { label: 'Full-text Search', icon: '◎' },
  { label: 'Dark Mode', icon: '◐' },
  { label: 'Versioning', icon: '⊞' },
  { label: 'Syntax Highlighting', icon: '❮❯' },
  { label: 'AI Assistant', icon: '◆' },
  { label: 'Mintlify Compatible', icon: '↗' },
]

// ---------------------------------------------------------------------------
// FeatureGrid — wraps FeaturePill in a grid (since MDX can't do loops)
// ---------------------------------------------------------------------------

function FeatureGrid({ features }: { features: typeof FEATURES }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, auto)',
        gap: 16,
        padding: '0 80px',
      }}
    >
      {features.map((f, i) => (
        <FeaturePill key={f.label} label={f.label} icon={f.icon} index={i} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

// Resolve MDX imports at startup, then create the composition.
// This is async because import.meta.glob returns lazy loaders.
async function initMdxComposition() {
  const mdast = mdxParse(HOLOCRON_MDX)
  const modules = await resolveModules({ glob: lazyGlob, mdast, baseUrl: './' })

  return createMdxComposition({
    mdx: HOLOCRON_MDX,
    components: {
      MeshGradientBg,
      BlurReveal,
      MaskedSlideReveal,
      StaggeredFadeUp,
      TerminalSimulator,
      GlassCodeBlock,
      AnimatedChart,
      ShimmerSweep,
      SpringPopIn,
      FeatureGrid,
    },
    modules,
    baseUrl: './',
    scope: {
      createLines: CREATE_LINES,
      deployLines: DEPLOY_LINES,
      docsJsonCode: DOCS_JSON_CODE,
      features: FEATURES,
    },
  })
}

function App({ composition }: { composition: { Component: React.FC; durationInFrames: number } }) {
  const [rendering, setRendering] = useState(false)
  const [progress, setProgress] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const { Component, durationInFrames } = composition

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
  }, [Component, durationInFrames])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return (
    <div className="mx-auto max-w-[960px] px-5 py-10">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight text-white">
        Holocron Video
      </h1>

      <Player
        component={Component}
        durationInFrames={durationInFrames}
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

initMdxComposition().then((composition) => {
  createRoot(document.getElementById('root')!).render(<App composition={composition} />)
})
