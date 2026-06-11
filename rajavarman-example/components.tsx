'use client'

/**
 * Custom components for the rajavarman ChatGPT promo video recreation.
 *
 * Animation philosophy (Emil Kowalski / animations.dev):
 * - Springs everywhere. No linear interpolate for motion. Springs feel physical.
 * - Never scale from 0. Start from 0.96+ with opacity for natural entrances.
 * - Small translateY (8-12px). Large distances feel floaty and artificial.
 * - Short stagger delays (~2-3 frames = 66-100ms at 30fps).
 * - Use damping/stiffness to control feel: low damping = bouncy, high = snappy.
 *
 * Two Google Fonts: Inter (sans) and Permanent Marker (brush).
 * All motion uses Remotion spring() (no CSS transitions allowed in web-renderer).
 *
 * Subpixel rendering fix (remotion.dev/docs/troubleshooting/subpixel-rendering):
 * Chrome snaps text to whole pixels by default, causing visible stuttering on slow
 * movements. Adding `perspective(1000px)` to transforms + `willChange: 'transform'`
 * forces Chrome into a GPU compositing path that preserves subpixel positions.
 * Subpixel fix is handled at the section container level in player-page.tsx.
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
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadPermanentMarker } from '@remotion/google-fonts/PermanentMarker'

const { fontFamily: FONT_SANS } = loadInter()
const { fontFamily: FONT_BRUSH } = loadPermanentMarker()

const LIGHT_BG = '#e8e8e8'
const DARK_BG = '#000000'
const BLUE = '#3478f6'

// Aggressive spring configs: high stiffness = fast snap, low damping = visible overshoot
const SPRING_ENTER = { damping: 12, stiffness: 200 } // fast snap with noticeable overshoot
const SPRING_SOFT = { damping: 14, stiffness: 160 }  // still punchy, slight settle
const SPRING_POP = { damping: 10, stiffness: 250 }   // bouncy pop, dramatic overshoot


// ---------------------------------------------------------------------------
// useSpringOpacity — opacity driven by spring (starts at 0, settles at 1)
// ---------------------------------------------------------------------------

function useSpringOpacity(delay = 0, config = SPRING_ENTER) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - delay, fps, config })
}

// ---------------------------------------------------------------------------
// StaggeredColorWords — words spring in with stagger, one word highlighted
// ---------------------------------------------------------------------------

export function StaggeredColorWords({
  words,
  highlightIndex = -1,
  highlightColor = BLUE,
  fontSize = 64,
  staggerDelay = 3,
}: {
  words: string[]
  highlightIndex?: number
  highlightColor?: string
  fontSize?: number
  staggerDelay?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
        {words.map((word, i) => {
          const delay = i * staggerDelay
          const s = spring({
            frame: frame - delay,
            fps,
            config: SPRING_ENTER,
          })
          // Color spring: highlight word transitions from color to dark
          const colorS = spring({
            frame: frame - 18 - delay,
            fps,
            config: SPRING_SOFT,
          })
          const isHighlight = i === highlightIndex
          const color = isHighlight
            ? lerpColor(highlightColor, '#1a1a1a', colorS)
            : '#1a1a1a'

          return (
            <span
              key={i}
              style={{
                fontSize,
                fontWeight: 500,
                fontFamily: FONT_SANS,
                color,
                // Spring-driven: start at 0.96 scale + 10px down + transparent
                opacity: s,
                transform: `translateY(${(1 - s) * 100}px) scale(${0.96 + s * 0.04})`,
                display: 'inline-block',
                letterSpacing: '-0.02em',
              }}
            >
              {word}
            </span>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// PromptInputScene — "Imagine [typing prompt] anything" on dark bg
// ---------------------------------------------------------------------------

export function PromptInputScene({
  promptText = 'with just a simple prompt...',
  charsPerFrame = 0.6,
}: {
  promptText?: string
  charsPerFrame?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Spring-driven entrance for the whole scene
  const enter = spring({ frame, fps, config: SPRING_SOFT })

  // Typing animation starts after entrance settles
  const typingStart = 15
  const revealed = Math.min(
    promptText.length,
    Math.floor(Math.max(0, frame - typingStart) * charsPerFrame),
  )
  const visibleText = frame < typingStart ? '' : promptText.substring(0, revealed)
  const cursorBlink = Math.floor((frame / fps) * 2) % 2 === 0

  // Input bar springs in slightly after text
  const barS = spring({ frame: frame - 4, fps, config: SPRING_ENTER })

  return (
    <AbsoluteFill
      style={{
        background: DARK_BG,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: enter,
        minWidth: 600,
        transform: `scale(${0.97 + enter * 0.03})`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <span
          style={{
            fontSize: 52,
            fontWeight: 500,
            fontFamily: FONT_SANS,
            color: '#fafafa',
            letterSpacing: '-0.02em',
            opacity: enter,
            transform: `translateX(${(1 - enter) * -300}px)`,
          }}
        >
          Imagine
        </span>

        {/* Prompt input bar */}
        <div
          style={{
            background: '#2a2a2a',
            borderRadius: 28,
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minWidth: 480,
            border: '1px solid rgba(255,255,255,0.08)',
            opacity: barS,
            transform: `scale(${0.97 + barS * 0.03}) translateY(${(1 - barS) * 6}px)`,
          }}
        >
          <span
            style={{
              fontSize: 17,
              fontFamily: FONT_SANS,
              color: '#a1a1aa',
              whiteSpace: 'pre',
            }}
          >
            {visibleText}
          </span>
          {cursorBlink && revealed < promptText.length && (
            <span
              style={{
                display: 'inline-block',
                width: 2,
                height: 20,
                background: '#a1a1aa',
                opacity: 0.7,
              }}
            />
          )}
          <div style={{ flex: 1 }} />
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#fafafa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <path
                d="M8 12V4M8 4L4 8M8 4L12 8"
                stroke="#1a1a1a"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <span
          style={{
            fontSize: 52,
            fontWeight: 500,
            fontFamily: FONT_SANS,
            color: '#fafafa',
            letterSpacing: '-0.02em',
            opacity: enter,
            transform: `translateX(${(1 - enter) * 300}px)`,
          }}
        >
          anything
        </span>
      </div>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// JustTypeWithCards — "Just type" + four floating AI cards (dark bg)
