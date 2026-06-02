/**
 * Bundles prismjs core + all language components into a single ESM file.
 *
 * Prism components are CJS IIFEs that mutate a global `Prism` object.
 * Vite's dev optimizer discovers each of the ~300 component files individually,
 * causing a slow "new dependencies optimized" waterfall on every cold start.
 *
 * This script uses the esbuild CLI to bundle everything into one ESM file at
 * `src/generated/prism-bundle.js` so there are zero `prismjs/*` imports at
 * runtime. The generated file is checked into git so the build works without
 * running this script first (only re-run when upgrading prismjs).
 *
 * Run with: pnpm -F @holocron.so/vite bundle-prism
 */

import { execSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const viteRoot = path.resolve(__dirname, '..')
const outFile = path.join(viteRoot, 'src', 'generated', 'prism-bundle.js')
const entryPoint = path.join(__dirname, 'prism-entry.ts')

// Skip if the output already exists (it's checked into git).
// Only re-run manually when upgrading prismjs.
if (fs.existsSync(outFile)) {
  console.log(`prism-bundle.js already exists, skipping. Re-run manually to update.`)
  process.exit(0)
}

console.log('Bundling prismjs into single ESM file...')

fs.mkdirSync(path.dirname(outFile), { recursive: true })

execSync(
  [
    'esbuild',
    JSON.stringify(entryPoint),
    '--bundle',
    '--format=esm',
    '--platform=browser',
    '--target=es2022',
    '--define:self=globalThis',
    '--tree-shaking=true',
    `--outfile=${JSON.stringify(outFile)}`,
  ].join(' '),
  { stdio: 'inherit', cwd: viteRoot },
)

const stat = fs.statSync(outFile)
const sizeKB = (stat.size / 1024).toFixed(0)
console.log(`Written ${outFile} (${sizeKB} KB)`)

// Read the prismjs version for the header comment
const prismPkg = JSON.parse(
  fs.readFileSync(path.join(viteRoot, 'node_modules', 'prismjs', 'package.json'), 'utf-8'),
)
const version = prismPkg.version

// Prepend a header comment
const content = fs.readFileSync(outFile, 'utf-8')
const header = `// Auto-generated from prismjs@${version} by scripts/bundle-prism.ts\n// Do not edit manually. Re-run: pnpm -F @holocron.so/vite bundle-prism\n`
fs.writeFileSync(outFile, header + content)

console.log(`Done. Bundled prismjs@${version}`)
