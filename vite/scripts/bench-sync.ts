/**
 * Benchmark MDX sync and per-page costs on the repo's real docs.
 *
 *   pnpm --dir vite exec tsx scripts/bench-sync.ts            # network on
 *   pnpm --dir vite exec tsx scripts/bench-sync.ts --offline  # remote image fetches fail fast
 *
 * Sync writes caches to a temp dir, never to the corpus dist/.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { mdxParse } from 'safe-mdx/parse'
import { syncNavigation } from '../src/lib/sync.ts'
import { processMdx } from '../src/lib/mdx-processor.ts'
import { readConfig } from '../src/config.ts'
import { demoteBodyH1s } from '../src/lib/mdx-sections.ts'
import { assignUniqueHeadingIds } from '../src/lib/toc-tree.ts'

const REPO = path.resolve(import.meta.dirname, '../..')
const CORPORA = [
  { name: 'polar', root: path.join(REPO, 'integration-tests/fixtures/realworld-polar'), pagesDir: '.' },
  { name: 'website', root: path.join(REPO, 'website'), pagesDir: 'src/pages' },
]
const SYNC_RUNS = 7

if (process.argv.includes('--offline')) {
  globalThis.fetch = async () => {
    throw new Error('offline benchmark')
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]!
}

const fmt = (ms: number) => `${ms.toFixed(2)}ms`

for (const corpus of CORPORA) {
  const pagesDir = path.join(corpus.root, corpus.pagesDir)
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), `holocron-bench-${corpus.name}-`))
  const config = readConfig({ root: corpus.root })
  const sync = () => syncNavigation({
    config,
    pagesDir,
    publicDir: path.join(corpus.root, 'public'),
    projectRoot: corpus.root,
    distDir,
    logParseErrors: false,
    deferProviders: true,
  })

  console.log(`\n${corpus.name}`)
  let t = performance.now()
  const first = await sync()
  console.log(`  first sync (sharp, cold caches) ${fmt(performance.now() - t)}`)

  const syncTimes: number[] = []
  for (let i = 0; i < SYNC_RUNS; i++) {
    t = performance.now()
    await sync()
    syncTimes.push(performance.now() - t)
  }
  console.log(`  full sync median of ${SYNC_RUNS}  ${fmt(median(syncTimes))}`)

  const pages = Object.entries(first.mdxContent)
  const parseTimes: number[] = []
  const processTimes: number[] = []
  for (const [slug, mdx] of pages) {
    t = performance.now()
    const mdast = mdxParse(mdx)
    demoteBodyH1s(mdast.children)
    assignUniqueHeadingIds(mdast.children)
    parseTimes.push(performance.now() - t)

    t = performance.now()
    processMdx(mdx, config.icons.library, `/${slug}`, { slug })
    processTimes.push(performance.now() - t)
  }
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
  console.log(`  pages ${pages.length}, served MDX ${(sum(pages.map(([, m]) => m.length)) / 1024).toFixed(0)} KiB`)
  console.log(`  request parse avg ${fmt(sum(parseTimes) / pages.length)} max ${fmt(Math.max(...parseTimes))}`)
  console.log(`  processMdx    avg ${fmt(sum(processTimes) / pages.length)} max ${fmt(Math.max(...processTimes))}`)
  for (const file of fs.readdirSync(distDir)) {
    console.log(`  ${file} ${(fs.statSync(path.join(distDir, file)).size / 1024).toFixed(0)} KiB`)
  }
  fs.rmSync(distDir, { recursive: true, force: true })
}
