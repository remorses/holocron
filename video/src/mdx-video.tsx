/**
 * MDX-to-Remotion composition renderer.
 *
 * Parses MDX strings with safe-mdx, splits into sections at headings,
 * and renders as a <Series> composition playable via @remotion/player.
 *
 * ## MDX semantics
 *
 * - `# Heading` / `## Heading` start a new section (sequential via <Series>)
 * - Headings are structural markers only, NOT rendered visually
 * - Paragraphs render as centered text overlays
 * - Code blocks render as styled code visuals
 * - `<Background>` scoping: before first heading = global, inside section = section-local
 * - `<Duration frames={N} />` sets the section duration (default 150 = 5s @ 30fps)
 * - Enter/exit animation wrappers: <FadeIn>, <FadeOut>, <ZoomIn>, <ZoomOut>,
 *   <SlideIn>, <SlideOut>, <BlurIn>, <BlurOut>
 *
 * ## Architecture
 *
 * MDX string → mdxParse() → mdast → splitIntoSections() → <Series> of sections
 * Each section is a <Series.Sequence> with its own local frame counter.
 * Components inside read useCurrentFrame() (0-based within section) and
 * useVideoConfig().durationInFrames (section duration).
 */

import { type ReactNode, useMemo, Fragment } from 'react'
import { SafeMdxRenderer, type SafeMdxError } from 'safe-mdx'
import { mdxParse, type EagerModules } from 'safe-mdx/parse'
import {
  splitIntoSections,
  calculateTotalDuration,
  type MdxSection,
  type SplitResult,
  type VideoFrontmatter,
} from './mdx-parse'
import { logMdxError } from './logger'
import {
  MeshGradientBg,
  BlurReveal,
  MaskedSlideReveal,
  StaggeredFadeUp,
  TerminalSimulator,
  GlassCodeBlock,
  ShimmerSweep,
  SpringPopIn,
  AnimatedChart,
  FeaturePill,
} from './components'

export { splitIntoSections, calculateTotalDuration, createMdxComposition }
export type { MdxSection, SplitResult, VideoFrontmatter, EagerModules, SafeMdxError }

// Inline mdast types to avoid requiring @types/mdast as a dependency
type RootContent = any
type Root = { type: 'root'; children: RootContent[] }
import {
  AbsoluteFill,
  Easing,
  Sequence,
  Series,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

const FONT_SANS =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif'
const FONT_MONO =
  '"SF Mono", ui-monospace, SFMono-Regular, "Cascadia Code", monospace'

// ---------------------------------------------------------------------------
// Enter/exit animation components
//
// Each reads useCurrentFrame() and useVideoConfig().durationInFrames
// to animate at the start (enter) or end (exit) of a section.
// Uses Easing.out for enter (arrive with momentum),
// Easing.in for exit (leave with gravity).
// ---------------------------------------------------------------------------

interface EnterExitProps {
  children: ReactNode
  /** Animation duration in frames */
  duration?: number
}

interface SlideProps extends EnterExitProps {
  direction?: 'up' | 'down' | 'left' | 'right'
}

const ENTER_EASING = Easing.bezier(0.16, 1, 0.3, 1)
const EXIT_EASING = Easing.bezier(0.7, 0, 0.84, 0)

export function FadeIn({ children, duration = 15 }: EnterExitProps) {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: ENTER_EASING,
  })
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
}

export function FadeOut({ children, duration = 15 }: EnterExitProps) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const start = durationInFrames - duration
  const opacity = interpolate(frame, [start, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EXIT_EASING,
  })
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
}

export function ZoomIn({ children, duration = 20 }: EnterExitProps) {
  const frame = useCurrentFrame()
  const progress = interpolate(frame, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: ENTER_EASING,
  })
  const scale = interpolate(progress, [0, 1], [0.6, 1])
  return (
    <AbsoluteFill style={{ opacity: progress, transform: `scale(${scale})` }}>
      {children}
    </AbsoluteFill>
  )
}

export function ZoomOut({ children, duration = 20 }: EnterExitProps) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const start = durationInFrames - duration
  const progress = interpolate(frame, [start, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EXIT_EASING,
  })
  const scale = interpolate(progress, [0, 1], [1, 0.6])
  return (
    <AbsoluteFill style={{ opacity: 1 - progress, transform: `scale(${scale})` }}>
      {children}
    </AbsoluteFill>
  )
}

