// Diagram alignment fixer — detects and fixes misaligned Unicode box-drawing
// characters in markdown code blocks. Works by finding boxes (┌─┐ / └─┘),
// verifying that vertical bars (│) align with corners, and adjusting padding.
//
// The top border (┌─┐) is the source of truth for box width. Content lines
// and bottom borders are adjusted to match. Each content line's inner text
// is extracted by finding the actual │ positions (which may be wrong), then
// re-emitted with correct padding so the right │ lands at the target column.
//
// Handles East Asian wide characters (CJK) that occupy 2 display columns.
// Processes only fenced code blocks in markdown files, leaving prose untouched.

import fs from 'node:fs'
import path from 'node:path'
import { goke } from 'goke'
import { logger, colors as c } from './logger.ts'

// ─────────────────────────────────────────────────────────────
// Display width — East Asian Width lookup
// ─────────────────────────────────────────────────────────────

// Ranges where a codepoint occupies 2 terminal columns (East Asian Fullwidth/Wide).
// Derived from Unicode 15.1 EastAsianWidth.txt (categories W and F).
const WIDE_RANGES: [number, number][] = [
  [0x1100, 0x115f], // Hangul Jamo
  [0x2329, 0x232a], // Angle brackets
  [0x2e80, 0x303e], // CJK Radicals, Kangxi, Ideographic, CJK Symbols
  [0x3040, 0x33bf], // Hiragana, Katakana, Bopomofo, Hangul Compat, Kanbun, CJK Compat
  [0x33c0, 0x33ff], // CJK Compat cont.
  [0x3400, 0x4dbf], // CJK Unified Ext A
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0xa000, 0xa4cf], // Yi
  [0xac00, 0xd7af], // Hangul Syllables
  [0xf900, 0xfaff], // CJK Compat Ideographs
  [0xfe10, 0xfe19], // Vertical forms
  [0xfe30, 0xfe6f], // CJK Compat Forms + Small Form Variants
  [0xff01, 0xff60], // Fullwidth ASCII + Halfwidth Katakana start
  [0xffe0, 0xffe6], // Fullwidth signs
  [0x1f300, 0x1f9ff], // Miscellaneous Symbols and Pictographs + Emoticons + etc
  [0x20000, 0x2fffd], // CJK Unified Ext B+
  [0x30000, 0x3fffd], // CJK Unified Ext G+
]

function isWideCodepoint(cp: number): boolean {
  for (const [lo, hi] of WIDE_RANGES) {
    if (cp >= lo && cp <= hi) return true
  }
  return false
}

/** Display width of a single character (1 or 2 columns). */
export function charDisplayWidth(char: string): number {
  const cp = char.codePointAt(0)!
  if (isWideCodepoint(cp)) return 2
  // Control chars and zero-width joiners
  if (cp < 32 || (cp >= 0x200b && cp <= 0x200f) || cp === 0xfeff) return 0
  return 1
}

/** Total display width of a string in monospace columns. */
export function stringDisplayWidth(str: string): number {
  let width = 0
  for (const char of str) {
    width += charDisplayWidth(char)
  }
  return width
}

// ─────────────────────────────────────────────────────────────
// Character grid — maps chars to display columns
// ─────────────────────────────────────────────────────────────

interface Cell {
  char: string
  displayCol: number
  displayWidth: number
  /** Index into the [...str] char array */
  charIndex: number
}

function charGrid(line: string): Cell[] {
  const cells: Cell[] = []
  let col = 0
  let idx = 0
  for (const char of line) {
    const w = charDisplayWidth(char)
    cells.push({ char, displayCol: col, displayWidth: w, charIndex: idx })
    col += w
    idx++
  }
  return cells
}

function charAtDisplayCol(line: string, targetCol: number): Cell | undefined {
  let col = 0
  let idx = 0
  for (const char of line) {
    const w = charDisplayWidth(char)
    if (col === targetCol) return { char, displayCol: col, displayWidth: w, charIndex: idx }
    if (col > targetCol) return undefined
    col += w
    idx++
  }
  return undefined
}

