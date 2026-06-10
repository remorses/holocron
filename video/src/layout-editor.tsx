/**
 * Layout editor for the video player.
 *
 * Lets users visually drag, scale, and edit text on elements inside the
 * Remotion Player. All spatial changes are applied via CSS transform
 * (translate + scale). Double-click text to edit inline.
 *
 * Changes are tracked per-element using safe-mdx's `data-markdown-line`
 * attribute, then serialized as structured text for an agent to apply.
 *
 * Keyboard: Esc = select parent (deselect at root), Ctrl+Z = undo.
 *
 * Bug-fix notes (from oracle review, commit 1158b916):
 * - Undo stores a snapshot of the previous ElementChange so restoring
 *   doesn't delete the change entirely (was: changesRef.current.delete).
 * - attachMoveable uses a generation counter ref to guard against stale
 *   async import resolutions (race between disable/new-select and import).
 * - Text edit keydown uses a named handler removed in the blur cleanup.
 * - finishTextEdit() is extracted and called from the !editing cleanup
 *   effect so toggling editing off mid-text-edit cleans up properly.
 * - Moveable instance is destroyed on unmount via a dedicated useEffect.
 * - Clipboard "Copied!" timeout is tracked in a ref and cleared on unmount.
 * - Moveable constructor cast cleaned up (kept hand-written interfaces
 *   because react-moveable types are not installed as a dependency).
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// ── Moveable types ─────────────────────────────────────────────────────
// Hand-written because react-moveable (which moveable re-exports types
// from) is not installed. These cover the subset we use.

interface MoveableEvent { target: HTMLElement | SVGElement; transform: string }

interface MoveableScaleEvent {
  target: HTMLElement | SVGElement
  scale: number[]
  drag: { transform: string }
}

interface MoveableInstance {
  on(event: 'dragStart', handler: (e: MoveableEvent) => void): MoveableInstance
  on(event: 'drag', handler: (e: MoveableEvent) => void): MoveableInstance
  on(event: 'scaleStart', handler: (e: MoveableEvent) => void): MoveableInstance
  on(event: 'scale', handler: (e: MoveableScaleEvent) => void): MoveableInstance
  destroy(): void
}

interface MoveableConstructor {
  new(parent: HTMLElement, opts: Record<string, unknown>): MoveableInstance
}

// ── Types ──────────────────────────────────────────────────────────────

type ElementKind = 'text' | 'image' | 'video' | 'audio' | 'code' | 'svg' | 'canvas' | 'element'

interface ElementChange {
  mdxLine: number | null
  kind: ElementKind
  translateX: number
  translateY: number
  scaleX: number
  scaleY: number
  textContent: string | null
  originalTextContent: string | null
  textPreview: string
  tagName: string
}

interface UndoEntry {
  el: HTMLElement
  transform: string
  position: string
  /** Snapshot of the ElementChange before this action, or null if none existed */
  prevChange: ElementChange | null
}

export interface SectionMeta {
  heading: string | null
  durationInFrames: number
}

// ── Helpers ────────────────────────────────────────────────────────────

function isTextElement(el: HTMLElement): boolean {
  return el.children.length === 0 && (el.textContent?.trim().length ?? 0) > 0
}

function findMdxLine(el: HTMLElement, boundary: HTMLElement): number | null {
  let cur: HTMLElement | null = el
  while (cur && boundary.contains(cur)) {
    const v = cur.getAttribute('data-markdown-line')
    if (v) return parseInt(v, 10)
    cur = cur.parentElement
  }
  return null
}

function classifyElement(el: HTMLElement): ElementKind {
  const tag = el.tagName.toLowerCase()
  if (tag === 'img' || tag === 'picture') return 'image'
  if (tag === 'video') return 'video'
  if (tag === 'audio') return 'audio'
  if (tag === 'svg') return 'svg'
  if (tag === 'canvas') return 'canvas'
  if (tag === 'pre' || tag === 'code') return 'code'
  if (el.querySelector('img, picture')) return 'image'
  if (el.querySelector('video')) return 'video'
  if (el.querySelector('canvas')) return 'canvas'
  if (el.querySelector('pre, code')) return 'code'
  // Text: has meaningful text content and no non-text media children
  if ((el.textContent?.trim().length ?? 0) > 0 && !el.querySelector('img, video, canvas, svg:not([aria-hidden])')) {
    return 'text'
  }
  return 'element'
}

