// Copies the template/ folder into dist/template/ at build time.
// Only includes files that should be scaffolded for new projects:
// MDX pages, docs.jsonc, vite.config.ts, tsconfig.json, api.yaml, and public/.
// Excludes: node_modules, dist, tmp, .cache, lockfiles.

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SOURCE_DIR = path.join(ROOT, 'template')
const TEMPLATE_DIR = path.join(ROOT, 'cli/dist/template')

const EXCLUDE = new Set([
  'node_modules',
  'dist',
  'tmp',
  '.cache',
  '.vite',
  'package.json',
  'pnpm-lock.yaml',
  'bun.lock',
  'yarn.lock',
  'package-lock.json',
])

function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (EXCLUDE.has(entry.name)) continue
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

if (fs.existsSync(TEMPLATE_DIR)) {
  fs.rmSync(TEMPLATE_DIR, { recursive: true })
}

copyDir(SOURCE_DIR, TEMPLATE_DIR)

function countFiles(dir: string): number {
  let count = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name))
    } else {
      count++
    }
  }
  return count
}

console.log(`✓ copied ${countFiles(TEMPLATE_DIR)} template files to dist/template/`)