// ─────────────────────────────────────────────────────────────
// Box-drawing character classification
// ─────────────────────────────────────────────────────────────

const H_BORDER = new Set('─━═')
const V_BORDER = new Set('│┃║')
const TL_CORNER = new Set('┌┏╔╭')   // ╭ = rounded top-left
const TR_CORNER = new Set('┐┓╗╮')   // ╮ = rounded top-right
const BL_CORNER = new Set('└┗╚╰')   // ╰ = rounded bottom-left
const BR_CORNER = new Set('┘┛╝╯')   // ╯ = rounded bottom-right
const TOP_BORDER_JUNCTIONS = new Set('┬┳╦')
const BOTTOM_BORDER_JUNCTIONS = new Set('┴┻╩')
const LEFT_BORDER_JUNCTIONS = new Set('├┣╠')
const RIGHT_BORDER_JUNCTIONS = new Set('┤┫╣')
/** Cross junctions — used in divider detection. */
const CROSS_JUNCTIONS = new Set('┼╬╋')

function isHBorder(ch: string) { return H_BORDER.has(ch) || TOP_BORDER_JUNCTIONS.has(ch) || BOTTOM_BORDER_JUNCTIONS.has(ch) }
function isTopLeft(ch: string) { return TL_CORNER.has(ch) }
function isTopRight(ch: string) { return TR_CORNER.has(ch) }
function isBottomLeft(ch: string) { return BL_CORNER.has(ch) }
function isBottomRight(ch: string) { return BR_CORNER.has(ch) }
function isVBorder(ch: string) { return V_BORDER.has(ch) }
function isLeftBorder(ch: string) { return V_BORDER.has(ch) || LEFT_BORDER_JUNCTIONS.has(ch) }
function isRightBorder(ch: string) { return V_BORDER.has(ch) || RIGHT_BORDER_JUNCTIONS.has(ch) }

// ─────────────────────────────────────────────────────────────
// Box detection
// ─────────────────────────────────────────────────────────────

interface Box {
  topRow: number
  bottomRow: number
  /** Display column of ┌ (source of truth for left edge) */
  leftCol: number
  /** Display column of ┐ (source of truth for right edge and box width) */
  rightCol: number
  hChar: string
  vChar: string
  corners: [string, string, string, string]
}

/**
 * Find all boxes. The top border (┌─┐) defines the box.
 * The bottom border (└─┘) is found by scanning down from ┌ for └ at the
 * same leftCol, then scanning right from └ for ┘. The ┘ doesn't need to
 * match rightCol — it will be fixed.
 */
