'use client'

/**
 * CodeBlock with Prism syntax highlighting and line numbers.
 *
 * Prism is lazy-loaded via dynamic import() so the ~891KB bundle doesn't
 * block initial page render. First paint shows unhighlighted code (same as
 * SSR output), then highlighting appears once Prism finishes loading.
 * The module is cached after first load so subsequent code blocks highlight
 * instantly.
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { bleedClass, hasLeftBleed, type BleedMode } from '../../lib/code-meta.ts'

function CopyIcon() {
  return (
    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <rect x='9' y='9' width='13' height='13' rx='2' ry='2' />
      <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <polyline points='20 6 9 17 4 12' />
    </svg>
  )
}

/**
 * Parse a highlight range string like "1-3,7,10-12" into a Set of 1-based
 * line numbers. Returns undefined when no valid lines are found so the
 * highlight overlay is skipped entirely for malformed values.
 */
function parseHighlightLines(value: string, lineCount: number): Set<number> | undefined {
  const result = new Set<number>()
  for (const part of value.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const match = /^(\d+)(?:-(\d+))?$/.exec(trimmed)
    if (!match) return undefined
    const start = Number(match[1])
    const end = Number(match[2] ?? match[1])
    if (start < 1 || end < start) return undefined
    for (let i = start; i <= Math.min(end, lineCount); i++) result.add(i)
  }
  return result.size > 0 ? result : undefined
}

export function CodeBlock({
  children,
  lang = 'jsx',
  lineHeight: lineHeightProp,
  showLineNumbers = true,
  bleed = false,
  title,
  highlight,
}: {
  children: string
  lang?: string
  lineHeight?: string
  /** Show line numbers on the left. On by default, disable with `lines=false`. */
  showLineNumbers?: boolean
  /**
   * How far the block extends past its content column:
   * - `'both'` / `true`: bleed into both margins.
   * - `'right'`: bleed into the right margin only.
   * - `'none'` / `false`: stay fully inside the parent (the default).
   */
  bleed?: boolean | BleedMode
  /** Filename or label shown above the code block. */
  title?: string
  /** Comma-separated line numbers/ranges to highlight, e.g. "1-3,7". */
  highlight?: string
}) {
  const lineHeight = lineHeightProp ?? (lang === 'diagram' ? '1.3' : '1.6')
  const lines = children.split('\n')
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(children).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => { /* clipboard write failed (insecure context, denied permission) */ },
    )
  }, [children])
  const highlightLines = useMemo(
    () => highlight ? parseHighlightLines(highlight, lines.length) : undefined,
    [highlight, lines.length],
  )

  // Prism is lazy-loaded so the ~891KB bundle doesn't block first paint.
  // SSR returns null (unhighlighted), client loads Prism then re-renders.
  const [highlightedHtml, setHighlightedHtml] = useState<string | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    import('#prism').then(({ Prism }) => {
      if (cancelled) return
      const prismLang = lang === 'mdx' ? 'markdown' : lang
      const grammar = prismLang ? Prism.languages[prismLang] : undefined
      if (!grammar) return
      setHighlightedHtml(Prism.highlight(children, grammar, prismLang))
    })
    return () => { cancelled = true }
  }, [children, lang])

  const bleedClassName = bleedClass(bleed)
  const leftBleed = hasLeftBleed(bleed)

  /* The figure is the positioning context for the copy button so that
     --code-block-padding-* is respected: the button sits in the top-right
     of the padded frame, not relative to the inner code content.
     The inner code div keeps `relative` for the highlight overlay so it
     stays scoped to the code area (not offset by the title). */
  return (
    <figure
      className={`group/code relative m-0${bleedClassName ? ` ${bleedClassName}` : ''}`}
      style={{
        background: 'var(--code-block-background)',
        border: 'var(--code-block-border)',
        borderRadius: 'var(--code-block-radius)',
        paddingLeft: 'var(--code-block-padding-x)',
        paddingRight: 'var(--code-block-padding-x)',
        paddingTop: 'var(--code-block-padding-y)',
        paddingBottom: 'var(--code-block-padding-y)',
      }}
    >
      {title && (
        <div
          className='font-mono pb-1'
          style={{
            fontSize: 'var(--code-font-size)',
            color: 'var(--muted-foreground)',
            // Align title with code text start. With border-box the flex
            // item width equals the total gutter space (padding included).
            paddingLeft: showLineNumbers ? (leftBleed ? 'var(--bleed)' : '26px') : undefined,
            // Reserve space for the copy button so long titles don't overlap it.
            paddingRight: '36px',
          }}
        >
          {title}
        </div>
      )}
      <div
        className='relative'
        style={{
          fontFamily: 'var(--font-code)',
          fontSize: 'var(--type-code-size)',
          lineHeight,
        }}
      >
        <pre
          className='overflow-x-auto scrollbar-none'
          style={{ margin: 0 }}
        >
          <div
            className='flex'
            style={{
              fontWeight: 'var(--weight-regular)',
              letterSpacing: 'normal',
              color: 'var(--foreground)',
              tabSize: 2,
            }}
          >
            {showLineNumbers && (
              <span
                className='select-none shrink-0'
                aria-hidden='true'
                style={{
                  color: 'var(--text-tertiary)',
                  textAlign: 'right',
                  paddingRight: leftBleed ? 'var(--bleed)' : '16px',
                  width: leftBleed ? 'var(--bleed)' : '26px',
                  overflow: 'hidden',
                  userSelect: 'none',
                }}
              >
                {lines.map((_, i) => {
                  return (
                    <span key={i} className='block'>
                      {i + 1}
                    </span>
                  )
                })}
              </span>
            )}
            {highlightedHtml ? (
              <code
                className={lang ? `language-${lang}` : undefined}
                style={{ whiteSpace: 'pre', background: 'none', padding: 0, lineHeight }}
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            ) : (
              <code
                className={lang ? `language-${lang}` : undefined}
                style={{ whiteSpace: 'pre', background: 'none', padding: 0, lineHeight }}
              >
                {children}
              </code>
            )}
          </div>
        </pre>
        {/* Highlight overlay: per-line background strips that dim non-highlighted
            lines. Positioned relative to the inner code div (not the figure)
            so the title height is excluded. */}
        {highlightLines && (
          <div
            aria-hidden='true'
            className='absolute inset-0 pointer-events-none'
          >
            {lines.map((_, i) => (
              <div
                key={i}
                style={{
                  height: '1lh',
                  background: highlightLines.has(i + 1) ? 'transparent' : 'var(--background)',
                  opacity: highlightLines.has(i + 1) ? 0 : 0.4,
                }}
              />
            ))}
          </div>
        )}
      </div>
      {/* Copy button — positioned relative to the figure so it respects
          --code-block-padding-*. Sits in the top-right of the padded frame. */}
      <button
        type='button'
        onClick={handleCopy}
        aria-label='Copy code'
        className='absolute z-10 flex size-[28px] cursor-pointer items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-0 backdrop-blur-sm transition-all hover:text-foreground group-hover/code:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        style={{
          opacity: copied ? 1 : undefined,
          top: 'var(--code-block-padding-y)',
          right: 'calc(var(--code-block-padding-x) + 4px)',
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </figure>
  )
}
