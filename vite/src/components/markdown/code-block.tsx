'use client'

/**
 * CodeBlock with Prism syntax highlighting and line numbers.
 * Also registers a custom "diagram" language for ASCII/Unicode box-drawing.
 */

import React, { useMemo } from 'react'
import * as PrismModule from 'prismjs'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'

const Prism = ((PrismModule as { default?: unknown }).default ?? PrismModule) as typeof PrismModule

/* Custom "diagram" language for ASCII/Unicode box-drawing diagrams.
   Tokenizes box-drawing chars as neutral structure, text as highlighted labels. */
Prism.languages.diagram = {
  'box-drawing': /[┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬╭╮╯╰┊┈╌┄╶╴╵╷]+/,
  'line-char': /[-_|<>]+/,
  label: /[^\s┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬╭╮╯╰┊┈╌┄╶╴╵╷\-_|<>]+/,
}

export function CodeBlock({
  children,
  lang = 'jsx',
  lineHeight = '1.6',
  showLineNumbers = true,
  bleed = true,
}: {
  children: string
  lang?: string
  lineHeight?: string
  showLineNumbers?: boolean
  bleed?: boolean
}) {
  const lines = children.split('\n')
  const lineNumberDigits = String(lines.length).length
  const lineNumberWidth = `${lineNumberDigits}ch`
  const lineNumberGap = lineNumberDigits > 2 ? '18px' : '16px'
  const leftPadding = bleed && showLineNumbers
    ? `calc(var(--bleed) - ${lineNumberWidth} - ${lineNumberGap})`
    : '6px'

  /* Use Prism.highlight() to get highlighted HTML as a string. Works on both
     server and client (no DOM dependency), avoiding hydration mismatch issues
     that occur with useEffect + highlightElement. */
  const highlightedHtml = useMemo(() => {
    const grammar = lang ? Prism.languages[lang] : undefined
    if (!grammar) {
      return undefined
    }
    return Prism.highlight(children, grammar, lang)
  }, [children, lang])

  return (
    <figure className={`m-0 ${bleed ? 'bleed' : ''}`.trim()}>
      <div className='relative'>
        <pre
          className='overflow-x-auto'
          style={{
            borderRadius: 'var(--border-radius-md)',
            margin: 0,
            padding: 0,
          }}
        >
          <div
            className='flex'
            style={{
              paddingTop: '10px',
              paddingRight: '8px',
              paddingBottom: '10px',
              paddingLeft: leftPadding,
              fontFamily: 'var(--font-code)',
              fontSize: 'var(--type-code-size)',
              fontWeight: 'var(--weight-regular)',
              lineHeight,
              letterSpacing: 'normal',
              color: 'var(--text-primary)',
              tabSize: 2,
              gap: showLineNumbers ? lineNumberGap : '0px',
            }}
          >
            {showLineNumbers && (
              <span
                className='select-none shrink-0'
                aria-hidden='true'
                style={{
                  color: 'var(--code-line-nr)',
                  textAlign: 'right',
                  width: lineNumberWidth,
                  userSelect: 'none',
                  fontVariantNumeric: 'tabular-nums',
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
      </div>
    </figure>
  )
}