export function findBoxes(lines: string[]): Box[] {
  const boxes: Box[] = []

  for (let row = 0; row < lines.length; row++) {
    const grid = charGrid(lines[row]!)

    for (let ci = 0; ci < grid.length; ci++) {
      const cell = grid[ci]!
      if (!isTopLeft(cell.char)) continue

      const leftCol = cell.displayCol
      const tlChar = cell.char

      // Scan right for ┐
      let trChar: string | undefined
      let rightCol = -1
      for (let cj = ci + 1; cj < grid.length; cj++) {
        const ch = grid[cj]!.char
        if (isTopRight(ch)) {
          trChar = ch
          rightCol = grid[cj]!.displayCol
          break
        }
        if (!isHBorder(ch)) break
      }
      if (!trChar || rightCol < 0) continue

      // Scan down from ┌ for └ at same leftCol.
      // Allow │, ├, or any left-border char on the way down.
      // Also search ±3 cols to tolerate displaced left borders in
      // side-by-side box layouts where agents miscount spacing.
      let blChar: string | undefined
      let bottomRow = -1
      for (let r = row + 1; r < lines.length; r++) {
        let foundBorder = false
        for (let off = 0; off <= 3; off++) {
          const cols = off === 0 ? [leftCol] : [leftCol + off, leftCol - off]
          for (const col of cols) {
            if (col < 0) continue
            const hit = charAtDisplayCol(lines[r]!, col)
            if (!hit) continue
            if (isBottomLeft(hit.char)) {
              blChar = hit.char
              bottomRow = r
              foundBorder = true
              break
            }
            if (isLeftBorder(hit.char)) {
              foundBorder = true
              break
            }
          }
          if (foundBorder) break
        }
        if (blChar) break
        if (!foundBorder) break
      }
      if (!blChar || bottomRow < 0) continue

      // Find ┘ on the bottom row by scanning right from └.
      // It might be at the wrong column (misaligned), that's fine.
      // Search ±3 cols for └ to tolerate displaced bottom-left corners.
      const bottomGrid = charGrid(lines[bottomRow]!)
      let blCellIdx = bottomGrid.findIndex((c) => c.displayCol === leftCol && isBottomLeft(c.char))
      if (blCellIdx < 0) {
        for (let off = 1; off <= 3; off++) {
          for (const col of [leftCol + off, leftCol - off]) {
            const idx = bottomGrid.findIndex((c) => c.displayCol === col && isBottomLeft(c.char))
            if (idx >= 0) { blCellIdx = idx; break }
          }
          if (blCellIdx >= 0) break
        }
      }
      if (blCellIdx < 0) blCellIdx = bottomGrid.findIndex((c) => c.displayCol === leftCol)
      let brChar: string | undefined
      for (let bj = blCellIdx + 1; bj < bottomGrid.length; bj++) {
        const ch = bottomGrid[bj]!.char
        if (isBottomRight(ch)) {
          brChar = ch
          break
        }
        if (!isHBorder(ch)) break
      }
      if (!brChar) continue

      // Detect border chars
      const hChar = grid[ci + 1]?.char || '─'
      let vChar = '│'
      if (row + 1 < lines.length && row + 1 < bottomRow) {
        // Search ±3 cols for the vertical border char on the first content line
        for (let off = 0; off <= 3; off++) {
          const cols = off === 0 ? [leftCol] : [leftCol + off, leftCol - off]
          let found = false
          for (const col of cols) {
            if (col < 0) continue
            const firstContent = charAtDisplayCol(lines[row + 1]!, col)
            if (firstContent && isVBorder(firstContent.char)) { vChar = firstContent.char; found = true; break }
          }
          if (found) break
        }
      }

      boxes.push({
        topRow: row,
        bottomRow,
        leftCol,
        rightCol,
        hChar: H_BORDER.has(hChar) ? hChar : '─',
        vChar,
        corners: [tlChar, trChar, blChar, brChar],
      })
    }
  }

  return boxes
}

// ─────────────────────────────────────────────────────────────
// Column-level splice — replace only the display columns owned by a box
// ─────────────────────────────────────────────────────────────

/**
 * Replace a range of display columns in a line with new content.
 * Everything before `startCol` and after `endCol` (inclusive) is kept as-is.
 * The `replacement` string is placed at `startCol`; it must be exactly
 * `endCol - startCol + 1` display columns wide.
 */
function spliceLine(line: string, startCol: number, endCol: number, replacement: string): string {
  const chars = [...line]
  const grid = charGrid(line)

  // Find char indices for the splice boundaries
  let startCharIdx = chars.length
  let endCharIdx = chars.length
  for (const cell of grid) {
    if (cell.displayCol === startCol) startCharIdx = cell.charIndex
    // endCol is inclusive: the char at endCol is replaced.
    // The char AFTER endCol starts the suffix.
    if (cell.displayCol === endCol) endCharIdx = cell.charIndex + 1
    if (cell.displayCol > endCol && endCharIdx === chars.length) {
      endCharIdx = cell.charIndex
    }
  }

  const prefix = chars.slice(0, startCharIdx).join('')
  const suffix = chars.slice(endCharIdx).join('')
  return prefix + replacement + suffix
}

