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
import { SafeMdxRenderer } from 'safe-mdx'
import { mdxParse, resolveModules, type EagerModules, type LazyGlob } from 'safe-mdx/parse'
import YAML from 'yaml'

export { resolveModules, mdxParse, type EagerModules, type LazyGlob }

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_FPS = 30
const DEFAULT_BPM = 120 // 120 bpm = 2 beats/sec = 15 frames/beat at 30fps
const DEFAULT_SECTION_BEATS = 10 // 10 beats = 150 frames at defaults

const FONT_SANS =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif'
const FONT_MONO =
  '"SF Mono", ui-monospace, SFMono-Regular, "Cascadia Code", monospace'

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

export interface VideoFrontmatter {
  fps: number
  bpm: number
}

/** Parse YAML frontmatter from mdast. Extracts fps, bpm, and any extra fields. */
function parseFrontmatter(mdast: Root): VideoFrontmatter {
  const result: VideoFrontmatter = { fps: DEFAULT_FPS, bpm: DEFAULT_BPM }
  for (const node of mdast.children) {
    if (node.type !== 'yaml') continue
    const text = (node as any).value as string
    if (!text) continue
    const parsed = YAML.parse(text)
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.fps === 'number' && parsed.fps > 0) result.fps = parsed.fps
      if (typeof parsed.bpm === 'number' && parsed.bpm > 0) result.bpm = parsed.bpm
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Duration parsing from heading text
//
// Headings can include duration=VALUE at the end:
//   # Opening duration=2s       → 2 seconds → 2 * fps frames
//   # Opening duration=60       → 60 frames (bare number)
//   # Opening duration=60fps    → 60 frames (explicit)
//   # Opening duration=4beats   → 4 beats → 4 * framesPerBeat
//
// The duration= part is stripped from the heading label.
// ---------------------------------------------------------------------------

const DURATION_RE = /\s+duration=(\d+(?:\.\d+)?)(s|fps|beats?)?\s*$/i

interface ParsedHeading {
  label: string
  durationInFrames: number | null
}

function parseHeadingDuration(
  rawText: string,
  fps: number,
  bpm: number,
): ParsedHeading {
  const match = rawText.match(DURATION_RE)
  if (!match) return { label: rawText.trim(), durationInFrames: null }

  const value = Number(match[1])
  const unit = (match[2] || '').toLowerCase()
  const label = rawText.slice(0, match.index).trim()
  const framesPerBeat = fps / (bpm / 60)

  let frames: number
  if (unit === 's') {
    frames = Math.round(value * fps)
  } else if (unit === 'beat' || unit === 'beats') {
    frames = Math.round(value * framesPerBeat)
  } else {
    // bare number or "fps" suffix → frames
    frames = Math.round(value)
  }

  return { label: label || 'Untitled', durationInFrames: frames }
}

// ---------------------------------------------------------------------------
// Section splitting
// ---------------------------------------------------------------------------

export interface MdxSection {
  /** Heading text for debugging / sequence naming */
  heading: string | null
  /** Content nodes to render via safe-mdx */
  nodes: RootContent[]
  /** <Background> nodes scoped to this section */
  backgrounds: RootContent[]
  /** Duration in frames */
  durationInFrames: number
}

export interface SplitResult {
  /** <Background> nodes placed before the first heading (span full composition) */
  globals: { backgrounds: RootContent[] }
  sections: MdxSection[]
  frontmatter: VideoFrontmatter
}

function isJsxElement(node: RootContent, name: string): boolean {
  return (
    (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') &&
    (node as any).name === name
  )
}

function extractHeadingText(node: RootContent): string {
  if (node.type !== 'heading') return ''
  const parts: string[] = []
  for (const child of (node as any).children || []) {
    if (child.type === 'text') parts.push(child.value)
  }
  return parts.join('') || 'Untitled'
}

export function splitIntoSections(mdast: Root): SplitResult {
  const frontmatter = parseFrontmatter(mdast)
  const { fps, bpm } = frontmatter
  const framesPerBeat = fps / (bpm / 60)
  const defaultDuration = Math.round(DEFAULT_SECTION_BEATS * framesPerBeat)

  const globals: SplitResult['globals'] = { backgrounds: [] }
  const sections: MdxSection[] = []
  let current: MdxSection | null = null
  let beforeFirstHeading = true

  for (const node of mdast.children) {
    // Skip frontmatter and ESM imports at the document level
    if (node.type === 'yaml' || node.type === 'toml' || node.type === 'mdxjsEsm') {
      continue
    }

    // Heading starts a new section
    if (node.type === 'heading') {
      beforeFirstHeading = false
      const rawText = extractHeadingText(node)
      const parsed = parseHeadingDuration(rawText, fps, bpm)
      current = {
        heading: parsed.label,
        nodes: [],
        backgrounds: [],
        durationInFrames: parsed.durationInFrames ?? defaultDuration,
      }
      sections.push(current)
      continue
    }

    // <Background> extraction
    if (isJsxElement(node, 'Background')) {
      if (beforeFirstHeading) {
        globals.backgrounds.push(node)
      } else if (current) {
        current.backgrounds.push(node)
      }
      continue
    }

    // Regular content nodes
    if (beforeFirstHeading) {
      // Content before first heading: create an implicit section
      if (!current) {
        current = {
          heading: null,
          nodes: [],
          backgrounds: [],
          durationInFrames: defaultDuration,
        }
        sections.push(current)
        beforeFirstHeading = false
      }
      current.nodes.push(node)
    } else if (current) {
      current.nodes.push(node)
    }
  }

  return { globals, sections, frontmatter }
}

/** Calculate total composition duration: simple sum since no transitions */
export function calculateTotalDuration(sections: MdxSection[]): number {
  return sections.reduce((sum, s) => sum + s.durationInFrames, 0)
}

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
  components,
  markdown,
  scope,
  modules,
  baseUrl,
}: {
  section: MdxSection
  components: Record<string, any>
  markdown: string
  scope?: Record<string, any>
  modules?: EagerModules
  baseUrl?: string
}) {
  const syntheticBgRoot: Root = { type: 'root', children: section.backgrounds }
  const syntheticRoot: Root = { type: 'root', children: section.nodes }

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
}

function MdxVideo({
  mdx,
  components: userComponents,
  scope,
  modules,
  baseUrl,
}: MdxVideoProps) {
  const { globals, sections, allComponents, totalDuration } = useMemo(() => {
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
            mdast={{ type: 'root', children: globals.backgrounds } as Root}
            components={allComponents}
            scope={scope}
            modules={modules}
            baseUrl={baseUrl}
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
              components={allComponents}
              markdown={mdx}
              scope={scope}
              modules={modules}
              baseUrl={baseUrl}
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

export function createMdxComposition(props: MdxVideoProps): {
  /** Stable component reference for <Player component={...}> */
  Component: React.FC
  /** Total duration in frames across all sections */
  durationInFrames: number
} {
  const ast = mdxParse(props.mdx)
  const result = splitIntoSections(ast)
  const durationInFrames = calculateTotalDuration(result.sections)

  const Component = () => (
    <MdxVideo
      mdx={props.mdx}
      components={props.components}
      scope={props.scope}
      modules={props.modules}
      baseUrl={props.baseUrl}
    />
  )

  return { Component, durationInFrames }
}
