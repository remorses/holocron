/**
 * CPU profile characterization tests for cold dev-server startup.
 *
 * These tests read a captured `.cpuprofile` fixture and snapshot the dominant
 * hotspot categories so future performance work has a stable textual baseline.
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

type CpuNode = {
  id: number
  callFrame: {
    functionName: string
    url: string
  }
  hitCount?: number
  children?: number[]
}

type CpuProfile = {
  nodes: CpuNode[]
  samples?: number[]
}

type Hotspot = {
  hits: number
  functionName: string
  location: string
}

const repoRoot = path.join(import.meta.dirname, '..', '..', '..').replaceAll('\\', '/')
const repoName = path.basename(repoRoot)
const profilePath = path.join(import.meta.dirname, '..', '..', 'fixtures', 'cpu-profiles', 'realworld-polar-dev.cpuprofile')
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8')) as CpuProfile

const PSEUDO_FUNCTIONS = new Set(['(root)', '(program)', '(idle)', '(garbage collector)'])

function normalizeLocation(url: string): string {
  if (url === '') return '(native)'
  if (url.startsWith('node:')) return url

  const raw = url.startsWith('file://') ? url.slice('file://'.length) : url
  const pnpmIndex = raw.lastIndexOf('/node_modules/.pnpm/')
  if (pnpmIndex !== -1) {
    return `nm/${raw.slice(pnpmIndex + '/node_modules/.pnpm/'.length)}`
  }

  const repoMarker = `/${repoName}/`
  const repoIndex = raw.lastIndexOf(repoMarker)
  if (repoIndex !== -1) {
    return `<repo>/${raw.slice(repoIndex + repoMarker.length)}`
  }

  return raw
}

function isRelevantLocation(location: string): boolean {
  return (
    location.startsWith('<repo>/vite/dist/') ||
    location.startsWith('nm/micromark') ||
    location.startsWith('nm/mdast-util') ||
    location.startsWith('nm/unist-util') ||
    location.startsWith('nm/unified') ||
    location.startsWith('nm/remark-parse') ||
    location.startsWith('nm/prismjs') ||
    location.startsWith('nm/safe-mdx') ||
    location.startsWith('nm/zwitch')
  )
}

function topRelevantSelfLocations(cpuProfile: CpuProfile, limit: number): string[] {
  const byLocation = new Map<string, number>()
  for (const node of cpuProfile.nodes) {
    const hits = node.hitCount ?? 0
    if (hits === 0) continue
    const location = normalizeLocation(node.callFrame.url)
    if (!isRelevantLocation(location)) continue
    byLocation.set(location, (byLocation.get(location) ?? 0) + hits)
  }

  return [...byLocation.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([location, hits]) => `${hits} ${location}`)
}

function getInclusiveHotspots(cpuProfile: CpuProfile): Hotspot[] {
  const nodeById = new Map(cpuProfile.nodes.map((node) => [node.id, node]))
  const parentById = new Map<number, number>()
  for (const node of cpuProfile.nodes) {
    for (const childId of node.children ?? []) {
      parentById.set(childId, node.id)
    }
  }

  const totalByNodeId = new Map<number, number>()
  for (const sampleId of cpuProfile.samples ?? []) {
    let currentId: number | undefined = sampleId
    while (currentId !== undefined) {
      totalByNodeId.set(currentId, (totalByNodeId.get(currentId) ?? 0) + 1)
      currentId = parentById.get(currentId)
    }
  }

  return [...totalByNodeId.entries()]
    .map(([nodeId, hits]) => {
      const node = nodeById.get(nodeId)
      if (!node) return undefined
      return {
        hits,
        functionName: node.callFrame.functionName,
        location: normalizeLocation(node.callFrame.url),
      }
    })
    .filter((row): row is Hotspot => {
      return !!row && row.hits > 0 && !PSEUDO_FUNCTIONS.has(row.functionName) && isRelevantLocation(row.location)
    })
    .sort((a, b) => b.hits - a.hits || a.functionName.localeCompare(b.functionName))
}

function formatHotspots(rows: Hotspot[], limit: number): string[] {
  return rows.slice(0, limit).map((row) => {
    return `${row.hits} ${row.functionName} @ ${row.location}`
  })
}

describe('realworld-polar dev cpu profile', () => {
  test('self-time hotspots are parser-heavy libraries', () => {
    expect(topRelevantSelfLocations(profile, 12)).toMatchInlineSnapshot(`
      [
        "180 nm/micromark@4.0.2/node_modules/micromark/lib/create-tokenizer.js",
        "100 nm/micromark-util-subtokenize@2.1.0/node_modules/micromark-util-subtokenize/index.js",
        "87 nm/mdast-util-from-markdown@2.0.3/node_modules/mdast-util-from-markdown/lib/index.js",
        "60 nm/unist-util-visit-parents@6.0.2/node_modules/unist-util-visit-parents/lib/index.js",
        "50 nm/prismjs@1.30.0/node_modules/prismjs/prism.js",
        "43 nm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/util/safe.js",
        "29 nm/micromark@4.0.2/node_modules/micromark/lib/initialize/document.js",
        "27 nm/micromark-extension-gfm-table@2.1.1/node_modules/micromark-extension-gfm-table/lib/syntax.js",
        "26 nm/micromark-util-chunked@2.0.1/node_modules/micromark-util-chunked/index.js",
        "24 nm/mdast-util-to-markdown@2.1.2/node_modules/mdast-util-to-markdown/lib/index.js",
        "20 nm/micromark-extension-gfm-autolink-literal@2.1.0/node_modules/micromark-extension-gfm-autolink-literal/lib/syntax.js",
        "20 nm/micromark@4.0.2/node_modules/micromark/lib/initialize/text.js",
      ]
    `)
  })

  test('inclusive hotspots are dominated by syncNavigation and MDX parsing', () => {
    const hotspots = getInclusiveHotspots(profile)

    expect(formatHotspots(hotspots, 18)).toMatchInlineSnapshot(`
      [
        "1154 configResolved @ <repo>/vite/dist/vite-plugin.js",
        "1153 buildEnrichedNavigation @ <repo>/vite/dist/lib/enrich-navigation.js",
        "1153 syncNavigation @ <repo>/vite/dist/lib/sync.js",
        "1152 enrichGroup @ <repo>/vite/dist/lib/enrich-navigation.js",
        "1152 enrichPageEntry @ <repo>/vite/dist/lib/enrich-navigation.js",
        "1152 enrichTab @ <repo>/vite/dist/lib/enrich-navigation.js",
        "603 enrichGroup @ <repo>/vite/dist/lib/enrich-navigation.js",
        "602 enrichPageEntry @ <repo>/vite/dist/lib/enrich-navigation.js",
        "576 enrichPage @ <repo>/vite/dist/lib/sync.js",
        "549 enrichPage @ <repo>/vite/dist/lib/sync.js",
        "408 processMdx @ <repo>/vite/dist/lib/mdx-processor.js",
        "359 processMdx @ <repo>/vite/dist/lib/mdx-processor.js",
        "347 enrichPage @ <repo>/vite/dist/lib/sync.js",
        "238 normalizeMdx @ <repo>/vite/dist/lib/mintlify/normalize-mdx.js",
        "219 collectMdxIconRefs @ <repo>/vite/dist/lib/mdx-processor.js",
        "207 normalizeMdx @ <repo>/vite/dist/lib/mintlify/normalize-mdx.js",
        "177 parse @ nm/unified@11.0.5/node_modules/unified/lib/index.js",
        "175 parser @ nm/remark-parse@11.0.0/node_modules/remark-parse/lib/index.js",
      ]
    `)
    expect(hotspots.some((row) => row.functionName === 'syncNavigation' && row.location.endsWith('vite/dist/lib/sync.js'))).toBe(true)
    expect(hotspots.some((row) => row.functionName === 'enrichPage' && row.location.endsWith('vite/dist/lib/sync.js'))).toBe(true)
    expect(hotspots.some((row) => row.functionName === 'processMdx' && row.location.endsWith('vite/dist/lib/mdx-processor.js'))).toBe(true)
  })

  test('icon resolution does not appear among the hot relevant frames', () => {
    const iconHotspots = getInclusiveHotspots(profile).filter((row) => {
      return row.location.includes('resolve-icons') || row.location.includes('collect-icons')
    })

    expect(iconHotspots).toMatchInlineSnapshot(`[]`)
  })
})