/**
 * For a content line inside a box, extract the text between the left border
 * at `leftCol` and the right border closest to `expectedRightCol`.
 *
 * `expectedRightCol` comes from the top border ┐ position. We search outward
 * from that column (±1, ±2, ...) to find the actual right-border char. This
 * prevents an outer box's │ from being mistaken for an inner box's border.
 */
function extractBoxContent(
  line: string,
  leftCol: number,
  expectedRightCol: number,
): { leftBorder: string; content: string; rightBorder: string; rightCol: number; leftCol: number } | undefined {
  const grid = charGrid(line)

  // Find the left-border char closest to leftCol, searching outward.
  // Use a small max offset (±3) to avoid grabbing a │ from an adjacent box.
  // Prefer RIGHT (content shifted inward) before LEFT at each offset,
  // because LLM diagrams typically add extra spacing between side-by-side boxes.
  let leftCell: Cell | undefined
  const maxLeftOffset = 3
  for (let offset = 0; offset <= maxLeftOffset; offset++) {
    const candidates = offset === 0
      ? [leftCol]
      : [leftCol + offset, leftCol - offset]
    for (const col of candidates) {
      if (col < 0) continue
      const cell = grid.find((c) => c.displayCol === col && isLeftBorder(c.char))
      if (cell) {
        leftCell = cell
        break
      }
    }
    if (leftCell) break
  }
  if (!leftCell) return undefined

  // Find the right-border char closest to expectedRightCol, searching outward.
  // Prefer LEFT (shorter content) before RIGHT (wider content) at each offset,
  // because LLM diagrams typically have missing padding, not extra content.
  let rightCell: Cell | undefined
  const maxOffset = Math.max(expectedRightCol, grid.length)
  for (let offset = 0; offset <= maxOffset; offset++) {
    const candidates = offset === 0
      ? [expectedRightCol]
      : [expectedRightCol - offset, expectedRightCol + offset]
    for (const col of candidates) {
      if (col <= leftCell.displayCol) continue
      const cell = grid.find((c) => c.displayCol === col && isRightBorder(c.char))
      if (cell) {
        rightCell = cell
        break
      }
    }
    if (rightCell) break
  }
  if (!rightCell) return undefined

  const chars = [...line]
  const content = chars.slice(leftCell.charIndex + 1, rightCell.charIndex).join('')
  return {
    leftBorder: leftCell.char,
    content,
    rightBorder: rightCell.char,
    rightCol: rightCell.displayCol,
    leftCol: leftCell.displayCol,
  }
}

/**
 * Collect junction chars from a border line between leftCol and rightCol.
 * Returns a Map from display-column-offset-from-leftCol to junction char.
 */
function collectJunctions(line: string, leftCol: number, rightCol: number): Map<number, string> {
  const junctions = new Map<number, string>()
  const grid = charGrid(line)
  for (const cell of grid) {
    if (cell.displayCol <= leftCol || cell.displayCol >= rightCol) continue
    if (TOP_BORDER_JUNCTIONS.has(cell.char) || BOTTOM_BORDER_JUNCTIONS.has(cell.char) || CROSS_JUNCTIONS.has(cell.char)) {
      junctions.set(cell.displayCol - leftCol, cell.char)
    }
  }
  return junctions
}

// ─────────────────────────────────────────────────────────────
// Fixing
// ─────────────────────────────────────────────────────────────

/**
 * Build a border segment: corner + hChars + corner.
 * Returns a string that is exactly `innerWidth + 2` display columns wide.
 */
function buildBorderSegment(
  leftCorner: string,
  rightCorner: string,
  hChar: string,
  innerWidth: number,
  junctions?: Map<number, string>,
): string {
  let border = leftCorner
  for (let i = 1; i <= innerWidth; i++) {
    const j = junctions?.get(i)
    border += j || hChar
  }
  border += rightCorner
  return border
}