export function SlideIn({ children, duration = 20, direction = 'up' }: SlideProps) {
  const frame = useCurrentFrame()
  const progress = interpolate(frame, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: ENTER_EASING,
  })
  const distance = 40
  const transforms: Record<string, string> = {
    up: `translateY(${(1 - progress) * distance}px)`,
    down: `translateY(${(progress - 1) * distance}px)`,
    left: `translateX(${(1 - progress) * distance}px)`,
    right: `translateX(${(progress - 1) * distance}px)`,
  }
  return (
    <AbsoluteFill style={{ opacity: progress, transform: transforms[direction] }}>
      {children}
    </AbsoluteFill>
  )
}

export function SlideOut({ children, duration = 20, direction = 'down' }: SlideProps) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const start = durationInFrames - duration
  const progress = interpolate(frame, [start, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EXIT_EASING,
  })
  const distance = 40
  const transforms: Record<string, string> = {
    up: `translateY(${-progress * distance}px)`,
    down: `translateY(${progress * distance}px)`,
    left: `translateX(${-progress * distance}px)`,
    right: `translateX(${progress * distance}px)`,
  }
  return (
    <AbsoluteFill style={{ opacity: 1 - progress, transform: transforms[direction] }}>
      {children}
    </AbsoluteFill>
  )
}

export function BlurIn({ children, duration = 20 }: EnterExitProps) {
  const frame = useCurrentFrame()
  const progress = interpolate(frame, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: ENTER_EASING,
  })
  const blur = interpolate(progress, [0, 1], [20, 0])
  return (
    <AbsoluteFill style={{ opacity: progress, filter: `blur(${blur}px)` }}>
      {children}
    </AbsoluteFill>
  )
}

export function BlurOut({ children, duration = 20 }: EnterExitProps) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const start = durationInFrames - duration
  const progress = interpolate(frame, [start, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EXIT_EASING,
  })
  const blur = interpolate(progress, [0, 1], [0, 20])
  return (
    <AbsoluteFill style={{ opacity: 1 - progress, filter: `blur(${blur}px)` }}>
      {children}
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// <Animate> shorthand — composes enter + exit wrappers
// ---------------------------------------------------------------------------

type AnimationType = 'fadeIn' | 'fadeOut' | 'zoomIn' | 'zoomOut' |
  'slideIn' | 'slideOut' | 'blurIn' | 'blurOut'

interface AnimateProps {
  children: ReactNode
  enter?: AnimationType
  exit?: AnimationType
  enterDuration?: number
  exitDuration?: number
}

const ENTER_COMPONENTS: Record<string, React.FC<EnterExitProps>> = {
  fadeIn: FadeIn,
  zoomIn: ZoomIn,
  slideIn: SlideIn,
  blurIn: BlurIn,
}

const EXIT_COMPONENTS: Record<string, React.FC<EnterExitProps>> = {
  fadeOut: FadeOut,
  zoomOut: ZoomOut,
  slideOut: SlideOut,
  blurOut: BlurOut,
}

export function Animate({
  children,
  enter,
  exit,
  enterDuration,
  exitDuration,
}: AnimateProps) {
  let result = children
  // Wrap exit first (inner), then enter (outer)
  if (exit) {
    const ExitComp = EXIT_COMPONENTS[exit]
    if (ExitComp) {
      result = <ExitComp duration={exitDuration}>{result}</ExitComp>
    }
  }
  if (enter) {
    const EnterComp = ENTER_COMPONENTS[enter]
    if (EnterComp) {
      result = <EnterComp duration={enterDuration}>{result}</EnterComp>
    }
  }
  return <>{result}</>
}

// ---------------------------------------------------------------------------
// MDX component registry for video rendering
//
// These override how safe-mdx renders standard markdown elements.
// Uses em-based sizing with clamp() for responsive scaling.
// Text is centered both horizontally and vertically.
// Code blocks are left-aligned.
// ---------------------------------------------------------------------------

/** Centered container for non-code content */
function Centered({ children }: { children: ReactNode }) {
  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '5% 8%',
        gap: '0.8em',
      }}
    >
      {children}
    </AbsoluteFill>
  )
}

/** <Background> is a structural wrapper extracted during section splitting.
 *  When rendered (in the background pass), it passes through its children
 *  so the actual background component (e.g. <MeshGradientBg>) renders.
 *  In the content pass, Background nodes are already stripped from the tree
 *  so this component won't appear there. */
