/**
 * Main Holocron video composition. Apple-style keynote presentation
 * showcasing what Holocron does: MDX docs, CLI, deploy, features.
 *
 * 1920x1080 @ 30fps, ~35 seconds total.
 * Uses adapted remocn components from ./components.tsx.
 */

import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import {
  AnimatedChart,
  FeaturePill,
  GlassCodeBlock,
  MeshGradientBg,
  ShimmerSweep,
  TerminalSimulator,
  type TerminalLine,
} from './components'
import { spring } from 'remotion'

// ---------------------------------------------------------------------------
// Scene timing (frames at 30fps)
// ---------------------------------------------------------------------------

const SCENE = {
  // Scene 1: Logo + title reveal
  opening: { from: 0, duration: 100 },
  // Scene 2: Subtitle tagline (overlaps opening for crossfade)
  tagline: { from: 80, duration: 85 },
  // Scene 3: Terminal — create a project (start earlier to avoid black gap)
  terminalCreate: { from: 155, duration: 285 },
  // Scene 4: docs.json config in glass editor
  codeConfig: { from: 430, duration: 200 },
  // Scene 5: Feature grid
  features: { from: 620, duration: 160 },
  // Scene 6: Analytics chart with animated tooltip
  analytics: { from: 770, duration: 180 },
  // Scene 7: Terminal — deploy
  terminalDeploy: { from: 940, duration: 200 },
  // Scene 8: Closing with URL
  closing: { from: 1130, duration: 100 },
} as const

// ---------------------------------------------------------------------------
// Terminal lines data
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

// Shortened to fit in the glass code block without clipping
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

// ---------------------------------------------------------------------------
// Feature data
// ---------------------------------------------------------------------------

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
// Sub-scenes
// ---------------------------------------------------------------------------

function SceneOpening() {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )

  // Blur reveal animation for "Holocron"
  const revealDur = 50
  const textOpacity = interpolate(frame, [0, revealDur], [0, 1], {
    extrapolateRight: 'clamp',
  })
  const blurAmount = interpolate(frame, [0, revealDur], [24, 0], {
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <MeshGradientBg
        colors={['#6366f1', '#8b5cf6', '#06b6d4', '#3b82f6']}
        speed={0.3}
      />
      <AbsoluteFill
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <span
          style={{
            opacity: textOpacity,
            filter: `blur(${blurAmount}px)`,
            fontSize: 120,
            fontWeight: 700,
            color: '#fafafa',
            letterSpacing: '-0.04em',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
          }}
        >
          Holocron
        </span>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function SceneTagline() {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  // Fade in AND fade out
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  })
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )

  // Title words — masked slide reveal, inline (not AbsoluteFill)
  const titleWords = 'Beautiful docs from MDX.'.split(' ')
  // Subtitle words — staggered fade up, inline (not AbsoluteFill)
  const subtitleWords = 'Vite-powered. Deploy anywhere.'.split(' ')

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <MeshGradientBg
        colors={['#6366f1', '#8b5cf6', '#06b6d4', '#3b82f6']}
        speed={0.3}
      />
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
        }}
      >
        {/* Title — masked slide reveal (inline, no AbsoluteFill) */}
        <span
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: '#fafafa',
            letterSpacing: '-0.03em',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
          }}
        >
          {titleWords.map((word, i) => {
            const t = spring({
              frame: frame - i * 3,
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

        {/* Subtitle — staggered fade up (inline, no AbsoluteFill) */}
        <span
          style={{
            fontSize: 32,
            fontWeight: 400,
            color: '#a1a1aa',
            letterSpacing: '-0.02em',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
          }}
        >
          {subtitleWords.map((word, i) => {
            const delayedFrame = frame - 12 // subtitle starts 12 frames after scene
            const local = delayedFrame - i * 3
            const opacity = interpolate(local, [0, 14], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
            const y = interpolate(local, [0, 14], [24, 0], {
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
    </AbsoluteFill>
  )
}

function SceneTerminalCreate() {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  })
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )

  return (
    <AbsoluteFill style={{ background: '#050505', opacity: fadeIn * fadeOut }}>
      <MeshGradientBg
        colors={['#4f46e5', '#7c3aed', '#0891b2', '#2563eb']}
        speed={0.2}
        blur={120}
      />
      {/* Section label — centered horizontally, near top */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: 80,
        }}
      >
        <Sequence from={0} durationInFrames={60} layout="none">
          <SectionLabel text="Create" />
        </Sequence>
      </AbsoluteFill>
      <Sequence from={20} layout="none">
        <TerminalSimulator lines={CREATE_LINES} title="~/projects" />
      </Sequence>
    </AbsoluteFill>
  )
}

function SceneCodeConfig() {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  const fadeIn = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: 'clamp',
  })
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )

  return (
    <AbsoluteFill style={{ background: '#050505', opacity: fadeIn * fadeOut }}>
      <MeshGradientBg
        colors={['#7c3aed', '#6366f1', '#2dd4bf', '#3b82f6']}
        speed={0.2}
        blur={120}
      />
      {/* Section label — centered horizontally, near top */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: 60,
        }}
      >
        <Sequence from={0} durationInFrames={50} layout="none">
          <SectionLabel text="Configure" />
        </Sequence>
      </AbsoluteFill>
      <Sequence from={10} layout="none">
        <GlassCodeBlock
          code={DOCS_JSON_CODE}
          title="docs.json"
          width={780}
          height={520}
          fontSize={16}
          staggerFrames={3}
        />
      </Sequence>
    </AbsoluteFill>
  )
}

function SceneFeatures() {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  const fadeIn = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: 'clamp',
  })
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )

  return (
    <AbsoluteFill style={{ background: '#050505', opacity: fadeIn * fadeOut }}>
      <MeshGradientBg
        colors={['#8b5cf6', '#06b6d4', '#6366f1', '#ec4899']}
        speed={0.25}
        blur={120}
      />
      {/* Section label — centered horizontally, near top */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: 80,
        }}
      >
        <Sequence from={0} durationInFrames={40} layout="none">
          <SectionLabel text="Everything you need" />
        </Sequence>
      </AbsoluteFill>

      {/* Feature grid */}
      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 40,
        }}
      >
        <Sequence from={15} layout="none">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, auto)',
              gap: 16,
              padding: '0 80px',
            }}
          >
            {FEATURES.map((f, i) => (
              <FeaturePill key={f.label} label={f.label} icon={f.icon} index={i} />
            ))}
          </div>
        </Sequence>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function SceneAnalytics() {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  })
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )

  return (
    <AbsoluteFill style={{ background: '#050505', opacity: fadeIn * fadeOut }}>
      <MeshGradientBg
        colors={['#6366f1', '#06b6d4', '#8b5cf6', '#3b82f6']}
        speed={0.2}
        blur={120}
      />
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: 80,
        }}
      >
        <Sequence from={0} durationInFrames={50} layout="none">
          <SectionLabel text="Analytics" />
        </Sequence>
      </AbsoluteFill>
      <Sequence from={15} layout="none">
        <AnimatedChart sweepDuration={130} />
      </Sequence>
    </AbsoluteFill>
  )
}