// ---------------------------------------------------------------------------

export function JustTypeWithCards() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const textS = spring({ frame, fps, config: SPRING_SOFT })

  const cards = [
    { x: -340, y: -200, rotate: -3, label: 'Language Output', value: '10K/Day', bg: 'linear-gradient(135deg, #c04030 0%, #e8a080 100%)' },
    { x: 280, y: -160, rotate: 2, label: 'Personality Profile', value: '', bg: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2a 100%)' },
    { x: -280, y: 160, rotate: -2, label: '24% Complete', value: '24', bg: 'linear-gradient(135deg, #1a0808 0%, #2a0e0e 100%)' },
    { x: 240, y: 200, rotate: 3, label: 'Context Window', value: '3,200', bg: 'linear-gradient(135deg, #1a4a3a 0%, #40a080 100%)' },
  ]

  return (
    <AbsoluteFill style={{ background: DARK_BG }}>
      {cards.map((card, i) => {
        // Short stagger: 3 frames apart (~100ms)
        const delay = 4 + i * 3
        const s = spring({
          frame: frame - delay,
          fps,
          config: SPRING_POP, // slight overshoot makes cards feel alive
        })

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `calc(50% + ${card.x}px)`,
              top: `calc(50% + ${card.y}px)`,
              // Spring from 0.96 scale + slight offset toward center
              transform: `translate(-50%, -50%) scale(${0.96 + s * 0.04}) rotate(${card.rotate * s}deg)`,
              opacity: s,
              width: 240,
              height: 180,
              borderRadius: 20,
              background: card.bg,
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            {card.value && (
              <div
                style={{
                  fontSize: 42,
                  fontWeight: 700,
                  fontFamily: FONT_SANS,
                  color: '#fafafa',
                  letterSpacing: '-0.03em',
                }}
              >
                {card.value}
              </div>
            )}
            <div
              style={{
                fontSize: 14,
                fontFamily: FONT_SANS,
                color: 'rgba(255,255,255,0.7)',
                marginTop: 4,
              }}
            >
              {card.label}
            </div>
          </div>
        )
      })}

      {/* Center text springs in */}
      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: textS,
          transform: `scale(${0.97 + textS * 0.03})`,
        }}
      >
        <span
          style={{
            fontSize: 64,
            fontWeight: 400,
            fontFamily: FONT_SANS,
            fontStyle: 'italic',
            color: '#fafafa',
            letterSpacing: '-0.02em',
          }}
        >
          Just type
        </span>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// ColorRevealText — "It's there" with spring-driven color transition
