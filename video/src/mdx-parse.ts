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

/** Parse YAML frontmatter from mdast. Extracts fps, bpm. */
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

const HEADING_PROP_RE = /\s+(duration|transition)=(\d+(?:\.\d+)?)(s|fps|beats?)?/gi

interface ParsedHeading {
  label: string
  durationInFrames: number | null
  /** Transition overlap with the NEXT section, in frames. 0 = hard cut. */
  transitionFrames: number | null
}

function parseHeadingProps(
  rawText: string,
  fps: number,
  bpm: number,
): ParsedHeading {
  let label = rawText
  let durationInFrames: number | null = null
  let transitionFrames: number | null = null
  const framesPerBeat = fps / (bpm / 60)

  // Strip all key=value props from the heading text
  label = label.replace(HEADING_PROP_RE, (match, key, value, unit) => {
    const v = Number(value)
    const u = (unit || '').toLowerCase()
    let frames: number
    if (u === 's') {
      frames = Math.round(v * fps)
    } else if (u === 'beat' || u === 'beats') {
      frames = Math.round(v * framesPerBeat)
    } else {
      frames = Math.round(v)
    }

    if (key.toLowerCase() === 'duration') {
      durationInFrames = frames
    } else if (key.toLowerCase() === 'transition') {
      transitionFrames = frames
    }
    return ''
  }).trim()

  return { label: label || 'Untitled', durationInFrames, transitionFrames }
}

// ---------------------------------------------------------------------------
// Section splitting
// ---------------------------------------------------------------------------

export interface MdxSection {
  heading: string | null
  nodes: RootContent[]
  durationInFrames: number
  /** Transition overlap with the NEXT section, in frames. 0 = hard cut. */
  transitionFrames: number
}

export interface SplitResult {
  sections: MdxSection[]
  frontmatter: VideoFrontmatter
  /** ESM import nodes from the document, needed by SafeMdxRenderer to resolve modules */
  imports: RootContent[]
  /** Content nodes before the first heading. Rendered at composition level,
   *  outside the Series, spanning the full video duration. Use for soundtracks,
   *  ambient background videos, or any component that should persist across
   *  all sections. */
  preamble: RootContent[]
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
  const preamble: RootContent[] = []
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
      const parsed = parseHeadingProps(rawText, fps, bpm)
      current = {
        heading: parsed.label,
        nodes: [],
        durationInFrames: parsed.durationInFrames ?? defaultDuration,
        transitionFrames: parsed.transitionFrames ?? 0,
      }
      sections.push(current)
      continue
    }

    // Content before the first heading goes into the preamble, which is
    // rendered at composition level (outside Series) so it spans the
    // full video duration.
    if (beforeFirstHeading) {
      preamble.push(node)
    } else if (current) {
      current.nodes.push(node)
    }
  }

  return { sections, frontmatter, imports, preamble }
}

/** Calculate total composition duration, subtracting transition overlaps. */
export function calculateTotalDuration(sections: MdxSection[]): number {
  let total = 0
  for (const s of sections) {
    total += s.durationInFrames
  }
  // Each section's transitionFrames creates an overlap with the next section,
  // reducing total duration by that amount.
  for (const s of sections) {
    total -= s.transitionFrames
  }
  return total
}