/**
 * Fix alignment of all boxes in a diagram. The top border (┌─┐) defines
 * the target width. Content lines and bottom border are spliced at the
 * box's column range so side-by-side boxes on the same rows don't clobber
 * each other.
 */
export function fixDiagramLines(inputLines: string[]): string[] {
  const lines = [...inputLines]
  const boxes = findBoxes(lines)

  // Sort: innermost (smallest area) first so inner box fixes land before
  // outer boxes process the same lines.
  boxes.sort((a, b) => {
    const areaA = (a.bottomRow - a.topRow) * (a.rightCol - a.leftCol)
    const areaB = (b.bottomRow - b.topRow) * (b.rightCol - b.leftCol)
    return areaA - areaB
  })

  for (const box of boxes) {
    const { topRow, bottomRow, leftCol, rightCol, hChar, corners } = box
    const innerWidth = rightCol - leftCol - 1

    // Fix bottom border — splice only this box's column range.
    // Search ±3 cols for └ to tolerate displaced bottom-left corners.
    const bottomGrid = charGrid(lines[bottomRow]!)
    let blCell = bottomGrid.find((c) => c.displayCol === leftCol && isBottomLeft(c.char))
    if (!blCell) {
      for (let off = 1; off <= 3; off++) {
        for (const col of [leftCol + off, leftCol - off]) {
          const cell = bottomGrid.find((c) => c.displayCol === col && isBottomLeft(c.char))
          if (cell) { blCell = cell; break }
        }
        if (blCell) break
      }
    }
    if (blCell) {
      // Find the actual ┘ by scanning right from └
      let actualBrCol = -1
      for (let i = blCell.charIndex + 1; i < bottomGrid.length; i++) {
        if (isBottomRight(bottomGrid[i]!.char)) {
          actualBrCol = bottomGrid[i]!.displayCol
          break
        }
        if (!isHBorder(bottomGrid[i]!.char)) break
      }
      if (actualBrCol >= 0) {
        const junctions = collectJunctions(lines[bottomRow]!, blCell.displayCol, actualBrCol)
        const segment = buildBorderSegment(corners[2], corners[3], hChar, innerWidth, junctions)
        // Splice from the leftmost of expected vs actual position to the
        // rightmost of actual vs expected, padding both sides.
        const spliceStart = Math.min(leftCol, blCell.displayCol)
        const spliceEnd = Math.max(actualBrCol, rightCol)
        const prefixGap = leftCol > spliceStart ? ' '.repeat(leftCol - spliceStart) : ''
        const extraGap = spliceEnd > rightCol ? ' '.repeat(spliceEnd - rightCol) : ''
        lines[bottomRow] = spliceLine(lines[bottomRow]!, spliceStart, spliceEnd, prefixGap + segment + extraGap)
      }
    }

    // Fix content lines — splice only the box's column range
    for (let r = topRow + 1; r < bottomRow; r++) {
      const extracted = extractBoxContent(lines[r]!, leftCol, rightCol)
      if (!extracted) continue

      // Detect horizontal divider rows (├────┤, ├──┼──┤, etc.)
      const isDivider =
        LEFT_BORDER_JUNCTIONS.has(extracted.leftBorder) &&
        RIGHT_BORDER_JUNCTIONS.has(extracted.rightBorder) &&
        [...extracted.content.replace(/ /g, '')].every((ch) => isHBorder(ch) || CROSS_JUNCTIONS.has(ch))

      let segment: string
      if (isDivider) {
        const dividerJunctions = collectJunctions(
          extracted.leftBorder + extracted.content + extracted.rightBorder,
          0, stringDisplayWidth(extracted.leftBorder + extracted.content + extracted.rightBorder) - 1,
        )
        segment = buildBorderSegment(extracted.leftBorder, extracted.rightBorder, hChar, innerWidth, dividerJunctions)
      } else {
        const trimmedContent = extracted.content.replace(/ +$/, '')
        const contentWidth = stringDisplayWidth(trimmedContent)
        const padding = Math.max(0, innerWidth - contentWidth)
        segment = extracted.leftBorder + trimmedContent + ' '.repeat(padding) + extracted.rightBorder
      }

      // Splice from the leftmost of expected vs actual left border to the
      // rightmost of actual vs expected right border. This ensures displaced
      // left borders (common in side-by-side boxes) get consumed by the splice.
      // Extra spaces pad both sides to preserve suffix positions.
      const spliceStart = Math.min(leftCol, extracted.leftCol)
      const spliceEnd = Math.max(extracted.rightCol, rightCol)
      const prefixGap = leftCol > spliceStart ? ' '.repeat(leftCol - spliceStart) : ''
      const extraGap = spliceEnd > rightCol ? ' '.repeat(spliceEnd - rightCol) : ''
      lines[r] = spliceLine(lines[r]!, spliceStart, spliceEnd, prefixGap + segment + extraGap)
    }
  }

  return lines
}

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────

