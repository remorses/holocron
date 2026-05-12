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

export function CodeBlock({
  children,
  lang = 'jsx',
  lineHeight = '1.6',
  showLineNumbers = true,
}: {
  children: string
  lang?: string
  lineHeight?: string
  showLineNumbers?: boolean
}) {
  const lines = children.split('\n')

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
    <figure className='m-0 bleed'>
      <div className='relative'>
        <pre
          className='overflow-x-auto scrollbar-none'
          style={{
            // borderRadius: 'var(--border-radius-md)',
            margin: 0,
            padding: 0,
          }}
        >
          <div
            className='flex'
            style={{
              fontFamily: 'var(--font-code)',
              fontSize: 'var(--type-code-size)',
              fontWeight: 'var(--weight-regular)',
              lineHeight,
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
                  paddingRight: 'var(--bleed)',
                  width: 'var(--bleed)',
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
      </div>
    </figure>
  )
}
