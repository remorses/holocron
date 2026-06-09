'use client'

/**
 * User-defined components and data for the video.
 * These are importable from the MDX file via:
 *   import { FeatureGrid } from './components'
 *
 * Must be 'use client' so RSC can serialize component references
 * when passing resolved modules to the client PlayerPage.
 */

import { FeaturePill, type TerminalLine } from 'holocron-video/src/components'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export const CREATE_LINES: TerminalLine[] = [
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

export const DEPLOY_LINES: TerminalLine[] = [
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

export const DOCS_JSON_CODE = `{
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

export const FEATURES = [
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

export function FeatureGrid({ features }: { features: typeof FEATURES }) {
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
