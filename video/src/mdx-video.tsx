'use client'

/**
 * Client-side video components for MDX rendering.
 *
 * Contains animation wrappers (enter/exit), element overrides for safe-mdx,
 * and the components map builder. All marked 'use client' because animation
 * components use Remotion hooks (useCurrentFrame, useVideoConfig).
 *
 * The server imports this file and gets client references for the components
 * map. safe-mdx creates React elements with these references on the server;
 * hooks execute on the client inside Remotion's Player render loop.
 */

import { type ReactNode } from 'react'
import type { SafeMdxError } from 'safe-mdx'
import type { EagerModules } from 'safe-mdx/parse'
import {
  splitIntoSections,
  calculateTotalDuration,
  type MdxSection,
  type SplitResult,
  type VideoFrontmatter,
} from './mdx-parse.ts'
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
} from './components.tsx'

export { splitIntoSections, calculateTotalDuration }
export type { MdxSection, SplitResult, VideoFrontmatter, EagerModules, SafeMdxError }

import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

// ---------------------------------------------------------------------------
// Background — real component that self-positions as an absolute layer
//
// Works both in MDX and when imported from TSX components. Renders its
// children in a full-frame AbsoluteFill behind sibling content. In Remotion
// all layout is absolute, so this naturally layers behind content that
// comes after it in DOM order.
// ---------------------------------------------------------------------------

export function Background({ children }: { children?: ReactNode }) {
  return <AbsoluteFill>{children}</AbsoluteFill>
}

const FONT_SANS =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif'
const FONT_MONO =
  '"SF Mono", ui-monospace, SFMono-Regular, "Cascadia Code", monospace'

// ---------------------------------------------------------------------------
// Enter/exit animation components
//
// Each reads useCurrentFrame() and useVideoConfig().durationInFrames
// to animate at the start (enter) or end (exit) of a section.
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

// Visual components and animations are re-exported so they're available
// as named imports from this client module for MDX usage.
export {
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
}
