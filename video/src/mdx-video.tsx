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
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { Audio, Video } from '@remotion/media'

// ---------------------------------------------------------------------------
// springFromDuration() — Framer Motion-style spring API for Remotion
//
// Remotion's spring() uses physics parameters (damping, stiffness, mass)
// which are hard to reason about. This converts the intuitive
// (duration, bounce) pair into those physics params, matching how
// Framer Motion's simplified spring API works internally.
//
// - duration: seconds (how long the animation takes)
// - bounce: 0 = critically damped (no overshoot), 1 = maximum bounce
//
// Always use this over raw spring() config for readability.
// ---------------------------------------------------------------------------

export interface SpringConfig {
  stiffness: number
  damping: number
  mass: number
}

/**
 * Convert a human-readable (duration, bounce) pair into Remotion spring
 * physics config. Ported from Framer Motion's spring resolver.
 *
 * @param duration - Animation duration in seconds (e.g. 0.5)
 * @param bounce - Bounciness from 0 (no overshoot) to 1 (max bounce). Default 0.
 *
 * ```ts
 * // No bounce, 400ms
 * spring({ frame, fps, config: springFromDuration(0.4) })
 *
 * // Subtle Apple-like overshoot, 600ms
 * spring({ frame, fps, config: springFromDuration(0.6, 0.25) })
 *
 * // Playful bounce, 500ms
 * spring({ frame, fps, config: springFromDuration(0.5, 0.5) })
 * ```
 */
export function springFromDuration(
  duration: number,
  bounce: number = 0,
): SpringConfig {
  const omega = (2 * Math.PI) / duration
  const zeta = 1 - Math.max(0, Math.min(1, bounce))
  return {
    stiffness: omega * omega,
    damping: 2 * zeta * omega,
    mass: 1,
  }
}

/**
 * Shorthand: run a spring animation driven by springFromDuration().
 * Returns 0-to-1 progress (or 0-to-`to` if specified).
 *
 * ```tsx
 * const scale = dspring(frame, fps, 0.5, 0.3) // 500ms, slight bounce
 * ```
 */
export function dspring(
  frame: number,
  fps: number,
  duration: number,
  bounce: number = 0,
  options?: { delay?: number; to?: number; from?: number },
): number {
  return spring({
    frame,
    fps,
    config: springFromDuration(duration, bounce),
    delay: options?.delay,
    to: options?.to,
    from: options?.from,
  })
}

// ---------------------------------------------------------------------------
// Easing presets — named bezier curves for common motion styles.
// Use with interpolate(frame, range, range, { easing: EASE.apple }).
//
// These are the After Effects / Apple motion graphics "cheat codes":
// curves that motion designers converge on for premium-feeling animation.
// ---------------------------------------------------------------------------

export const EASE = {
  /** AE 75% influence — tight S-curve, the "Apple ease" */
  apple: Easing.bezier(0.76, 0, 0.24, 1),
  /** Fast enter, gentle settle — elements arriving with momentum */
  enterFast: Easing.bezier(0.22, 1, 0.36, 1),
  /** Slow start, fast exit — elements leaving the frame */
  exitSlow: Easing.bezier(0.55, 0, 1, 0.45),
  /** Social media punch — very sharp burst */
  snappy: Easing.bezier(0.87, 0, 0.13, 1),
  /** Luxurious, slow cinematic feel */
  cinematic: Easing.bezier(0.83, 0, 0.17, 1),
} as const

// ---------------------------------------------------------------------------
// Background — real component that self-positions as an absolute layer
//
// Works both in MDX and when imported from TSX components. Renders its
// children in a full-frame AbsoluteFill behind sibling content. In Remotion
// all layout is absolute, so this naturally layers behind content that
// comes after it in DOM order.
// ---------------------------------------------------------------------------

