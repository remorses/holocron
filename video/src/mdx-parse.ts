/**
 * Server-safe MDX parsing utilities for the video framework.
 *
 * This module contains ONLY parsing logic (frontmatter, section splitting,
 * duration calculation). It does NOT import remotion or any client-only
 * modules, so it can safely run in the RSC server environment.
 *
 * The rendering counterpart is mdx-video.tsx which re-exports these
 * functions alongside the Remotion components.
 */

import YAML from 'yaml'

// Inline mdast types to avoid requiring @types/mdast as a dependency
type RootContent = any
type Root = { type: 'root'; children: RootContent[] }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_FPS = 30
const DEFAULT_BPM = 120
const DEFAULT_SECTION_BEATS = 10

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

export interface VideoFrontmatter {
  fps: number
  bpm: number
}

/** Parse YAML frontmatter from mdast. Extracts fps, bpm, and any extra fields. */
function parseFrontmatter(mdast: Root): VideoFrontmatter {
  const result: VideoFrontmatter = { fps: DEFAULT_FPS, bpm: DEFAULT_BPM }
  for (const node of mdast.children) {
    if (node.type !== 'yaml') continue
    const text = (node as any).value as string
    if (!text) continue
    const parsed = YAML.parse(text)
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.fps === 'number' && parsed.fps > 0) result.fps = parsed.fps
      if (typeof parsed.bpm === 'number' && parsed.bpm > 0) result.bpm = parsed.bpm
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Duration parsing from heading text
// ---------------------------------------------------------------------------

const DURATION_RE = /\s+duration=(\d+(?:\.\d+)?)(s|fps|beats?)?\s*$/i

interface ParsedHeading {
  label: string
  durationInFrames: number | null
}

function parseHeadingDuration(
  rawText: string,
  fps: number,
  bpm: number,
): ParsedHeading {
  const match = rawText.match(DURATION_RE)
  if (!match) return { label: rawText.trim(), durationInFrames: null }

  const value = Number(match[1])
  const unit = (match[2] || '').toLowerCase()
  const label = rawText.slice(0, match.index).trim()
  const framesPerBeat = fps / (bpm / 60)

  let frames: number
  if (unit === 's') {
    frames = Math.round(value * fps)
  } else if (unit === 'beat' || unit === 'beats') {
    frames = Math.round(value * framesPerBeat)
  } else {
    frames = Math.round(value)
  }

  return { label: label || 'Untitled', durationInFrames: frames }
}

// ---------------------------------------------------------------------------
// Section splitting
// ---------------------------------------------------------------------------

export interface MdxSection {
  heading: string | null
  nodes: RootContent[]
  durationInFrames: number
}

export interface SplitResult {
  sections: MdxSection[]
  frontmatter: VideoFrontmatter
  /** ESM import nodes from the document, needed by SafeMdxRenderer to resolve modules */
  imports: RootContent[]
}

function extractHeadingText(node: RootContent): string {
  if (node.type !== 'heading') return ''
  const parts: string[] = []
  for (const child of (node as any).children || []) {
    if (child.type === 'text') parts.push(child.value)
  }
  return parts.join('') || 'Untitled'
}

export function splitIntoSections(mdast: Root): SplitResult {
  const frontmatter = parseFrontmatter(mdast)
  const { fps, bpm } = frontmatter
  const framesPerBeat = fps / (bpm / 60)
  const defaultDuration = Math.round(DEFAULT_SECTION_BEATS * framesPerBeat)

  const sections: MdxSection[] = []
  const imports: RootContent[] = []
  let current: MdxSection | null = null
  let beforeFirstHeading = true

  for (const node of mdast.children) {
    if (node.type === 'yaml' || node.type === 'toml') {
      continue
    }
    if (node.type === 'mdxjsEsm') {
      imports.push(node)
      continue
    }

    if (node.type === 'heading') {
      beforeFirstHeading = false
      const rawText = extractHeadingText(node)
      const parsed = parseHeadingDuration(rawText, fps, bpm)
      current = {
        heading: parsed.label,
        nodes: [],
        durationInFrames: parsed.durationInFrames ?? defaultDuration,
      }
      sections.push(current)
      continue
    }

    if (beforeFirstHeading) {
      if (!current) {
        current = {
          heading: null,
          nodes: [],
          durationInFrames: defaultDuration,
        }
        sections.push(current)
        beforeFirstHeading = false
      }
      current.nodes.push(node)
    } else if (current) {
      current.nodes.push(node)
    }
  }

  return { sections, frontmatter, imports }
}

/** Calculate total composition duration: simple sum since no transitions */
export function calculateTotalDuration(sections: MdxSection[]): number {
  return sections.reduce((sum, s) => sum + s.durationInFrames, 0)
}
