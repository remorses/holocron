/**
 * Spiceflow entry for the video framework.
 *
 * All MDX processing happens here on the server:
 * - Parse MDX with safe-mdx
 * - Split into sections (headings become Series.Sequence boundaries)
 * - Resolve user imports via virtual:egaki-modules
 * - Render each section's content and backgrounds to JSX via SafeMdxRenderer
 * - Build the components map (client refs for Remotion components + inline
 *   element overrides for p, code, etc.)
 *
 * The rendered JSX (containing client component references for Remotion
 * animation/visual components) is passed to PlayerPage via RSC flight.
 * PlayerPage just wraps it in <Player> on the client.
 *
 * NOTE: Relative imports MUST include file extensions (.tsx, .ts) for the
 * RSC module runner to resolve them correctly within noExternal packages.
 */

import type { ReactNode } from 'react'
import { Spiceflow } from 'spiceflow'
import { SafeMdxRenderer } from 'safe-mdx'
import { mdxParse, extractImports, resolveModulePath } from 'safe-mdx/parse'
import type { EagerModules } from 'safe-mdx/parse'
import mdxSource from 'virtual:egaki-mdx'
import { eagerModules } from 'virtual:egaki-modules'
import { splitIntoSections, calculateTotalDuration } from './mdx-parse.ts'
import { PlayerPage } from './player-page.tsx'

// Client component refs — not executed on the server, just serialized
// as references in the RSC flight payload. Hooks run on the client inside
// Remotion's Player render loop.
import {
  Background,
  FadeIn, FadeOut, ZoomIn, ZoomOut,
  SlideIn, SlideOut, BlurIn, BlurOut, Animate,
  MeshGradientBg, BlurReveal, MaskedSlideReveal, StaggeredFadeUp,
  TerminalSimulator, GlassCodeBlock, ShimmerSweep, SpringPopIn,
  AnimatedChart, FeaturePill,
} from './mdx-video.tsx'

// ---------------------------------------------------------------------------
// MDX components map — built on the server
//
// Client components (FadeIn, MeshGradientBg, etc.) are just references here.
// Inline element overrides (p, strong, code) are plain server functions.
// ---------------------------------------------------------------------------

const FONT_SANS =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif'
const FONT_MONO =
  '"SF Mono", ui-monospace, SFMono-Regular, "Cascadia Code", monospace'