function preview(el: HTMLElement): string {
  const t = (el.textContent ?? '').trim()
  return t.length > 60 ? t.slice(0, 60) + '…' : t
}

function hasChange(c: ElementChange): boolean {
  return c.translateX !== 0 || c.translateY !== 0
    || c.scaleX !== 1 || c.scaleY !== 1
    || c.textContent !== null
}

function cloneChange(c: ElementChange): ElementChange {
  return { ...c }
}

/** Derive which section the current frame falls in */
function getCurrentSection(frame: number, sections: SectionMeta[]): SectionMeta | null {
  let acc = 0
  for (const s of sections) {
    if (frame < acc + s.durationInFrames) return s
    acc += s.durationInFrames
  }
  return sections.length > 0 ? sections[sections.length - 1]! : null
}

// ── Serialization ──────────────────────────────────────────────────────

function serializeChanges(
  changes: Map<HTMLElement, ElementChange>,
  currentFrame: number | null,
  fps: number,
  sections: SectionMeta[],
): string {
  const entries = Array.from(changes.values()).filter(hasChange)
  if (entries.length === 0) return ''

  const parts: string[] = ['## Layout changes\n']

  // Frame + section context
  if (currentFrame !== null) {
    const seconds = (currentFrame / fps).toFixed(1)
    parts.push(`Current frame: ${currentFrame} (${seconds}s at ${fps}fps)`)

    const section = getCurrentSection(currentFrame, sections)
    if (section?.heading) {
      parts.push(`Section: "${section.heading}"`)
    }
    parts.push('')
  }

  for (const c of entries) {
    const line = c.mdxLine !== null ? ` (line ${c.mdxLine})` : ''
    const text = c.kind === 'text' && c.textPreview ? `: "${c.textPreview}"` : ''
    parts.push(`**${c.kind}**${line}${text}`)

    if (c.translateX !== 0 || c.translateY !== 0) {
      const x = `${c.translateX > 0 ? '+' : ''}${Math.round(c.translateX)}px`
      const y = `${c.translateY > 0 ? '+' : ''}${Math.round(c.translateY)}px`
      parts.push(`- Move: x=${x}, y=${y}`)
    }
    if (c.scaleX !== 1 || c.scaleY !== 1) {
      parts.push(`- Scale: ${c.scaleX.toFixed(2)}x, ${c.scaleY.toFixed(2)}y`)
    }
    if (c.textContent !== null && c.originalTextContent !== null) {
      parts.push(`- Text: "${c.originalTextContent}" -> "${c.textContent}"`)
    }
    parts.push('')
  }
  return parts.join('\n')
}

// ── Toolbar button ─────────────────────────────────────────────────────

function ToolbarButton({ onClick, active, children, title }: {
  onClick: () => void; active?: boolean; children: React.ReactNode; title?: string
}) {
  return (
    <button
      type='button' onClick={onClick} title={title}
      className={[
        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors cursor-pointer',
        active
          ? 'bg-sky-200 text-sky-950'
          : 'text-zinc-300 hover:bg-white/10',
      ].join(' ')}
    >{children}</button>
  )
}

// ── Main component ─────────────────────────────────────────────────────

