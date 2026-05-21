'use client'

/**
 * CodeBlock with Prism syntax highlighting and line numbers.
 *
 * Prism is loaded via `#prism` conditional import: the browser gets real
 * prismjs with all grammars registered; SSR/RSC get a noop stub that returns
 * unhighlighted text. This avoids bundling prismjs (~500KB) in the server
 * build and sidesteps the CJS global issue in Dynamic Workers.
 */

import React, { useMemo } from 'react'
import { Prism } from '#prism'

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
  /** Extend code block into the margins. Off by default, enable with `bleed` meta flag. */
  bleed?: boolean
  /** Filename or label shown above the code block. */
  title?: string
  /** Comma-separated line numbers/ranges to highlight, e.g. "1-3,7". */
  highlight?: string
}) {
  const lineHeight = lineHeightProp ?? (lang === 'diagram' ? '1.3' : '1.6')
  const lines = children.split('\n')
  const highlightLines = useMemo(
    () => highlight ? parseHighlightLines(highlight, lines.length) : undefined,
    [highlight, lines.length],
  )

  /* Use Prism.highlight() to get highlighted HTML as a string. Works on both
     server and client (no DOM dependency), avoiding hydration mismatch issues
     that occur with useEffect + highlightElement. */
  const highlightedHtml = useMemo(() => {
    const prismLang = lang === 'mdx' ? 'markdown' : lang
    const grammar = prismLang ? Prism.languages[prismLang] : undefined
    if (!grammar) {
      return undefined
    }
    return Prism.highlight(children, grammar, prismLang)
  }, [children, lang])

  return (
    <figure className={`m-0 py-2${bleed ? ' bleed' : ' bleed-right'}`}>
      {title && (
        <div
          className='font-mono pb-1'
          style={{
            fontSize: 'var(--code-font-size)',
            color: 'var(--muted-foreground)',
            // Align title with code text start. With border-box the flex
            // item width equals the total gutter space (padding included).
            paddingLeft: showLineNumbers ? (bleed ? 'var(--bleed)' : '26px') : undefined,
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
          style={{
            // borderRadius: 'var(--border-radius-md)',
            margin: 0,
          }}
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
                  paddingRight: bleed ? 'var(--bleed)' : '16px',
                  width: bleed ? 'var(--bleed)' : '26px',
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
            lines. Inherits font-size and line-height from the parent so each
            strip at height=1lh aligns perfectly with one code line. */}
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
    </figure>
  )
}