function buildVideoMdxComponents(): Record<string, any> {
  return {
    Background,

    // Built-in visual components
    MeshGradientBg, BlurReveal, MaskedSlideReveal, StaggeredFadeUp,
    TerminalSimulator, GlassCodeBlock, ShimmerSweep, SpringPopIn,
    AnimatedChart, FeaturePill,

    // Enter/exit animations
    FadeIn, FadeOut, ZoomIn, ZoomOut,
    SlideIn, SlideOut, BlurIn, BlurOut, Animate,

    // Standard element overrides
    p: ({ children }: { children: ReactNode }) => (
      <div style={{
        fontSize: 'clamp(1.5rem, 2.5vw, 3rem)', fontWeight: 400,
        color: '#a1a1aa', fontFamily: FONT_SANS, textAlign: 'center',
        letterSpacing: '-0.02em', lineHeight: 1.4, maxWidth: '80%',
      }}>{children}</div>
    ),
    strong: ({ children }: { children: ReactNode }) => (
      <span style={{ color: '#fafafa', fontWeight: 600 }}>{children}</span>
    ),
    em: ({ children }: { children: ReactNode }) => (
      <span style={{ fontStyle: 'italic' }}>{children}</span>
    ),
    a: ({ children }: { children: ReactNode; href?: string }) => (
      <span style={{ color: '#818cf8', textDecoration: 'underline' }}>{children}</span>
    ),
    h1: () => null, h2: () => null, h3: () => null,
    h4: () => null, h5: () => null, h6: () => null,
    blockquote: () => null,
    pre: ({ children }: { children: ReactNode }) => (
      <div style={{ width: '100%', maxWidth: '80%', display: 'flex', justifyContent: 'center' }}>
        {children}
      </div>
    ),
    code: ({ children }: { children: ReactNode; className?: string }) => (
      <pre style={{
        fontSize: 'clamp(0.875rem, 1.2vw, 1.125rem)', fontFamily: FONT_MONO,
        color: '#e4e4e7', background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '0.75em',
        padding: '1.25em 1.5em', lineHeight: 1.6, whiteSpace: 'pre',
        overflow: 'hidden', width: '100%', textAlign: 'left',
      }}>{children}</pre>
    ),
    inlineCode: ({ children }: { children: ReactNode }) => (
      <span style={{
        fontFamily: FONT_MONO, fontSize: '0.875em', color: '#e4e4e7',
        background: 'rgba(255, 255, 255, 0.06)', borderRadius: '0.25em',
        padding: '0.1em 0.4em',
      }}>{children}</span>
    ),
    ul: ({ children }: { children: ReactNode }) => (
      <div style={{
        fontSize: 'clamp(1.25rem, 2vw, 2rem)', color: '#a1a1aa',
        fontFamily: FONT_SANS, textAlign: 'left', display: 'flex',
        flexDirection: 'column', gap: '0.4em',
      }}>{children}</div>
    ),
    ol: ({ children }: { children: ReactNode }) => (
      <div style={{
        fontSize: 'clamp(1.25rem, 2vw, 2rem)', color: '#a1a1aa',
        fontFamily: FONT_SANS, textAlign: 'left', display: 'flex',
        flexDirection: 'column', gap: '0.4em',
      }}>{children}</div>
    ),
    li: ({ children }: { children: ReactNode }) => (
      <div style={{ display: 'flex', gap: '0.5em' }}>
        <span style={{ color: '#52525b' }}>•</span>
        <span>{children}</span>
      </div>
    ),
    img: ({ src, alt }: { src?: string; alt?: string }) => (
      <img src={src} alt={alt || ''} style={{
        maxWidth: '80%', maxHeight: '70%', objectFit: 'contain', borderRadius: '0.5em',
      }} />
    ),
    hr: () => (
      <div style={{ width: '40%', height: 1, background: 'rgba(255, 255, 255, 0.1)' }} />
    ),
    table: ({ children }: { children: ReactNode }) => (
      <div style={{ fontSize: 'clamp(0.875rem, 1.2vw, 1.125rem)', fontFamily: FONT_SANS, color: '#a1a1aa' }}>
        {children}
      </div>
    ),
    thead: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    tbody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    tr: ({ children }: { children: ReactNode }) => (
      <div style={{ display: 'flex', gap: '1em', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0.5em 0' }}>
        {children}
      </div>
    ),
    td: ({ children }: { children: ReactNode }) => <div style={{ flex: 1 }}>{children}</div>,
    th: ({ children }: { children: ReactNode }) => (
      <div style={{ flex: 1, fontWeight: 600, color: '#e4e4e7' }}>{children}</div>
    ),
  }
}

// ---------------------------------------------------------------------------
// App entry
// ---------------------------------------------------------------------------

export const app = new Spiceflow()
  .page('/', async () => {
    const ast = mdxParse(mdxSource)
    const components = buildVideoMdxComponents()

    // Render imported .mdx/.md files into React components so safe-mdx can
    // resolve `import Intro from './intro.mdx'` and render `<Intro />` via
    // React composition. Each imported MDX gets its own SafeMdxRenderer pass
    // with the same components map, preserving AST positions and avoiding
    // the complexity of AST splicing.
    const moduleKeys = Object.keys(eagerModules)
    const mergedModules: EagerModules = { ...eagerModules }
    const imports = extractImports(ast)
    for (const imp of imports) {
      if (!/\.mdx?$/.test(imp.source)) continue
      const key = resolveModulePath(imp.source, './', moduleKeys)
      if (!key || !mergedModules[key]) continue
      const rawContent = mergedModules[key].default
      if (typeof rawContent !== 'string') continue
      const importedAst = mdxParse(rawContent)
      const renderedJsx = (
        <SafeMdxRenderer
          markdown={rawContent}
          mdast={importedAst}
          components={components}
          modules={mergedModules}
          baseUrl="./"
          onError={(e) => console.warn('[egaki] imported MDX:', e.message)}
        />
      )
      // Replace the raw string module with a component that returns the
      // pre-rendered JSX. safe-mdx reads mod.default for default imports.
      mergedModules[key] = { default: () => renderedJsx }
    }

    const result = splitIntoSections(ast)
    const totalDuration = calculateTotalDuration(result.sections)

    // Extract import nodes (mdxjsEsm) from the full mdast. Section splitting
    // drops them, but SafeMdxRenderer needs them to resolve imported components
    // from the modules map. Prepend to every section's nodes.
    const importNodes = ast.children.filter((node: any) => node.type === 'mdxjsEsm')

    const renderNodes = (nodes: any[]) => (
      <SafeMdxRenderer
        markdown={mdxSource}
        mdast={{ type: 'root', children: [...importNodes, ...nodes] }}
        components={components}
        modules={mergedModules}
        baseUrl="./"
        onError={(e) => console.warn('[egaki] MDX:', e.message)}
      />
    )

    const sections = result.sections.map((section) => ({
      heading: section.heading,
      durationInFrames: section.durationInFrames,
      jsx: renderNodes(section.nodes),
    }))

    return (
      <PlayerPage
        sections={sections}
        totalDuration={totalDuration}
      />
    )
  })