export function LayoutEditor({ playerContainerRef, playerRef, editing, onEditingChange, onReset, sections, fps }: {
  playerContainerRef: React.RefObject<HTMLElement | null>
  playerRef: React.RefObject<{ getCurrentFrame: () => number; addEventListener: (name: any, cb: any) => void; removeEventListener: (name: any, cb: any) => void } | null>
  editing: boolean
  onEditingChange: (editing: boolean) => void
  onReset: () => void
  sections: SectionMeta[]
  fps: number
}) {
  const [selectedEl, setSelectedEl] = useState<HTMLElement | null>(null)
  const [changesCount, setChangesCount] = useState(0)
  const [copied, setCopied] = useState(false)

  const moveableRef = useRef<MoveableInstance | null>(null)
  const changesRef = useRef<Map<HTMLElement, ElementChange>>(new Map())
  const textEditRef = useRef<HTMLElement | null>(null)
  const undoStack = useRef<UndoEntry[]>([])
  /** Generation counter to guard against stale async import resolutions */
  const moveableGenRef = useRef(0)
  /** Timeout ID for the "Copied!" indicator reset */
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getPlayer = useCallback((): HTMLElement | null => {
    return playerContainerRef.current?.querySelector('.__remotion-player') as HTMLElement | null
  }, [playerContainerRef])

  const isSelectable = useCallback((el: HTMLElement, player: HTMLElement): boolean => {
    if (el.className?.includes?.('moveable-')) return false
    const d = getComputedStyle(el).display
    if (!['block', 'flex', 'grid', 'inline-block'].includes(d)) return false
    if (el.offsetHeight <= 10 || el.offsetWidth <= 20) return false
    const r = el.getBoundingClientRect()
    const p = player.getBoundingClientRect()
    if (Math.abs(r.width - p.width) < 5 && Math.abs(r.height - p.height) < 5) return false
    return true
  }, [])

  const findTarget = useCallback((el: HTMLElement): HTMLElement | null => {
    const player = getPlayer()
    if (!player?.contains(el)) return null
    let cur: HTMLElement | null = el
    while (cur && player.contains(cur)) {
      if (isSelectable(cur, player)) return cur
      cur = cur.parentElement
    }
    return null
  }, [getPlayer, isSelectable])

  function countChanges(): number {
    let n = 0
    for (const c of changesRef.current.values()) if (hasChange(c)) n++
    return n
  }

  // ── Finish text editing (extracted so it can be called from !editing cleanup) ──

  const finishTextEdit = useCallback(() => {
    const target = textEditRef.current
    if (!target) return
    target.contentEditable = 'false'
    target.style.outline = ''
    target.style.outlineOffset = ''
    const c = changesRef.current.get(target)
    if (c && target.textContent !== c.originalTextContent) {
      c.textContent = target.textContent ?? ''
    }
    textEditRef.current = null
    setChangesCount(countChanges())
  }, [])

  // ── Attach Moveable (drag + scale, all via transform) ──

  const attachMoveable = useCallback(async (target: HTMLElement) => {
    moveableRef.current?.destroy()
    moveableRef.current = null
    const container = playerContainerRef.current

    // Increment generation before the async import
    const gen = ++moveableGenRef.current

    const mod = await import('moveable')

    // Bail if editing was disabled or a newer selection happened during import
    if (moveableGenRef.current !== gen) return

    const Cls = mod.default as unknown as MoveableConstructor
    const m = new Cls(container ?? document.body, {
      target,
      draggable: true,
      scalable: true,
      keepRatio: true,
      origin: false,
      throttleDrag: 1,
      throttleScale: 0.01,
      renderDirections: ['nw', 'ne', 'sw', 'se'],
      edge: false,
      zoom: 1,
    })

    if (getComputedStyle(target).position === 'static') {
      target.style.position = 'relative'
    }

    if (!changesRef.current.has(target)) {
      const player = getPlayer()
      changesRef.current.set(target, {
        mdxLine: findMdxLine(target, player ?? document.body),
        kind: classifyElement(target),
        translateX: 0, translateY: 0,
        scaleX: 1, scaleY: 1,
        textContent: null, originalTextContent: null,
        textPreview: preview(target),
        tagName: target.tagName.toLowerCase(),
      })
    }

    m.on('dragStart', ({ target: el }) => {
      const htmlEl = el as HTMLElement
      const existing = changesRef.current.get(htmlEl)
      undoStack.current.push({
        el: htmlEl,
        transform: htmlEl.style.transform,
        position: htmlEl.style.position,
        prevChange: existing ? cloneChange(existing) : null,
      })
    })

    m.on('drag', ({ target: el, transform }) => {
      const htmlEl = el as HTMLElement
      htmlEl.style.transform = transform
      const c = changesRef.current.get(htmlEl)
      if (c) {
        const m = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
        if (m) { c.translateX = parseFloat(m[1]!); c.translateY = parseFloat(m[2]!) }
        setChangesCount(countChanges())
      }
    })

    m.on('scaleStart', ({ target: el }) => {
      const htmlEl = el as HTMLElement
      const existing = changesRef.current.get(htmlEl)
      undoStack.current.push({
        el: htmlEl,
        transform: htmlEl.style.transform,
        position: htmlEl.style.position,
        prevChange: existing ? cloneChange(existing) : null,
      })
    })

    m.on('scale', ({ target: el, scale, drag }) => {
      const htmlEl = el as HTMLElement
      htmlEl.style.transform = drag.transform
      const c = changesRef.current.get(htmlEl)
      if (c) {
        c.scaleX = scale[0]!
        c.scaleY = scale[1]!
        const mt = drag.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
        if (mt) { c.translateX = parseFloat(mt[1]!); c.translateY = parseFloat(mt[2]!) }
        setChangesCount(countChanges())
      }
    })

    moveableRef.current = m
    setSelectedEl(target)
  }, [playerContainerRef, getPlayer])

  // ── Double-click to edit text ──

  const handleDoubleClick = useCallback((e: MouseEvent) => {
    if (!editing) return
    const player = getPlayer()
    if (!player?.contains(e.target as Node)) return

    // For text editing, try the actual clicked element first (the leaf text
    // node), then walk up. findTarget walks up to a selectable parent which
    // is often a container div — that fails isTextElement because it has
    // children. We want the innermost text-bearing element.
    let target: HTMLElement | null = null
    let cur: HTMLElement | null = e.target as HTMLElement
    while (cur && player.contains(cur)) {
      if (isTextElement(cur)) { target = cur; break }
      cur = cur.parentElement
    }
    // Fall back to selectable parent if no leaf text found
    if (!target) target = findTarget(e.target as HTMLElement)
    if (!target || !isTextElement(target)) return

    e.preventDefault()
    e.stopPropagation()

    // Invalidate any in-flight attachMoveable async imports so they bail
    // after resolving. A double-click fires click→click→dblclick; the second
    // click starts attachMoveable whose import may resolve after we enter
    // text edit mode, causing a __CROACT__ null error in Moveable's renderer.
    moveableGenRef.current++
    moveableRef.current?.destroy()
    moveableRef.current = null
    textEditRef.current = target

    const change = changesRef.current.get(target)
    if (change && change.originalTextContent === null) {
      change.originalTextContent = target.textContent ?? ''
    }

    target.contentEditable = 'true'
    target.focus()
    target.style.outline = '2px solid #7dd3fc'
    target.style.outlineOffset = '2px'

    const range = document.createRange()
    range.selectNodeContents(target)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    // Named handler so we can remove it in cleanup
    const onEscapeKey = (ke: KeyboardEvent) => { if (ke.key === 'Escape') target.blur() }

    const finish = () => {
      target.removeEventListener('keydown', onEscapeKey)
      finishTextEdit()
    }
    target.addEventListener('blur', finish, { once: true })
    target.addEventListener('keydown', onEscapeKey)
  }, [editing, findTarget, finishTextEdit])

  // ── Click to select ──

  const handleClick = useCallback((e: MouseEvent) => {
    if (!editing || textEditRef.current) return
    if ((e.target as HTMLElement).closest('[data-layout-editor-toolbar]')) return
    if ((e.target as HTMLElement).className?.includes?.('moveable-')) return

    // Click outside player container → deselect
    if (!playerContainerRef.current?.contains(e.target as Node)) {
      if (selectedEl) {
        moveableRef.current?.destroy()
        moveableRef.current = null
        setSelectedEl(null)
      }
      return
    }

    const target = findTarget(e.target as HTMLElement)
    if (target) {
      e.preventDefault()
      e.stopPropagation()
      void attachMoveable(target)
    } else if (selectedEl) {
      // Clicked inside player but not on a selectable element → deselect
      moveableRef.current?.destroy()
      moveableRef.current = null
      setSelectedEl(null)
    }
  }, [editing, selectedEl, findTarget, attachMoveable, playerContainerRef])

  // ── Keyboard: Esc (select parent / deselect), Ctrl+Z (undo) ──

  useEffect(() => {
    if (!editing) return
    const player = getPlayer()

    const onKey = (e: KeyboardEvent) => {
      if (textEditRef.current) return

      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault()
        const entry = undoStack.current.pop()
        if (entry) {
          entry.el.style.transform = entry.transform
          entry.el.style.position = entry.position
          // Restore previous change snapshot instead of deleting entirely
          if (entry.prevChange) {
            changesRef.current.set(entry.el, entry.prevChange)
          } else {
            changesRef.current.delete(entry.el)
          }
          setChangesCount(countChanges())
          if (selectedEl === entry.el) void attachMoveable(entry.el)
        }
        return
      }

      if (e.key === 'Escape') {
        if (!selectedEl || !player) {
          moveableRef.current?.destroy()
          moveableRef.current = null
          setSelectedEl(null)
          return
        }
        let parent: HTMLElement | null = selectedEl.parentElement
        while (parent && player.contains(parent)) {
          if (isSelectable(parent, player)) { void attachMoveable(parent); return }
          parent = parent.parentElement
        }
        moveableRef.current?.destroy()
        moveableRef.current = null
        setSelectedEl(null)
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [editing, selectedEl, getPlayer, isSelectable, attachMoveable])

  // ── Deselect on player seek ──

  useEffect(() => {
    if (!editing) return
    const player = playerRef.current
    if (!player) return
    const onSeek = () => {
      moveableRef.current?.destroy()
      moveableRef.current = null
      setSelectedEl(null)
    }
    player.addEventListener('seeked', onSeek)
    return () => player.removeEventListener('seeked', onSeek)
  }, [editing, playerRef])

  // ── Listeners lifecycle ──

  useEffect(() => {
    if (!editing) return
    document.addEventListener('click', handleClick, true)
    document.addEventListener('dblclick', handleDoubleClick, true)
    return () => {
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('dblclick', handleDoubleClick, true)
    }
  }, [editing, handleClick, handleDoubleClick])

  // ── Cleanup when editing is toggled off ──

  useEffect(() => {
    if (!editing) {
      // Increment generation to invalidate any in-flight attachMoveable
      moveableGenRef.current++
      moveableRef.current?.destroy()
      moveableRef.current = null
      setSelectedEl(null)
      // Clean up any active text edit
      finishTextEdit()
    }
  }, [editing, finishTextEdit])

  // ── Destroy moveable on unmount ──

  useEffect(() => {
    return () => {
      moveableRef.current?.destroy()
      moveableRef.current = null
    }
  }, [])

  // ── Clear copied timeout on unmount ──

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current !== null) {
        clearTimeout(copiedTimeoutRef.current)
      }
    }
  }, [])

  // ── Actions ──

  const handleCopy = useCallback(async () => {
    const currentFrame = playerRef.current?.getCurrentFrame() ?? null
    const text = serializeChanges(changesRef.current, currentFrame, fps, sections)
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    if (copiedTimeoutRef.current !== null) {
      clearTimeout(copiedTimeoutRef.current)
    }
    copiedTimeoutRef.current = setTimeout(() => {
      setCopied(false)
      copiedTimeoutRef.current = null
    }, 2000)
  }, [playerRef, fps, sections])

  const handleReset = useCallback(() => {
    moveableRef.current?.destroy()
    moveableRef.current = null
    changesRef.current.clear()
    undoStack.current = []
    setChangesCount(0)
    setSelectedEl(null)
    onReset()
  }, [onReset])

  const info = selectedEl ? changesRef.current.get(selectedEl) : null

  return (
    <div data-layout-editor-toolbar className='flex items-center gap-1.5 text-[13px]'>
      <ToolbarButton onClick={() => onEditingChange(!editing)} active={editing}
        title={editing ? 'Exit editing mode' : 'Edit layout — click to select, drag to move, corners to scale, double-click text to edit'}>
        {editing ? '✦ Editing' : '✦ Edit Layout'}
      </ToolbarButton>

      {editing && info && (
        <span className='text-zinc-500 max-w-[200px] truncate'>
          {info.kind}{info.mdxLine !== null ? ` :${info.mdxLine}` : ''}
        </span>
      )}

      {editing && changesCount > 0 && (
        <>
          <ToolbarButton onClick={handleCopy} title='Copy changes for an AI agent'>
            {copied ? 'Copied!' : `Copy ${changesCount} change${changesCount > 1 ? 's' : ''}`}
          </ToolbarButton>
          <ToolbarButton onClick={handleReset} title='Revert all changes'>
            Reset
          </ToolbarButton>
        </>
      )}

      {editing && !selectedEl && (
        <span className='text-zinc-600 italic'>Click an element</span>
      )}
    </div>
  )
}