function BackgroundPassthrough({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

function buildVideoMdxComponents(
  userComponents?: Record<string, any>,
): Record<string, any> {
  return {
    // Passthrough: renders children so <MeshGradientBg> inside <Background> works
    Background: BackgroundPassthrough,

    // Built-in visual components (always available in MDX without import)
    MeshGradientBg,
    BlurReveal,
    MaskedSlideReveal,
    StaggeredFadeUp,
    TerminalSimulator,
    GlassCodeBlock,
    ShimmerSweep,
    SpringPopIn,
    AnimatedChart,
    FeaturePill,

    // Enter/exit animations
    FadeIn,
    FadeOut,
    ZoomIn,
    ZoomOut,
    SlideIn,
    SlideOut,
    BlurIn,
    BlurOut,
    Animate,
    Centered,

    // Standard element overrides
    p: ({ children }: { children: ReactNode }) => (
      <div
        style={{
          fontSize: 'clamp(1.5rem, 2.5vw, 3rem)',
          fontWeight: 400,
          color: '#a1a1aa',
          fontFamily: FONT_SANS,
          textAlign: 'center',
          letterSpacing: '-0.02em',
          lineHeight: 1.4,
          maxWidth: '80%',
        }}
      >
        {children}
      </div>
    ),

    strong: ({ children }: { children: ReactNode }) => (
      <span style={{ color: '#fafafa', fontWeight: 600 }}>{children}</span>
    ),

    em: ({ children }: { children: ReactNode }) => (
      <span style={{ fontStyle: 'italic' }}>{children}</span>
    ),

    a: ({ children, href }: { children: ReactNode; href?: string }) => (
      <span style={{ color: '#818cf8', textDecoration: 'underline' }}>{children}</span>
    ),

    // Headings are structural markers, not rendered.
    // But in case safe-mdx encounters one in leftover nodes:
    h1: () => null,
    h2: () => null,
    h3: () => null,
    h4: () => null,
    h5: () => null,
    h6: () => null,

    // Blockquotes ignored
    blockquote: () => null,

    // Code blocks — left-aligned, monospace
    pre: ({ children }: { children: ReactNode }) => (
      <div
        style={{
          width: '100%',
          maxWidth: '80%',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {children}
      </div>
    ),
    code: ({ children, className }: { children: ReactNode; className?: string }) => (
      <pre
        style={{
          fontSize: 'clamp(0.875rem, 1.2vw, 1.125rem)',
          fontFamily: FONT_MONO,
          color: '#e4e4e7',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '0.75em',
          padding: '1.25em 1.5em',
          lineHeight: 1.6,
          whiteSpace: 'pre',
          overflow: 'hidden',
          width: '100%',
          textAlign: 'left',
        }}
      >
        {children}
      </pre>
    ),

    // Inline code
    inlineCode: ({ children }: { children: ReactNode }) => (
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: '0.875em',
          color: '#e4e4e7',
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: '0.25em',
          padding: '0.1em 0.4em',
        }}
      >
        {children}
      </span>
    ),

    // Lists
    ul: ({ children }: { children: ReactNode }) => (
      <div
        style={{
          fontSize: 'clamp(1.25rem, 2vw, 2rem)',
          color: '#a1a1aa',
          fontFamily: FONT_SANS,
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4em',
        }}
      >
        {children}
      </div>
    ),
    ol: ({ children }: { children: ReactNode }) => (
      <div
        style={{
          fontSize: 'clamp(1.25rem, 2vw, 2rem)',
          color: '#a1a1aa',
          fontFamily: FONT_SANS,
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4em',
        }}
      >
        {children}
      </div>
    ),
    li: ({ children }: { children: ReactNode }) => (
      <div style={{ display: 'flex', gap: '0.5em' }}>
        <span style={{ color: '#52525b' }}>•</span>
        <span>{children}</span>
      </div>
    ),

    // Images
    img: ({ src, alt }: { src?: string; alt?: string }) => (
      <img
        src={src}
        alt={alt || ''}
        style={{
          maxWidth: '80%',
          maxHeight: '70%',
          objectFit: 'contain',
          borderRadius: '0.5em',
        }}
      />
    ),

    // Thematic break
    hr: () => (
      <div
        style={{
          width: '40%',
          height: 1,
          background: 'rgba(255, 255, 255, 0.1)',
        }}
      />
    ),

    // Tables
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

    // Pass through any user-provided components
    ...userComponents,
  }
}

// ---------------------------------------------------------------------------
// Section renderer
// ---------------------------------------------------------------------------

function SectionRenderer({
  section,
  imports,
  components,
  markdown,
  scope,
  modules,
  baseUrl,
  onError,
}: {
  section: MdxSection
  imports: RootContent[]
  components: Record<string, any>
  markdown: string
  scope?: Record<string, any>
  modules?: EagerModules
  baseUrl?: string
  onError?: (error: SafeMdxError) => void
}) {
  // Prepend import nodes so SafeMdxRenderer can resolve module bindings
  const syntheticBgRoot: Root = { type: 'root', children: [...imports, ...section.backgrounds] }
  const syntheticRoot: Root = { type: 'root', children: [...imports, ...section.nodes] }

  return (
    <AbsoluteFill style={{ background: '#050505' }}>
      {/* Section-scoped backgrounds (behind content) */}
      {section.backgrounds.length > 0 && (
        <SafeMdxRenderer
          markdown={markdown}
          mdast={syntheticBgRoot}
          components={components}
          scope={scope}
          modules={modules}
          baseUrl={baseUrl}
          onError={onError}
        />
      )}

      {/* Foreground content — centered */}
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
        <SafeMdxRenderer
          markdown={markdown}
          mdast={syntheticRoot}
          components={components}
          scope={scope}
          modules={modules}
          baseUrl={baseUrl}
          onError={onError}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// MdxVideo component
// ---------------------------------------------------------------------------

export interface MdxVideoProps {
  /** MDX source string */
  mdx: string
  /** Extra components available in MDX (e.g. MeshGradientBg, TerminalSimulator) */
  components?: Record<string, any>
  /** Variables available in MDX expressions (e.g. data arrays) */
  scope?: Record<string, any>
  /** Pre-resolved modules from resolveModules() for MDX import statements */
  modules?: EagerModules
  /** Base URL for resolving relative imports (e.g. './') */
  baseUrl?: string
  /** Called for each safe-mdx render error (missing components, invalid expressions, etc.) */
  onError?: (error: SafeMdxError) => void
}

function MdxVideo({
  mdx,
  components: userComponents,
  scope,
  modules,
  baseUrl,
  onError,
}: MdxVideoProps) {
  const { globals, sections, imports, allComponents, totalDuration } = useMemo(() => {
    const ast = mdxParse(mdx)
    const result = splitIntoSections(ast)
    const total = calculateTotalDuration(result.sections)
    const comps = buildVideoMdxComponents(userComponents)
    return {
      ...result,
      allComponents: comps,
      totalDuration: total,
    }
  }, [mdx, userComponents])

  if (sections.length === 0) {
    return <AbsoluteFill style={{ background: '#050505' }} />
  }

  return (
    <AbsoluteFill style={{ background: '#050505' }}>
      {/* Global backgrounds — span entire composition */}
      {globals.backgrounds.length > 0 && (
        <Sequence from={0} durationInFrames={totalDuration}>
          <SafeMdxRenderer
            markdown={mdx}
            mdast={{ type: 'root', children: [...imports, ...globals.backgrounds] } as Root}
            components={allComponents}
            scope={scope}
            modules={modules}
            baseUrl={baseUrl}
            onError={onError}
          />
        </Sequence>
      )}

      {/* Sequential sections via <Series> */}
      <Series>
        {sections.map((section, i) => (
          <Series.Sequence
            key={i}
            durationInFrames={section.durationInFrames}
            // @ts-ignore — name prop exists on Series.Sequence
            name={section.heading || `Section ${i}`}
          >
            <SectionRenderer
              section={section}
              imports={imports}
              components={allComponents}
              markdown={mdx}
              scope={scope}
              modules={modules}
              baseUrl={baseUrl}
              onError={onError}
            />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// createMdxComposition — pure function, no hooks
//
// Parses MDX once and returns a stable Remotion component + duration.
// Call at module scope or in an async init function, not inside render.
// ---------------------------------------------------------------------------

function createMdxComposition(props: MdxVideoProps): {
  /** Stable component reference for <Player component={...}> */
  Component: React.FC
  /** Total duration in frames across all sections */
  durationInFrames: number
} {
  const ast = mdxParse(props.mdx)
  const result = splitIntoSections(ast)
  const durationInFrames = calculateTotalDuration(result.sections)

  const handleError = (error: SafeMdxError) => {
    logMdxError(error)
    props.onError?.(error)
  }

  const Component = () => (
    <MdxVideo
      mdx={props.mdx}
      components={props.components}
      scope={props.scope}
      modules={props.modules}
      baseUrl={props.baseUrl}
      onError={handleError}
    />
  )

  return { Component, durationInFrames }
}