interface DiagramIssue {
  line: number
  col: number
  message: string
}

/** Default max display width for diagram lines (matches AGENTS.md convention). */
export const DEFAULT_MAX_WIDTH = 94

export function validateDiagram(text: string, opts?: { maxWidth?: number }): DiagramIssue[] {
  const lines = text.split('\n')
  const boxes = findBoxes(lines)
  const issues: DiagramIssue[] = []
  const maxWidth = opts?.maxWidth ?? DEFAULT_MAX_WIDTH

  // Check line width limits for every line in the diagram.
  for (let r = 0; r < lines.length; r++) {
    const width = stringDisplayWidth(lines[r]!)
    if (width > maxWidth) {
      issues.push({
        line: r + 1,
        col: width,
        message: `Line is ${width} cols wide, exceeds max ${maxWidth}`,
      })
    }
  }

  for (const box of boxes) {
    const { topRow, bottomRow, leftCol, rightCol } = box

    // Check bottom border: find └ near leftCol (±3 tolerance), scan right for ┘.
    // Report if └ is displaced or ┘ is not at rightCol.
    const bottomGrid = charGrid(lines[bottomRow]!)
    let blCell = bottomGrid.find((c) => c.displayCol === leftCol && isBottomLeft(c.char))
    if (!blCell) {
      for (let off = 1; off <= 3; off++) {
        for (const col of [leftCol + off, leftCol - off]) {
          const cell = bottomGrid.find((c) => c.displayCol === col && isBottomLeft(c.char))
          if (cell) { blCell = cell; break }
        }
        if (blCell) break
      }
    }
    if (blCell) {
      if (blCell.displayCol !== leftCol) {
        issues.push({
          line: bottomRow + 1,
          col: blCell.displayCol + 1,
          message: `Bottom └ at col ${blCell.displayCol}, expected ${leftCol} (matching ┌)`,
        })
      }
      let brCol = -1
      for (let i = blCell.charIndex + 1; i < bottomGrid.length; i++) {
        if (isBottomRight(bottomGrid[i]!.char)) {
          brCol = bottomGrid[i]!.displayCol
          break
        }
        if (!isHBorder(bottomGrid[i]!.char)) break
      }
      if (brCol >= 0 && brCol !== rightCol) {
        issues.push({
          line: bottomRow + 1,
          col: brCol + 1,
          message: `Bottom ┘ at col ${brCol}, expected ${rightCol} (matching ┐)`,
        })
      }
    } else {
      issues.push({
        line: bottomRow + 1,
        col: leftCol + 1,
        message: `Missing bottom └ near col ${leftCol}`,
      })
    }

    // Check content lines: left border at leftCol, right border at rightCol.
    for (let r = topRow + 1; r < bottomRow; r++) {
      const extracted = extractBoxContent(lines[r]!, leftCol, rightCol)
      if (!extracted) continue
      if (extracted.leftCol !== leftCol) {
        issues.push({
          line: r + 1,
          col: extracted.leftCol + 1,
          message: `Left │ at col ${extracted.leftCol}, expected ${leftCol}`,
        })
      }
      if (extracted.rightCol !== rightCol) {
        issues.push({
          line: r + 1,
          col: extracted.rightCol + 1,
          message: `Right │ at col ${extracted.rightCol}, expected ${rightCol}`,
        })
      }
    }
  }

  return issues
}