export function Background({ children }: { children?: ReactNode }) {
  return <AbsoluteFill style={{ zIndex: 0 }}>{children}</AbsoluteFill>
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

// Ease-in for enters: starts slow, builds momentum, arrives fast.
// Creates dramatic tension as elements accelerate into position.
const ENTER_EASING = Easing.bezier(0.95, 0, 1, 0.05)

// Ease-out for exits: starts fast (snaps away), decelerates out.
const EXIT_EASING = Easing.bezier(0.0, 0.95, 0.05, 1)

// Slide distance in px. 140px+ needed for visible motion at 1080p.
const SLIDE_DISTANCE = 140

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
  const scale = interpolate(progress, [0, 1], [0.5, 1])
  return (
    <AbsoluteFill style={{ opacity: progress, transform: subpx(`scale(${scale})`), ...SUBPX_STYLE }}>
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
  const scale = interpolate(progress, [0, 1], [1, 0.5])
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
  const d = SLIDE_DISTANCE
  const transforms: Record<string, string> = {
    up: `translateY(${(1 - progress) * d}px)`,
    down: `translateY(${(progress - 1) * d}px)`,
    left: `translateX(${(1 - progress) * d}px)`,
    right: `translateX(${(progress - 1) * d}px)`,
  }
  return (
    <AbsoluteFill style={{ opacity: progress, transform: subpx(transforms[direction]), ...SUBPX_STYLE }}>
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
  const d = SLIDE_DISTANCE
  const transforms: Record<string, string> = {
    up: `translateY(${-progress * d}px)`,
    down: `translateY(${progress * d}px)`,
    left: `translateX(${-progress * d}px)`,
    right: `translateX(${progress * d}px)`,
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
  const blur = interpolate(progress, [0, 1], [24, 0])
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
  const blur = interpolate(progress, [0, 1], [0, 24])
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

// ---------------------------------------------------------------------------
// keyframes() — evaluate a keyframed animation at a given frame
//
// Accepts an array of typed keyframe descriptors with bezier easing, hold,
// and per-dimension control. Wraps Remotion's interpolate() + Easing.bezier()
// so you get the full Lottie/After Effects easing model with clean parameters.
//
// See video/docs/lottie-to-remotion.md for the Lottie field mapping.
// ---------------------------------------------------------------------------

/**
 * Cubic bezier control points: [x1, y1, x2, y2].
 * Same as CSS `cubic-bezier(x1, y1, x2, y2)`.
 * x values must be in [0, 1]. y values can overshoot (< 0 or > 1).
 */
export type BezierCurve = [x1: number, y1: number, x2: number, y2: number]

/** A single keyframe in a `keyframes()` animation. */
export interface Keyframe<T extends number | number[] = number> {
  /** Frame number where this keyframe occurs. */
  time: number
  /** Value at this keyframe. Scalar or vector (e.g. [x, y] for position). */
  value: T
  /**
   * Bezier easing curve for the transition FROM this keyframe TO the next.
   * Four control points [x1, y1, x2, y2], same as CSS cubic-bezier().
   * Omit for linear interpolation. Ignored on the last keyframe.
   */
  easing?: BezierCurve
  /**
   * If true, value holds constant until the next keyframe (step function).
   * No interpolation occurs. Overrides `easing`.
   */
  hold?: boolean
}

/** Options for per-dimension easing on vector keyframes. */
export interface KeyframesDimensionOptions {
  /**
   * Per-dimension bezier easing overrides.
   * Index matches the dimension index in the value array.
   * When set, overrides the keyframe-level `easing` for that dimension.
   * Each entry is a [x1, y1, x2, y2] bezier curve or undefined to use the keyframe's easing.
   */
  dimensionEasing?: (BezierCurve | undefined)[]
}

// Step easing: holds at 0 until t=1, then jumps to 1
function stepEasing(t: number): number {
  return t < 1 ? 0 : 1
}

function buildEasingFn(curve: BezierCurve | undefined): (t: number) => number {
  if (!curve) return (t: number) => t // linear
  return Easing.bezier(curve[0], curve[1], curve[2], curve[3])
}

/**
 * Evaluate a keyframed animation at the given frame.
 *
 * Scalar version: each keyframe has a numeric `value`, returns a number.
 *
 * ```ts
 * const opacity = keyframes(frame, [
 *   { time: 0,  value: 0,   easing: [0.33, 0, 0.67, 1] },
 *   { time: 30, value: 1 },
 * ])
 * ```
 */
export function keyframes(
  frame: number,
  kfs: Keyframe<number>[],
  options?: KeyframesDimensionOptions,
): number

/**
 * Vector version: each keyframe has an array `value`, returns an array
 * of the same length. Supports per-dimension easing via options.
 *
 * ```ts
 * const [x, y] = keyframes(frame, [
 *   { time: 0,  value: [0, 0],     easing: [0.33, 0, 0.67, 1] },
 *   { time: 30, value: [200, 400] },
 * ])
 * ```
 */
export function keyframes<N extends number>(
  frame: number,
  kfs: Keyframe<number[] & { length: N }>[],
  options?: KeyframesDimensionOptions,
): number[]

export function keyframes(
  frame: number,
  kfs: Keyframe<number | number[]>[],
  options?: KeyframesDimensionOptions,
): number | number[] {
  if (kfs.length === 0) {
    throw new Error('keyframes() requires at least one keyframe')
  }

  if (kfs.length === 1) {
    return kfs[0].value
  }

  const first = kfs[0].value
  const isVector = Array.isArray(first)

  if (isVector) {
    return evaluateVector(frame, kfs as Keyframe<number[]>[], options)
  }

  return evaluateScalar(frame, kfs as Keyframe<number>[], options)
}

function evaluateScalar(
  frame: number,
  kfs: Keyframe<number>[],
  options?: KeyframesDimensionOptions,
): number {
  const inputRange = kfs.map((kf) => kf.time)
  const outputRange = kfs.map((kf) => kf.value)
  const dimEasing = options?.dimensionEasing?.[0]

  const easings: ((t: number) => number)[] = []
  for (let i = 0; i < kfs.length - 1; i++) {
    const kf = kfs[i]
    if (kf.hold) {
      easings.push(stepEasing)
    } else {
      easings.push(buildEasingFn(dimEasing ?? kf.easing))
    }
  }

  return interpolate(frame, inputRange, outputRange, {
    easing: easings,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}

function evaluateVector(
  frame: number,
  kfs: Keyframe<number[]>[],
  options?: KeyframesDimensionOptions,
): number[] {
  const dimensions = kfs[0].value.length
  const result: number[] = new Array(dimensions)

  for (let dim = 0; dim < dimensions; dim++) {
    const inputRange = kfs.map((kf) => kf.time)
    const outputRange = kfs.map((kf) => kf.value[dim])
    const dimEasing = options?.dimensionEasing?.[dim]

    const easings: ((t: number) => number)[] = []
    for (let i = 0; i < kfs.length - 1; i++) {
      const kf = kfs[i]
      if (kf.hold) {
        easings.push(stepEasing)
      } else {
        easings.push(buildEasingFn(dimEasing ?? kf.easing))
      }
    }

    result[dim] = interpolate(frame, inputRange, outputRange, {
      easing: easings,
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  }

  return result
}

// ---------------------------------------------------------------------------
// fromLottieProperty() — convert a raw Lottie animated property to keyframes
//
// Takes Lottie's { a, k } shape directly and returns a Keyframe[] array
// compatible with keyframes(). Useful when loading a Lottie JSON file and
// wanting to drive Remotion animations from its data.
// ---------------------------------------------------------------------------

/** Raw Lottie easing handle shape. */
export interface LottieEasingHandle {
  x: number | number[]
  y: number | number[]
}

/** Raw Lottie keyframe as found in a .json file. */
export interface LottieKeyframe {
  /** Frame number */
  t: number
  /** Value at this keyframe */
  s?: number[]
  /** Hold flag */
  h?: 0 | 1
  /** In tangent (easing into next keyframe) */
  i?: LottieEasingHandle
  /** Out tangent (easing leaving this keyframe) */
  o?: LottieEasingHandle
}

/** Raw Lottie animated property: { a: 0|1, k: value | keyframes }. */
export interface LottieAnimatedProperty {
  /** 1 if animated, 0 if static */
  a: 0 | 1
  /** Static value (when a=0) or array of keyframes (when a=1) */
  k: number | number[] | LottieKeyframe[]
}

/**
 * Convert a raw Lottie animated property into a `Keyframe[]` array
 * that can be passed directly to `keyframes()`.
 *
 * ```ts
 * import lottieJson from './animation.json'
 *
 * // Get the opacity property from layer 0
 * const opacityKfs = fromLottieProperty(lottieJson.layers[0].ks.o)
 * const opacity = keyframes(frame, opacityKfs)
 * ```
 *
 * For static properties (a=0), returns a single keyframe at time 0.
 * For vector properties, values are preserved as arrays.
 */
export function fromLottieProperty(
  property: LottieAnimatedProperty,
): Keyframe<number>[] | Keyframe<number[]>[] {
  // Static property
  if (!property.a || !Array.isArray(property.k) || property.k.length === 0) {
    const val = property.k
    if (Array.isArray(val)) {
      return [{ time: 0, value: val }] as Keyframe<number[]>[]
    }
    return [{ time: 0, value: val as number }]
  }

  const lottieKfs = property.k as LottieKeyframe[]

  // Detect if this is a scalar or vector property from the first keyframe's value
  const firstValue = lottieKfs[0].s
  if (!firstValue || firstValue.length === 0) {
    return [{ time: 0, value: 0 }]
  }

  const isScalar = firstValue.length === 1

  if (isScalar) {
    return lottieKfs.map((lkf, i): Keyframe<number> => {
      const kf: Keyframe<number> = {
        time: lkf.t,
        value: lkf.s?.[0] ?? 0,
      }
      if (lkf.h === 1) {
        kf.hold = true
      } else if (lkf.o && lkf.i && i < lottieKfs.length - 1) {
        kf.easing = extractBezier(lkf.o, lkf.i, 0)
      }
      return kf
    })
  }

  // Vector property
  return lottieKfs.map((lkf, i): Keyframe<number[]> => {
    const kf: Keyframe<number[]> = {
      time: lkf.t,
      value: lkf.s ? [...lkf.s] : [],
    }
    if (lkf.h === 1) {
      kf.hold = true
    } else if (lkf.o && lkf.i && i < lottieKfs.length - 1) {
      // Use dimension 0 for the keyframe-level easing
      kf.easing = extractBezier(lkf.o, lkf.i, 0)
    }
    return kf
  })
}

/**
 * Extract per-dimension easing overrides from a Lottie keyframe sequence.
 * Returns a `dimensionEasing` array suitable for the `keyframes()` options.
 * Only needed when the Lottie property has different easing per dimension
 * (e.g. position with independent X/Y curves).
 *
 * ```ts
 * const posKfs = fromLottieProperty(lottieJson.layers[0].ks.p)
 * const dimEasing = extractLottieDimensionEasing(lottieJson.layers[0].ks.p, segmentIndex)
 * const [x, y] = keyframes(frame, posKfs, { dimensionEasing: dimEasing })
 * ```
 */
export function extractLottieDimensionEasing(
  property: LottieAnimatedProperty,
  segmentIndex: number,
): (BezierCurve | undefined)[] | undefined {
  if (!property.a || !Array.isArray(property.k)) return undefined
  const lottieKfs = property.k as LottieKeyframe[]
  const lkf = lottieKfs[segmentIndex]
  if (!lkf?.o || !lkf?.i || !lkf.s) return undefined

  const dimensions = lkf.s.length
  if (dimensions <= 1) return undefined

  // Check if all dimensions have the same easing — if so, no overrides needed
  const ox = lkf.o.x
  const oy = lkf.o.y
  const ix = lkf.i.x
  const iy = lkf.i.y
  if (!Array.isArray(ox) || !Array.isArray(oy) || !Array.isArray(ix) || !Array.isArray(iy)) {
    return undefined
  }
  if (ox.length <= 1 && oy.length <= 1 && ix.length <= 1 && iy.length <= 1) {
    return undefined
  }

  const result: (BezierCurve | undefined)[] = []
  for (let dim = 0; dim < dimensions; dim++) {
    result.push(extractBezier(lkf.o, lkf.i, dim))
  }
  return result
}

function extractBezier(
  out: LottieEasingHandle,
  into: LottieEasingHandle,
  dimension: number,
): BezierCurve {
  const ox = Array.isArray(out.x) ? (out.x[dimension] ?? out.x[0]) : out.x
  const oy = Array.isArray(out.y) ? (out.y[dimension] ?? out.y[0]) : out.y
  const ix = Array.isArray(into.x) ? (into.x[dimension] ?? into.x[0]) : into.x
  const iy = Array.isArray(into.y) ? (into.y[dimension] ?? into.y[0]) : into.y
  return [ox, oy, ix, iy]
}

// ---------------------------------------------------------------------------
// Shared layout transitions — FLIP-based element identity across sections
//
// <Shared id="x"> wraps an element that should visually persist across
// section boundaries. When two sections both contain <Shared id="x">,
// during the TransitionSeries overlap the element animates from its
// position in the exiting section to its position in the entering section.
//
// Architecture:
// - SharedRegistry (context) holds refs + rects for all mounted Shared elements
// - Each Shared component registers itself on mount and measures its rect
// - SharedAnimationLayer (rendered above the TransitionSeries) renders
//   a FLIP clone during transitions using interpolated transforms
// - Both the exiting and entering Shared elements go visibility:hidden
//   during the transition so only the animation layer clone is visible
// ---------------------------------------------------------------------------

import { createContext, useContext, useLayoutEffect, useRef, useCallback, type RefObject } from 'react'
import { useTransitionProgress } from '@remotion/transitions'

interface SharedEntry {
  id: string
  ref: RefObject<HTMLDivElement | null>
  children: ReactNode
  /** 'entering' | 'exiting' | 'stable' */
  direction: string
  /** Cached bounding rect, measured each frame in useLayoutEffect */
  rect: DOMRect | null
}

interface SharedRegistryValue {
  entries: Map<string, SharedEntry[]>
  /** Ref to the composition root for coordinate normalization */
  rootRef: RefObject<HTMLDivElement | null>
  register(entry: SharedEntry): void
  unregister(id: string, ref: RefObject<HTMLDivElement | null>): void
}

export const SharedRegistryContext = createContext<SharedRegistryValue | null>(null)

/**
 * Provider that tracks all mounted Shared elements. Placed at the
 * VideoComposition level so it spans both the TransitionSeries and
 * the SharedAnimationLayer.
 */
export function SharedRegistryProvider({
  children,
  rootRef,
}: {
  children: ReactNode
  rootRef: RefObject<HTMLDivElement | null>
}) {
  const entriesRef = useRef(new Map<string, SharedEntry[]>())

  const register = useCallback((entry: SharedEntry) => {
    const list = entriesRef.current.get(entry.id) || []
    // Replace existing entry with same ref, or add new
    const idx = list.findIndex((e) => e.ref === entry.ref)
    if (idx >= 0) {
      list[idx] = entry
    } else {
      list.push(entry)
    }
    entriesRef.current.set(entry.id, list)
  }, [])

  const unregister = useCallback((id: string, ref: RefObject<HTMLDivElement | null>) => {
    const list = entriesRef.current.get(id)
    if (!list) return
    const filtered = list.filter((e) => e.ref !== ref)
    if (filtered.length === 0) {
      entriesRef.current.delete(id)
    } else {
      entriesRef.current.set(id, filtered)
    }
  }, [])

  // Recreate the value object each render so the animation layer
  // always reads fresh entries. The entries Map is mutated in place
  // by register/unregister (via refs), so the animation layer's
  // render pass sees the latest state from Shared components that
  // rendered earlier in the same pass.
  const value: SharedRegistryValue = {
    entries: entriesRef.current,
    rootRef,
    register,
    unregister,
  }

  return (
    <SharedRegistryContext.Provider value={value}>
      {children}
    </SharedRegistryContext.Provider>
  )
}

/**
 * Shared element wrapper. Wraps children that should maintain visual
 * identity across section boundaries via FLIP animation.
 *
 * Usage in MDX:
 * ```mdx
 * # Scene 1 duration=5s transition=20
 *
 * <Shared id="title">
 *   <BlurReveal text="Hello" />
 * </Shared>
 *
 * # Scene 2 duration=5s
 *
 * <Shared id="title">
 *   <BlurReveal text="Hello" />
 * </Shared>
 * ```
 */
export function Shared({ id, children }: { id: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const registry = useContext(SharedRegistryContext)
  const { entering, exiting, isInTransitionSeries } = useTransitionProgress()

  const direction = entering < 1 ? 'entering' : exiting > 0 ? 'exiting' : 'stable'

  // Register with the registry on every render so the animation layer
  // can find our ref and children. Registration is synchronous (mutates
  // the Map via ref) so it's visible to sibling components in the same
  // render pass.
  if (registry) {
    registry.register({ id, ref, children, direction, rect: null })
  }

  // Measure our rect after layout so the animation layer can read it
  useLayoutEffect(() => {
    if (!registry || !ref.current) return
    const entries = registry.entries.get(id)
    if (!entries) return
    const entry = entries.find((e) => e.ref === ref)
    if (entry) {
      entry.rect = ref.current.getBoundingClientRect()
    }
  })

  // Unregister on unmount
  useLayoutEffect(() => {
    return () => {
      if (registry) registry.unregister(id, ref)
    }
  }, [registry, id]) // eslint-disable-line react-hooks/exhaustive-deps

  // During a transition, if there's a peer with the same id,
  // hide this element (the animation layer renders the FLIP clone).
  const inTransition = direction !== 'stable'
  let hasPeer = false
  if (inTransition && registry) {
    const entries = registry.entries.get(id)
    if (entries && entries.length > 1) {
      hasPeer = true
    }
  }
  const shouldHide = inTransition && hasPeer

  return (
    <div
      ref={ref}
      style={{ visibility: shouldHide ? 'hidden' : 'visible' }}
      data-shared-id={id}
    >
      {children}
    </div>
  )
}

/**
 * Animation layer rendered above the TransitionSeries. During transitions,
 * for each Shared id that has both an entering and exiting copy, it renders
 * the children at an interpolated position using FLIP transforms.
 *
 * Uses the composition root ref for coordinate normalization (converting
 * viewport-relative getBoundingClientRect to composition-relative coords).
 */
export function SharedAnimationLayer() {
  const registry = useContext(SharedRegistryContext)
  const frame = useCurrentFrame()

  if (!registry) return null

  const pairs: Array<{
    id: string
    exitingEntry: SharedEntry
    enteringEntry: SharedEntry
  }> = []

  for (const [id, entries] of registry.entries) {
    if (entries.length < 2) continue
    const exiting = entries.find((e) => e.direction === 'exiting')
    const entering = entries.find((e) => e.direction === 'entering')
    if (exiting && entering) {
      pairs.push({ id, exitingEntry: exiting, enteringEntry: entering })
    }
  }

  if (pairs.length === 0) return null

  // Get root rect for coordinate normalization
  const rootRect = registry.rootRef.current?.getBoundingClientRect()
  if (!rootRect) return null

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {pairs.map(({ id, exitingEntry, enteringEntry }) => (
        <SharedFlipElement
          key={id}
          exitingEntry={exitingEntry}
          enteringEntry={enteringEntry}
          rootRect={rootRect}
        />
      ))}
    </AbsoluteFill>
  )
}

/**
 * Single FLIP-animated element. Reads rects from the exiting and entering
 * Shared entries and renders the exiting entry's children at an interpolated
 * position. Uses the entering transition progress (0→1) as the animation
 * driver.
 */
function SharedFlipElement({
  exitingEntry,
  enteringEntry,
  rootRect,
}: {
  exitingEntry: SharedEntry
  enteringEntry: SharedEntry
  rootRect: DOMRect
}) {
  const { entering } = useTransitionProgress()
  const progress = entering // 0→1 during the transition

  const exitRect = exitingEntry.rect
  const enterRect = enteringEntry.rect

  if (!exitRect || !enterRect) {
    // Rects not measured yet (first frame). Render nothing; next frame
    // useLayoutEffect will have populated them.
    return null
  }

  // Normalize rects to composition-relative coordinates
  const ex = exitRect.x - rootRect.x
  const ey = exitRect.y - rootRect.y
  const ew = exitRect.width
  const eh = exitRect.height

  const nx = enterRect.x - rootRect.x
  const ny = enterRect.y - rootRect.y
  const nw = enterRect.width
  const nh = enterRect.height

  // Interpolate position and size
  const x = interpolate(progress, [0, 1], [ex, nx])
  const y = interpolate(progress, [0, 1], [ey, ny])
  const w = interpolate(progress, [0, 1], [ew, nw])
  const h = interpolate(progress, [0, 1], [eh, nh])

  // Use the exiting entry's children as the visual during the transition.
  // This ensures continuity: the element you see moving IS the one from
  // the section you're leaving.
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        overflow: 'hidden',
      }}
    >
      {exitingEntry.children}
    </div>
  )
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
  Audio,
  Video,
}
