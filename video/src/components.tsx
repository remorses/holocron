'use client'

/**
 * Adapted remocn components for the Holocron video presentation.
 * Ported from https://github.com/kapishdima/remocn registry components.
 * All components use dark theme by default to match the Apple keynote aesthetic.
 *
 * Must be 'use client' because they use Remotion hooks (useCurrentFrame,
 * useVideoConfig, spring, interpolate) which only work inside the Player
 * render context on the client.
 */

import type { ReactNode } from 'react'
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const FONT_SANS =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif'
const FONT_MONO =
  '"SF Mono", ui-monospace, SFMono-Regular, "Cascadia Code", monospace'

// ---------------------------------------------------------------------------
// MeshGradientBg
// ---------------------------------------------------------------------------

export interface MeshGradientBgProps {
  colors?: string[]
  speed?: number
  background?: string
  blur?: number
}

export function MeshGradientBg({
  colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#3b82f6'],
  speed = 0.4,
  background = '#050505',
  blur = 100,
}: MeshGradientBgProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = (frame / fps) * speed

  const blobs = colors.map((color, i) => {
    const phase = i * 1.7
    const sx = Math.sin(t * Math.PI + phase)
    const cy = Math.cos(t * Math.PI * 1.3 + phase)
    const sx2 = Math.sin(t * Math.PI * 0.7 * (2 / 3) + phase * 0.5)
    const left = 50 + sx * 25
    const top = 50 + cy * 25
    const scale = 1 + sx2 * 0.2
    return { color, left, top, scale, key: `blob-${i}` }
  })

  return (
    <AbsoluteFill style={{ background, overflow: 'hidden' }}>
      {blobs.map((b) => (
        <div
          key={b.key}
          style={{
            position: 'absolute',
            left: `${b.left}%`,
            top: `${b.top}%`,
            width: '55%',
            height: '55%',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${b.color} 0%, ${b.color}00 70%)`,
            filter: `blur(${blur}px)`,
            mixBlendMode: 'screen',
            transform: `translate(-50%, -50%) scale(${b.scale})`,
            opacity: 0.6,
          }}
        />
      ))}
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// BlurReveal — text fades in from blurred to sharp
// ---------------------------------------------------------------------------

export interface BlurRevealProps {
  text: string
  blur?: number
  fontSize?: number
  color?: string
  fontWeight?: number
  /** Duration of the reveal in frames (defaults to 60% of composition) */
  revealFrames?: number
}

export function BlurReveal({
  text,
  blur = 20,
  fontSize = 96,
  color = '#fafafa',
  fontWeight = 700,
  revealFrames,
}: BlurRevealProps) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const dur = revealFrames ?? durationInFrames * 0.6

  const opacity = interpolate(frame, [0, dur], [0, 1], {
    extrapolateRight: 'clamp',
  })
  const blurAmount = interpolate(frame, [0, dur], [blur, 0], {
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <span
        style={{
          opacity,
          filter: `blur(${blurAmount}px)`,
          fontSize,
          fontWeight,
          color,
          letterSpacing: '-0.04em',
          fontFamily: FONT_SANS,
        }}
      >
        {text}
      </span>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// MaskedSlideReveal — words slide up from behind a mask
// ---------------------------------------------------------------------------

export interface MaskedSlideRevealProps {
  text: string
  staggerDelay?: number
  fontSize?: number
  color?: string
  fontWeight?: number
}

export function MaskedSlideReveal({
  text,
  staggerDelay = 3,
  fontSize = 56,
  color = '#fafafa',
  fontWeight = 600,
}: MaskedSlideRevealProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const words = text.split(' ')

  return (
    <AbsoluteFill
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <span
        style={{
          fontSize,
          fontWeight,
          color,
          letterSpacing: '-0.03em',
          fontFamily: FONT_SANS,
        }}
      >
        {words.map((word, i) => {
          const t = spring({
            frame: frame - i * staggerDelay,
            fps,
            config: { damping: 14 },
          })
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                overflow: 'hidden',
                verticalAlign: 'bottom',
                lineHeight: 1.1,
                marginRight: '0.25em',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  transform: `translateY(${(1 - t) * 100}%)`,
                }}
              >
                {word}
              </span>
            </span>
          )
        })}
      </span>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// StaggeredFadeUp
// ---------------------------------------------------------------------------

export interface StaggeredFadeUpProps {
  text: string
  staggerDelay?: number
  distance?: number
  fontSize?: number
  color?: string
  fontWeight?: number
}

export function StaggeredFadeUp({
  text,
  staggerDelay = 4,
  distance = 24,
  fontSize = 48,
  color = '#a1a1aa',
  fontWeight = 400,
}: StaggeredFadeUpProps) {
  const frame = useCurrentFrame()
  const words = text.split(' ')

  return (
    <AbsoluteFill
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <span
        style={{
          fontSize,
          fontWeight,
          color,
          letterSpacing: '-0.02em',
          fontFamily: FONT_SANS,
        }}
      >
        {words.map((word, i) => {
          const local = frame - i * staggerDelay
          const opacity = interpolate(local, [0, 14], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
          const y = interpolate(local, [0, 14], [distance, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                marginRight: '0.25em',
                opacity,
                transform: `translateY(${y}px)`,
              }}
            >
              {word}
            </span>
          )
        })}
      </span>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// TerminalSimulator
// ---------------------------------------------------------------------------

export type TerminalLineType = 'command' | 'log' | 'success' | 'error' | 'dim'

export interface TerminalLine {
  text: string
  type: TerminalLineType
  delay?: number
  pause?: number
}

export interface TerminalSimulatorProps {
  lines: TerminalLine[]
  prompt?: string
  title?: string
  width?: number
  height?: number
  fontSize?: number
  charsPerFrame?: number
  chunkSize?: number
}

const TERM_COLORS: Record<TerminalLineType, string> = {
  command: '#fafafa',
  log: '#a1a1aa',
  success: '#34d399',
  error: '#f87171',
  dim: '#52525b',
}

function autoPause(line: TerminalLine): number {
  if (line.pause !== undefined) return line.pause
  if (line.text.trimEnd().endsWith('...')) return 18
  return 0
}

export function TerminalSimulator({
  lines,
  prompt = '$',
  title = '~/holocron',
  width = 880,
  height = 460,
  fontSize = 17,
  charsPerFrame = 1.2,
  chunkSize = 2,
}: TerminalSimulatorProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const lineHeight = Math.round(fontSize * 1.6)
  const visibleLines = Math.floor((height - 60) / lineHeight)

  const starts: number[] = []
  let acc = 8
  for (let i = 0; i < lines.length; i++) {
    const delay = lines[i].delay ?? 6
    acc += delay
    starts.push(acc)
    // Must match TermLine's interpolation range: [0, totalChars / charsPerFrame]
    const typingFrames = Math.ceil(lines[i].text.length / charsPerFrame)
    acc += typingFrames + autoPause(lines[i])
  }

  let translateY = 0
  for (let i = visibleLines; i < lines.length; i++) {
    if (frame >= starts[i]) translateY -= lineHeight
  }

  // Entry animation for the whole window
  const windowScale = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80 },
  })
  const windowOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        style={{
          width,
          height,
          background: '#0a0a0a',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow:
            '0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: FONT_MONO,
          transform: `scale(${windowScale})`,
          opacity: windowOpacity,
        }}
      >
        {/* Chrome bar */}
        <div
          style={{
            height: 40,
            background: '#141414',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: 8,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <TrafficLight color="#ff5f57" />
          <TrafficLight color="#febc2e" />
          <TrafficLight color="#28c840" />
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              color: '#52525b',
              fontSize: 13,
            }}
          >
            {title}
          </div>
        </div>

        {/* Terminal content */}
        <div style={{ flex: 1, padding: 20, overflow: 'hidden', position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              left: 20,
              right: 20,
              top: 20,
              transform: `translateY(${translateY}px)`,
            }}
          >
            {lines.map((line, index) => (
              <Sequence key={index} from={starts[index]} layout="none">
                <TermLine
                  line={line}
                  prompt={prompt}
                  fontSize={fontSize}
                  lineHeight={lineHeight}
                  charsPerFrame={charsPerFrame}
                  chunkSize={chunkSize}
                  fps={fps}
                />
              </Sequence>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}

function TrafficLight({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: color,
        opacity: 0.5,
      }}
    />
  )
}

function TermLine({
  line,
  prompt,
  fontSize,
  lineHeight,
  charsPerFrame,
  chunkSize,
  fps,
}: {
  line: TerminalLine
  prompt: string
  fontSize: number
  lineHeight: number
  charsPerFrame: number
  chunkSize: number
  fps: number
}) {
  const localFrame = useCurrentFrame()
  const totalChars = line.text.length

  // Empty lines (spacers) have 0 chars; skip interpolation to avoid [0,0] inputRange error
  const revealed = totalChars === 0
    ? 0
    : Math.min(
        totalChars,
        Math.ceil(
          Math.floor(
            interpolate(localFrame, [0, totalChars / charsPerFrame], [0, totalChars], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          ) / chunkSize,
        ) * chunkSize,
      )
  const visible = line.text.substring(0, revealed)
  const typingDone = revealed >= totalChars
  const cursorVisible = Math.floor((localFrame / fps) * 2) % 2 === 0

  return (
    <div
      style={{
        height: lineHeight,
        fontSize,
        color: TERM_COLORS[line.type],
        display: 'flex',
        alignItems: 'center',
        whiteSpace: 'pre',
      }}
    >
      {line.type === 'command' && (
        <span style={{ color: '#34d399', marginRight: 8 }}>{prompt}</span>
      )}
      <span>{visible}</span>
      {line.type === 'command' && !typingDone && cursorVisible && (
        <span
          style={{
            display: 'inline-block',
            width: fontSize * 0.55,
            height: fontSize,
            background: '#fafafa',
            marginLeft: 2,
            opacity: 0.8,
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// GlassCodeBlock — frosted glass editor window
// ---------------------------------------------------------------------------

export interface GlassCodeBlockProps {
  code: string
  title?: string
  width?: number
  height?: number
  fontSize?: number
  staggerFrames?: number
}

const KEYWORDS = new Set([
  'import',
  'from',
  'export',
  'function',
  'const',
  'let',
  'var',
  'return',
  'if',
  'else',
  'true',
  'false',
  'null',
  'undefined',
  'default',
  'new',
])

type Token = {
  text: string
  kind: 'code' | 'comment' | 'string' | 'keyword' | 'number' | 'property'
}

function tokenizeLine(line: string): Token[] {
  const trimmed = line.trimStart()
  if (trimmed.startsWith('//'))
    return [{ text: line, kind: 'comment' }]

  const tokens: Token[] = []
  const re =
    /("[^"]*"|'[^']*'|`[^`]*`|\b\d+\b|\b[A-Za-z_$][\w$]*\b|[^\w"'`]+)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(line)) !== null) {
    const t = match[0]
    const first = t[0]
    if (first === '"' || first === "'" || first === '`') {
      tokens.push({ text: t, kind: 'string' })
    } else if (/^\d+$/.test(t)) {
      tokens.push({ text: t, kind: 'number' })
    } else if (/^[A-Za-z_$][\w$]*$/.test(t) && KEYWORDS.has(t)) {
      tokens.push({ text: t, kind: 'keyword' })
    } else {
      tokens.push({ text: t, kind: 'code' })
    }
  }
  return tokens
}

const TOKEN_COLORS: Record<Token['kind'], string> = {
  code: '#e4e4e7',
  comment: '#52525b',
  string: '#86efac',
  keyword: '#c4b5fd',
  number: '#fcd34d',
  property: '#93c5fd',
}

export function GlassCodeBlock({
  code,
  title = 'docs.json',
  width = 780,
  height = 440,
  fontSize = 16,
  staggerFrames = 3,
}: GlassCodeBlockProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const lines = code.split('\n')

  const windowScale = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80 },
  })
  const windowOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Aura behind the glass */}
      <BackdropAura />

      {/* 1px gradient ring */}
      <div
        style={{
          position: 'relative',
          padding: 1,
          borderRadius: 16,
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%)',
          width,
          height,
          boxShadow: '0 50px 120px rgba(0,0,0,0.55)',
          transform: `scale(${windowScale})`,
          opacity: windowOpacity,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 15,
            background: 'rgba(10, 10, 10, 0.65)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: FONT_MONO,
          }}
        >
          {/* Chrome */}
          <div
            style={{
              height: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <TrafficLight color="#ff5f57" />
            <TrafficLight color="#febc2e" />
            <TrafficLight color="#28c840" />
            <div
              style={{
                flex: 1,
                textAlign: 'center',
                color: '#71717a',
                fontSize: 12,
                letterSpacing: '0.02em',
              }}
            >
              {title}
            </div>
          </div>

          {/* Code body */}
          <div
            style={{
              flex: 1,
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              fontSize,
              lineHeight: 1.55,
            }}
          >
            {lines.map((line, i) => (
              <Sequence key={i} from={i * staggerFrames} layout="none">
                <CodeLine line={line} index={i} fontSize={fontSize} />
              </Sequence>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}

function CodeLine({ line, index, fontSize }: { line: string; index: number; fontSize: number }) {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const ty = interpolate(frame, [0, 8], [4, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const tokens = tokenizeLine(line)
  if (tokens.length === 0) {
    return <div style={{ height: fontSize * 0.8, opacity }} />
  }

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${ty}px)`,
        whiteSpace: 'pre',
        display: 'flex',
        gap: 0,
      }}
    >
      <span style={{ width: 28, color: '#3f3f46', userSelect: 'none' }}>
        {String(index + 1).padStart(2, ' ')}
      </span>
      <span>
        {tokens.map((t, i) => (
          <span key={i} style={{ color: TOKEN_COLORS[t.kind] }}>
            {t.text}
          </span>
        ))}
      </span>
    </div>
  )
}

function BackdropAura() {
  const frame = useCurrentFrame()
  const t = frame / 60
  const x = 50 + Math.sin(t) * 20
  const y = 50 + Math.cos(t * 0.7) * 15
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: `radial-gradient(circle at ${x}% ${y}%, rgba(99,102,241,0.2), transparent 50%), radial-gradient(circle at ${100 - x}% ${100 - y}%, rgba(6,182,212,0.15), transparent 55%)`,
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// ShimmerSweep — light sweep across text
// ---------------------------------------------------------------------------

export interface ShimmerSweepProps {
  text: string
  baseColor?: string
  shineColor?: string
  fontSize?: number
  fontWeight?: number
}

export function ShimmerSweep({
  text,
  baseColor = '#52525b',
  shineColor = '#fafafa',
  fontSize = 72,
  fontWeight = 700,
}: ShimmerSweepProps) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  const position = interpolate(
    frame,
    [0, durationInFrames * 0.75],
    [200, -100],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )

  const textStyle: React.CSSProperties = {
    fontSize,
    fontWeight,
    letterSpacing: '-0.04em',
    fontFamily: FONT_SANS,
    margin: 0,
    lineHeight: 1,
  }

  return (
    <AbsoluteFill
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <span style={{ ...textStyle, color: baseColor }}>{text}</span>
        <span
          style={{
            ...textStyle,
            position: 'absolute',
            inset: 0,
            color: 'transparent',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            backgroundImage: `linear-gradient(110deg, transparent 30%, ${shineColor} 50%, transparent 70%)`,
            backgroundSize: '200% 100%',
            backgroundPosition: `${position}% 50%`,
          }}
        >
          {text}
        </span>
      </div>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// SpringPopIn — elastic scale entrance
// ---------------------------------------------------------------------------

export interface SpringPopInProps {
  children: ReactNode
  damping?: number
  stiffness?: number
  delayInFrames?: number
}

export function SpringPopIn({
  children,
  damping = 14,
  stiffness = 90,
  delayInFrames = 0,
}: SpringPopInProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const scale = spring({
    fps,
    frame: frame - delayInFrames,
    config: { damping, stiffness },
  })

  return (
    <AbsoluteFill
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center',
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// FadeTransition — crossfade wrapper
// ---------------------------------------------------------------------------

export function FadeIn({ children, durationFrames = 12 }: { children: ReactNode; durationFrames?: number }) {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, durationFrames], [0, 1], {
    extrapolateRight: 'clamp',
  })
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
}

export function FadeOut({
  children,
  durationFrames = 12,
  startFrame,
}: {
  children: ReactNode
  durationFrames?: number
  startFrame: number
}) {
  const frame = useCurrentFrame()
  const opacity = interpolate(
    frame,
    [startFrame, startFrame + durationFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
}

// ---------------------------------------------------------------------------
// FeaturePill — rounded badge for feature grid
// ---------------------------------------------------------------------------

export function FeaturePill({
  label,
  index,
  icon,
}: {
  label: string
  index: number
  icon?: string
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const scale = spring({
    frame: frame - index * 4,
    fps,
    config: { damping: 16, stiffness: 100 },
  })
  const opacity = interpolate(frame - index * 4, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        opacity,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: '16px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontFamily: FONT_SANS,
      }}
    >
      {icon && <span style={{ fontSize: 24 }}>{icon}</span>}
      <span
        style={{
          fontSize: 20,
          fontWeight: 500,
          color: '#e4e4e7',
          letterSpacing: '-0.01em',
        }}
      >
        {label}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AnimatedChart — Bklit-style line chart with animated crosshair + tooltip
// Driven by useCurrentFrame() instead of mouse hover.
// ---------------------------------------------------------------------------

const CHART_DATA = [
  { label: 'Jan', users: 120, pageviews: 340 },
  { label: 'Feb', users: 180, pageviews: 420 },
  { label: 'Mar', users: 240, pageviews: 580 },
  { label: 'Apr', users: 310, pageviews: 720 },
  { label: 'May', users: 420, pageviews: 890 },
  { label: 'Jun', users: 580, pageviews: 1240 },
  { label: 'Jul', users: 720, pageviews: 1580 },
  { label: 'Aug', users: 890, pageviews: 1920 },
  { label: 'Sep', users: 1050, pageviews: 2340 },
  { label: 'Oct', users: 1280, pageviews: 2780 },
  { label: 'Nov', users: 1520, pageviews: 3200 },
  { label: 'Dec', users: 1840, pageviews: 3650 },
]

export interface AnimatedChartProps {
  width?: number
  height?: number
  /** Speed of cursor sweep across chart (0-1 per frame fraction) */
  sweepDuration?: number
}

export function AnimatedChart({
  width = 780,
  height = 420,
  sweepDuration = 120,
}: AnimatedChartProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const pad = { top: 40, right: 30, bottom: 50, left: 60 }
  const chartW = width - pad.left - pad.right
  const chartH = height - pad.top - pad.bottom

  const maxVal = Math.max(...CHART_DATA.map((d) => d.pageviews))
  const points = CHART_DATA.map((d, i) => ({
    ...d,
    x: pad.left + (i / (CHART_DATA.length - 1)) * chartW,
    yUsers: pad.top + chartH - (d.users / maxVal) * chartH,
    yPageviews: pad.top + chartH - (d.pageviews / maxVal) * chartH,
  }))

  // Crosshair sweeps from left to right, then pauses at ~75%
  const entryDelay = 20
  const sweepProgress = interpolate(
    frame - entryDelay,
    [0, sweepDuration],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )
  const crosshairX = pad.left + sweepProgress * chartW

  // Find nearest data point for tooltip
  const nearestIdx = Math.min(
    CHART_DATA.length - 1,
    Math.max(0, Math.round(sweepProgress * (CHART_DATA.length - 1))),
  )
  const nearest = points[nearestIdx]

  // Chart entry animation
  const chartScale = spring({ frame, fps, config: { damping: 20, stiffness: 80 } })
  const chartOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' })

  // Line draw animation
  const lineProgress = interpolate(frame, [5, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Build SVG path for a data series
  const buildPath = (key: 'yUsers' | 'yPageviews') => {
    const visibleCount = Math.ceil(lineProgress * points.length)
    const visible = points.slice(0, visibleCount)
    if (visible.length < 2) return ''
    return visible.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p[key]}`).join(' ')
  }

  // Tooltip visibility
  const tooltipOpacity = interpolate(
    frame - entryDelay,
    [0, 8],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )

  // Crosshair fade (top and bottom)
  const fadeId = `crosshair-fade-${Math.random().toString(36).slice(2, 6)}`

  return (
    <AbsoluteFill
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        style={{
          width,
          height,
          background: 'rgba(10, 10, 10, 0.65)',
          backdropFilter: 'blur(20px)',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
          transform: `scale(${chartScale})`,
          opacity: chartOpacity,
          position: 'relative',
        }}
      >
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <linearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity="0" />
              <stop offset="10%" stopColor="white" stopOpacity="1" />
              <stop offset="90%" stopColor="white" stopOpacity="1" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <mask id={`${fadeId}-mask`}>
              <rect x="0" y={pad.top} width={width} height={chartH} fill={`url(#${fadeId})`} />
            </mask>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const y = pad.top + (1 - frac) * chartH
            return (
              <line
                key={frac}
                x1={pad.left}
                y1={y}
                x2={pad.left + chartW}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
            )
          })}

          {/* X-axis labels */}
          {points.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={height - 16}
              fill="#52525b"
              fontSize={11}
              textAnchor="middle"
              fontFamily={FONT_MONO}
            >
              {p.label}
            </text>
          ))}

          {/* Line: pageviews */}
          <path
            d={buildPath('yPageviews')}
            fill="none"
            stroke="#6366f1"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Line: users */}
          <path
            d={buildPath('yUsers')}
            fill="none"
            stroke="#06b6d4"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Crosshair */}
          {frame > entryDelay && (
            <line
              x1={crosshairX}
              y1={pad.top}
              x2={crosshairX}
              y2={pad.top + chartH}
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={1}
              mask={`url(#${fadeId}-mask)`}
            />
          )}

          {/* Dots on nearest point */}
          {frame > entryDelay && (
            <>
              <circle cx={nearest.x} cy={nearest.yPageviews} r={5} fill="#6366f1" opacity={tooltipOpacity} />
              <circle cx={nearest.x} cy={nearest.yPageviews} r={8} fill="#6366f1" opacity={tooltipOpacity * 0.3} />
              <circle cx={nearest.x} cy={nearest.yUsers} r={5} fill="#06b6d4" opacity={tooltipOpacity} />
              <circle cx={nearest.x} cy={nearest.yUsers} r={8} fill="#06b6d4" opacity={tooltipOpacity * 0.3} />
            </>
          )}
        </svg>

        {/* Tooltip panel */}
        {frame > entryDelay && (
          <div
            style={{
              position: 'absolute',
              left: nearest.x + (nearest.x > width / 2 ? -170 : 16),
              top: Math.min(nearest.yPageviews, nearest.yUsers) - 10,
              opacity: tooltipOpacity,
              background: 'rgba(24, 24, 27, 0.9)',
              backdropFilter: 'blur(12px)',
              borderRadius: 10,
              padding: '12px 16px',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              minWidth: 150,
              transform: `scale(${interpolate(frame - entryDelay, [0, 12], [0.9, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
            }}
          >
            <div style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 8, fontFamily: FONT_SANS }}>
              {nearest.label} 2024
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }} />
              <span style={{ fontSize: 13, color: '#a1a1aa', fontFamily: FONT_SANS }}>Page Views</span>
              <span style={{ fontSize: 13, color: '#e4e4e7', fontWeight: 600, marginLeft: 'auto', fontFamily: FONT_MONO }}>
                {nearest.pageviews.toLocaleString()}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#06b6d4' }} />
              <span style={{ fontSize: 13, color: '#a1a1aa', fontFamily: FONT_SANS }}>Users</span>
              <span style={{ fontSize: 13, color: '#e4e4e7', fontWeight: 600, marginLeft: 'auto', fontFamily: FONT_MONO }}>
                {nearest.users.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  )
}