/**
 * Markdown-aware validation. Only checks diagram code blocks (or the whole
 * text if it looks like a bare diagram). Prose lines are ignored.
 * Line numbers in returned issues are relative to the full markdown file.
 */
export function validateDiagramsInText(text: string, opts?: { maxWidth?: number }): DiagramIssue[] {
  const lines = text.split('\n')
  const blocks = findCodeBlocks(lines).filter((b) => isDiagramBlock(b.contentLines.join('\n')))

  if (blocks.length === 0) {
    return isDiagramBlock(text) ? validateDiagram(text, opts) : []
  }

  return blocks.flatMap((block) =>
    validateDiagram(block.contentLines.join('\n'), opts).map((issue) => ({
      ...issue,
      line: issue.line + block.startLine, // offset to file-level line number
    })),
  )
}

// ─────────────────────────────────────────────────────────────
// Markdown code block extraction
// ─────────────────────────────────────────────────────────────

const BOX_CHARS = /[┌┐└┘┬┴├┤┼─│━┃═╔╗╚╝╦╩╠╣╬║╭╮╯╰┏┓┗┛┣┫┳┻╋]/

function isDiagramBlock(content: string): boolean {
  return BOX_CHARS.test(content)
}

interface CodeBlock {
  startLine: number
  endLine: number
  contentLines: string[]
}

function findCodeBlocks(markdownLines: string[]): CodeBlock[] {
  const blocks: CodeBlock[] = []
  let inBlock = false
  let fenceChar = ''
  let fenceIndent = 0
  let startLine = 0
  let contentLines: string[] = []

  for (let i = 0; i < markdownLines.length; i++) {
    const line = markdownLines[i]!
    const trimmed = line.trimStart()
    const indent = line.length - trimmed.length

    if (!inBlock) {
      const match = trimmed.match(/^(`{3,}|~{3,})/)
      if (match) {
        inBlock = true
        fenceChar = match[1]![0]!
        fenceIndent = indent
        startLine = i
        contentLines = []
      }
    } else {
      const closingMatch = trimmed.match(/^(`{3,}|~{3,})\s*$/)
      if (closingMatch && closingMatch[1]![0] === fenceChar && indent <= fenceIndent) {
        blocks.push({ startLine, endLine: i, contentLines })
        inBlock = false
      } else {
        contentLines.push(line)
      }
    }
  }

  return blocks
}

/**
 * Process full text (markdown or plain diagram). Fixes alignment in
 * diagram code blocks, or treats the whole text as a diagram if no
 * code fences are found.
 */
export function fixDiagramsInText(text: string): string {
  const lines = text.split('\n')
  const codeBlocks = findCodeBlocks(lines)

  const diagramBlocks = codeBlocks.filter((b) => isDiagramBlock(b.contentLines.join('\n')))

  if (diagramBlocks.length === 0 && isDiagramBlock(text)) {
    return fixDiagramLines(lines).join('\n')
  }

  if (diagramBlocks.length === 0) {
    return text
  }

  const result = [...lines]
  for (let i = diagramBlocks.length - 1; i >= 0; i--) {
    const block = diagramBlocks[i]!
    const fixed = fixDiagramLines(block.contentLines)
    result.splice(block.startLine + 1, block.contentLines.length, ...fixed)
  }

  return result.join('\n')
}

// ─────────────────────────────────────────────────────────────
// CLI command
// ─────────────────────────────────────────────────────────────

/** Count how many lines differ between two strings. */
function countChangedLines(before: string, after: string): number {
  const a = before.split('\n')
  const b = after.split('\n')
  let changed = 0
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    if ((a[i] ?? '') !== (b[i] ?? '')) changed++
  }
  return changed
}

