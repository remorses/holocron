/**
 * Data constants for the video. Separated from components.tsx so React
 * Fast Refresh works (it requires files to only export components).
 */

import type { TerminalLine } from 'holocron-video/src/components'

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