function SceneTerminalDeploy() {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  })
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )

  return (
    <AbsoluteFill style={{ background: '#050505', opacity: fadeIn * fadeOut }}>
      <MeshGradientBg
        colors={['#059669', '#0891b2', '#6366f1', '#2563eb']}
        speed={0.2}
        blur={120}
      />
      {/* Section label — centered horizontally, near top */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: 80,
        }}
      >
        <Sequence from={0} durationInFrames={50} layout="none">
          <SectionLabel text="Deploy" />
        </Sequence>
      </AbsoluteFill>
      <Sequence from={15} layout="none">
        <TerminalSimulator
          lines={DEPLOY_LINES}
          title="~/my-docs"
        />
      </Sequence>
    </AbsoluteFill>
  )
}

function SceneClosing() {
  const frame = useCurrentFrame()

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ background: '#050505', opacity: fadeIn }}>
      <MeshGradientBg
        colors={['#6366f1', '#8b5cf6', '#06b6d4', '#3b82f6']}
        speed={0.3}
      />
      <ShimmerSweep
        text="holocron.so"
        fontSize={88}
        fontWeight={700}
        baseColor="#3f3f46"
        shineColor="#fafafa"
      />
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------------------
// Section label — appears at top of each scene
// ---------------------------------------------------------------------------

function SectionLabel({ text }: { text: string }) {
  const frame = useCurrentFrame()

  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: 'clamp',
  })
  const ty = interpolate(frame, [0, 12], [8, 0], {
    extrapolateRight: 'clamp',
  })

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${ty}px)`,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
        fontSize: 16,
        fontWeight: 500,
        color: '#a1a1aa',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}
    >
      {text}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main composition
// ---------------------------------------------------------------------------

export function HolocronVideo() {
  return (
    <AbsoluteFill style={{ background: '#050505' }}>
      <Sequence
        from={SCENE.opening.from}
        durationInFrames={SCENE.opening.duration}
        name="Opening"
      >
        <SceneOpening />
      </Sequence>

      <Sequence
        from={SCENE.tagline.from}
        durationInFrames={SCENE.tagline.duration}
        name="Tagline"
      >
        <SceneTagline />
      </Sequence>

      <Sequence
        from={SCENE.terminalCreate.from}
        durationInFrames={SCENE.terminalCreate.duration}
        name="Terminal: Create"
      >
        <SceneTerminalCreate />
      </Sequence>

      <Sequence
        from={SCENE.codeConfig.from}
        durationInFrames={SCENE.codeConfig.duration}
        name="Code: docs.json"
      >
        <SceneCodeConfig />
      </Sequence>

      <Sequence
        from={SCENE.features.from}
        durationInFrames={SCENE.features.duration}
        name="Features"
      >
        <SceneFeatures />
      </Sequence>

      <Sequence
        from={SCENE.analytics.from}
        durationInFrames={SCENE.analytics.duration}
        name="Analytics"
      >
        <SceneAnalytics />
      </Sequence>

      <Sequence
        from={SCENE.terminalDeploy.from}
        durationInFrames={SCENE.terminalDeploy.duration}
        name="Terminal: Deploy"
      >
        <SceneTerminalDeploy />
      </Sequence>

      <Sequence
        from={SCENE.closing.from}
        durationInFrames={SCENE.closing.duration}
        name="Closing"
      >
        <SceneClosing />
      </Sequence>
    </AbsoluteFill>
  )
}