export const diagramsCli = goke()

diagramsCli
  .command('diagrams fix [...files]', 'Fix alignment of Unicode box-drawing diagrams in markdown files')
  .option('--check', 'Validate only (exit 1 if issues found, no changes)')
  .option('--dry-run', 'Print fixed output to stdout instead of writing files')
  .option('--max-width [cols]', `Max display columns per line (default: ${DEFAULT_MAX_WIDTH})`)
  .action(async (files: string[], options, { console: output, process: proc }) => {
    const cwd = proc.cwd
    const maxWidth = options.maxWidth ? Number(options.maxWidth) : DEFAULT_MAX_WIDTH

    /** Print issues and return the count. */
    function reportIssues(issues: DiagramIssue[], label?: string) {
      if (issues.length === 0) return 0
      const widthIssues = issues.filter((i) => i.message.includes('exceeds max'))
      const alignIssues = issues.filter((i) => !i.message.includes('exceeds max'))
      if (label) output.log(logger.warn(`${label}: ${issues.length} issue(s)`))
      for (const issue of alignIssues) {
        output.log(`  line ${issue.line}, col ${issue.col}: ${issue.message}`)
      }
      for (const issue of widthIssues) {
        output.error(`  ${c.red('line ' + issue.line)}: ${issue.message}`)
      }
      return issues.length
    }

    if (files.length === 0) {
      const chunks: Buffer[] = []
      for await (const chunk of process.stdin) {
        chunks.push(chunk)
      }
      const input = Buffer.concat(chunks).toString('utf-8')

      if (options.check) {
        const issues = validateDiagramsInText(input, { maxWidth })
        if (issues.length > 0) {
          reportIssues(issues)
          output.error(logger.error(`Found ${issues.length} issue(s)`))
          return proc.exit(1)
        }
        output.log(logger.success('No issues found'))
        return
      }

      const fixed = fixDiagramsInText(input)
      // After fixing, check for any remaining issues (width violations,
      // overflow content that couldn't be shrunk, etc.)
      const remainingIssues = validateDiagramsInText(fixed, { maxWidth })
      output.log(fixed)
      if (remainingIssues.length > 0) {
        output.error('')
        reportIssues(remainingIssues)
        output.error(logger.error(`${remainingIssues.length} issue(s) remaining after fix. Manual intervention needed.`))
        return proc.exit(1)
      }
      return
    }

    let totalIssues = 0

    for (const file of files) {
      const filePath = path.resolve(cwd, file)

      if (!fs.existsSync(filePath)) {
        output.error(logger.error(`File not found: ${file}`))
        return proc.exit(1)
      }

      const content = fs.readFileSync(filePath, 'utf-8')

      if (options.check) {
        const issues = validateDiagramsInText(content, { maxWidth })
        if (issues.length > 0) {
          totalIssues += reportIssues(issues, file)
        } else {
          output.log(logger.success(`${file}: OK`))
        }
        continue
      }

      const fixed = fixDiagramsInText(content)
      if (options.dryRun) {
        output.log(fixed)
      } else if (fixed !== content) {
        const changedLines = countChangedLines(content, fixed)
        fs.writeFileSync(filePath, fixed, 'utf-8')
        output.log(logger.success(`Fixed: ${file} (${changedLines} line${changedLines === 1 ? '' : 's'} changed)`))
      } else {
        output.log(logger.info(`No changes: ${file}`))
      }

      // After fixing, report any remaining issues (width, alignment, overflow)
      const remainingIssues = validateDiagramsInText(fixed, { maxWidth })
      if (remainingIssues.length > 0) {
        totalIssues += reportIssues(remainingIssues, file)
      }
    }

    if (totalIssues > 0) {
      output.error(logger.error(`${totalIssues} issue(s) remaining after fix. Manual intervention needed.`))
      return proc.exit(1)
    }
    if (options.check) {
      output.log(logger.success('All files OK'))
    }
  })