// ---------------------------------------------------------------------------

export function ColorRevealText({
  before = "It's",
  highlight = 'there',
  after = '',
  highlightColor = BLUE,
  fontSize = 72,
}: {
  before?: string
  highlight?: string
  after?: string
  highlightColor?: string
  fontSize?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const enter = spring({ frame, fps, config: SPRING_ENTER })
  // Color transitions via a second spring, delayed
  const colorS = spring({ frame: frame - 14, fps, config: SPRING_SOFT })
  const highlightActual = lerpColor(highlightColor, '#1a1a1a', colorS)

  return (
    <AbsoluteFill
      style={{
        background: LIGHT_BG,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'baseline',
          opacity: enter,
          transform: `translateY(${(1 - enter) * 10}px) scale(${0.97 + enter * 0.03})`,
        }}
      >
        {before && (
          <span
            style={{
              fontSize,
              fontWeight: 500,
              fontFamily: FONT_SANS,
              color: '#1a1a1a',
              letterSpacing: '-0.02em',
            }}
          >
            {before}
          </span>
        )}
        <span
          style={{
            fontSize,
            fontWeight: 500,
            fontFamily: FONT_SANS,
            color: highlightActual,
            letterSpacing: '-0.02em',
          }}
        >
          {highlight}
        </span>
        {after && (
          <span
            style={{
              fontSize,
              fontWeight: 500,
              fontFamily: FONT_SANS,
              color: '#1a1a1a',
              letterSpacing: '-0.02em',
            }}
          >
            {after}
          </span>
        )}
      </div>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// ThinkingCarousel — horizontal row of colored "24 Sec Thinking..." cards
// ---------------------------------------------------------------------------

export function ThinkingCarousel() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const cards = [
    { bg: '#d4c820', accent: '#c02020' },
    { bg: '#0a6040', accent: '#34d399' },
    { bg: '#0a1929', accent: '#a3e635' },
    { bg: '#8b1a1a', accent: '#f87171' },
    { bg: '#2a1040', accent: '#c084fc' },
  ]

  // Each card springs in individually with stagger
  return (
    <AbsoluteFill
      style={{
        background: LIGHT_BG,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
        }}
      >
        {cards.map((card, i) => {
          const isFocused = i === 2
          // Stagger: 2 frames apart, starting from the outer cards
          const cardS = spring({
            frame: frame - Math.abs(i - 2) * 2,
            fps,
            config: isFocused ? SPRING_POP : SPRING_ENTER,
          })
          const cardScale = isFocused ? 1 : 0.88
          const cardOpacity = isFocused ? 1 : 0.7

          return (
            <div
              key={i}
              style={{
                width: isFocused ? 260 : 220,
                height: isFocused ? 240 : 200,
                borderRadius: 24,
                background: card.bg,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                // Spring from 0.96 scale + 8px up
                transform: `scale(${cardScale * (0.96 + cardS * 0.04)}) translateY(${(1 - cardS) * 8}px)`,
                opacity: cardOpacity * cardS,
                filter: isFocused ? undefined : `blur(${(1 - cardS) * 4 + 2}px)`,
                border: isFocused
                  ? `2px solid ${card.accent}`
                  : '1px solid rgba(255,255,255,0.1)',
                boxShadow: isFocused
                  ? '0 20px 60px rgba(0,0,0,0.3)'
                  : '0 10px 30px rgba(0,0,0,0.15)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>✦</span>
                <span style={{ fontSize: 14, color: card.accent }}>⬡</span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>≡</span>
              </div>
              <div
                style={{
                  width: '80%',
                  height: 4,
                  borderRadius: 2,
                  background: 'rgba(255,255,255,0.15)',
                  marginBottom: 16,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: '60%',
                    height: '100%',
                    borderRadius: 2,
                    background: card.accent,
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span
                  style={{
                    fontSize: isFocused ? 56 : 44,
                    fontWeight: 300,
                    fontFamily: FONT_SANS,
                    color: 'rgba(255,255,255,0.85)',
                    letterSpacing: '-0.04em',
                  }}
                >
                  24
                </span>
                <span
                  style={{
                    fontSize: isFocused ? 20 : 16,
                    fontFamily: FONT_SANS,
                    color: 'rgba(255,255,255,0.5)',
                  }}
                >
                  Sec
                </span>
              </div>
              <div
                style={{
                  fontSize: isFocused ? 22 : 18,
                  fontFamily: FONT_SANS,
                  color: 'rgba(255,255,255,0.6)',
                  marginTop: 4,
                }}
              >
                Thinking...
              </div>
              <div
                style={{
                  fontSize: isFocused ? 15 : 13,
                  fontFamily: FONT_SANS,
                  color: 'rgba(255,255,255,0.5)',
                  marginTop: 8,
                }}
              >
                Analyzing{' '}
                <span style={{ color: card.accent, fontWeight: 600 }}>Your Prompt</span>
              </div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// HighlightSentence — sentence with one word in blue, spring entrance
// ---------------------------------------------------------------------------

export function HighlightSentence({
  parts,
  fontSize = 64,
}: {
  parts: Array<{ text: string; highlight?: boolean }>
  fontSize?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const enter = spring({ frame, fps, config: SPRING_ENTER })

  return (
    <AbsoluteFill
      style={{
        background: LIGHT_BG,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          fontSize,
          fontWeight: 500,
          fontFamily: FONT_SANS,
          letterSpacing: '-0.02em',
          opacity: enter,
          transform: `translateY(${(1 - enter) * 10}px) scale(${0.97 + enter * 0.03})`,
          display: 'inline-block',
        }}
      >
        {parts.map((p, i) => (
          <span key={i} style={{ color: p.highlight ? BLUE : '#1a1a1a' }}>
            {p.text}
          </span>
        ))}
      </span>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// PhoneMockup — iPhone frame, spring-driven slide-up entrance
// ---------------------------------------------------------------------------

export function PhoneMockup({
  children,
  bgColor = LIGHT_BG,
  tilt = 0,
}: {
  children?: ReactNode
  bgColor?: string
  tilt?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Spring for vertical entrance: 12px up, settles to 0
  const s = spring({ frame, fps, config: SPRING_SOFT })

  return (
    <AbsoluteFill
      style={{
        background: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 380,
          height: 780,
          borderRadius: 48,
          background: '#1a1a1a',
          padding: 10,
          boxShadow: '0 40px 100px rgba(0,0,0,0.3)',
          // Spring from 12px below + 0.97 scale, not 100px (too floaty)
          transform: `translateY(${(1 - s) * 12}px) rotate(${tilt}deg) scale(${0.97 + s * 0.03})`,
          opacity: s,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 38,
            overflow: 'hidden',
            background: '#000',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 120,
              height: 32,
              borderRadius: 20,
              background: '#000',
            }}
          />
          {children}
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// FitnessScreen — Apple Fitness summary mockup
// ---------------------------------------------------------------------------

export function FitnessScreen() {
  return (
    <PhoneMockup bgColor={LIGHT_BG} tilt={-3}>
      <div
        style={{
          padding: '60px 24px 24px',
          color: '#fafafa',
          fontFamily: FONT_SANS,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          height: '100%',
        }}
      >
        <div style={{ fontSize: 12, color: '#a1a1aa', letterSpacing: '0.05em' }}>
          MONDAY, JUN 12
        </div>
        <div style={{ fontSize: 32, fontWeight: 700 }}>Summary</div>
        <div style={{ fontSize: 20, fontWeight: 600, marginTop: 8 }}>Activity</div>
        <div
          style={{
            background: '#1a1a1a',
            borderRadius: 16,
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, color: '#a1a1aa' }}>Move</div>
              <div style={{ fontSize: 16, color: '#ff375f', fontWeight: 600 }}>
                605/600<span style={{ fontSize: 11 }}>CAL</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#a1a1aa' }}>Exercise</div>
              <div style={{ fontSize: 16, color: '#30d158', fontWeight: 600 }}>
                42/30<span style={{ fontSize: 11 }}>MIN</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#a1a1aa' }}>Stand</div>
              <div style={{ fontSize: 16, color: '#40e0d0', fontWeight: 600 }}>
                10/6<span style={{ fontSize: 11 }}>HRS</span>
              </div>
            </div>
          </div>
          <svg width={120} height={120} viewBox="0 0 120 120">
            <circle cx={60} cy={60} r={50} fill="none" stroke="#3a1020" strokeWidth={12} />
            <circle cx={60} cy={60} r={50} fill="none" stroke="#ff375f" strokeWidth={12} strokeLinecap="round" strokeDasharray={`${Math.PI * 100} ${Math.PI * 100}`} transform="rotate(-90 60 60)" />
            <circle cx={60} cy={60} r={36} fill="none" stroke="#0a2a10" strokeWidth={12} />
            <circle cx={60} cy={60} r={36} fill="none" stroke="#30d158" strokeWidth={12} strokeLinecap="round" strokeDasharray={`${Math.PI * 72 * 1.4} ${Math.PI * 72}`} transform="rotate(-90 60 60)" />
            <circle cx={60} cy={60} r={22} fill="none" stroke="#0a2020" strokeWidth={12} />
            <circle cx={60} cy={60} r={22} fill="none" stroke="#40e0d0" strokeWidth={12} strokeLinecap="round" strokeDasharray={`${Math.PI * 44 * 1.6} ${Math.PI * 44}`} transform="rotate(-90 60 60)" />
          </svg>
        </div>
      </div>
    </PhoneMockup>
  )
}

// ---------------------------------------------------------------------------
// PhotosScreen — photo grid mockup inside phone
// ---------------------------------------------------------------------------

export function PhotosScreen() {
  const colors = [
    '#6a4a30', '#2080a0', '#30a080',
    '#4090c0', '#c08040', '#605040',
    '#3060a0', '#a06030', '#508040',
  ]

  return (
    <PhoneMockup bgColor={DARK_BG}>
      <div
        style={{
          padding: '60px 0 0',
          fontFamily: FONT_SANS,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0 24px 8px',
            fontSize: 14,
            fontWeight: 600,
            color: '#1a1a1a',
          }}
        >
          <span>1:47</span>
          <span style={{ fontSize: 12 }}>⦿⦿⦿</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0 24px 12px',
            alignItems: 'center',
          }}
        >
          <div style={{ width: 40 }} />
          <span style={{ fontSize: 17, fontWeight: 600, color: '#1a1a1a' }}>All Photos</span>
          <span style={{ fontSize: 16, color: BLUE }}>Select</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 2,
            flex: 1,
            background: '#fff',
          }}
        >
          {colors.map((c, i) => (
            <div key={i} style={{ background: c, aspectRatio: '1' }} />
          ))}
        </div>
      </div>
    </PhoneMockup>
  )
}

// ---------------------------------------------------------------------------
// BrushText — Permanent Marker text with spring pop entrance
// ---------------------------------------------------------------------------

export function BrushText({
  text,
  fontSize = 72,
  color = '#1a1a1a',
  showLogo = false,
}: {
  text: string
  fontSize?: number
  color?: string
  showLogo?: boolean
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Pop spring: slight overshoot for personality
  const s = spring({ frame, fps, config: SPRING_POP })

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          // Start at 0.96, spring to 1 with slight overshoot
          transform: `scale(${0.96 + s * 0.04})`,
          opacity: s,
        }}
      >
        {showLogo && (
          <svg width={48} height={48} viewBox="0 0 48 48" fill="none">
            <circle cx={24} cy={24} r={20} stroke={color} strokeWidth={2.5} fill="none" />
            <path
              d="M16 28c0-4 4-8 8-8s8 4 8 8M16 20c0 4 4 8 8 8s8-4 8-8"
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        )}
        <span
          style={{
            fontSize,
            fontFamily: FONT_BRUSH,
            color,
            letterSpacing: '-0.02em',
          }}
        >
          {text}
        </span>
      </div>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lerpColor(from: string, to: string, t: number): string {
  const f = hexToRgb(from)
  const t2 = hexToRgb(to)
  if (!f || !t2) return from
  const r = Math.round(f.r + (t2.r - f.r) * t)
  const g = Math.round(f.g + (t2.g - f.g) * t)
  const b = Math.round(f.b + (t2.b - f.b) * t)
  return `rgb(${r},${g},${b})`
}

function hexToRgb(hex: string) {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return null
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}
