'use client'

import React, { useEffect, useRef, useState } from 'react'
import { CodeBlock } from '../code-block.tsx'

/**
 * Mermaid diagram renderer — detects dark mode from <html class="dark">
 * and re-renders when the theme toggles. The mermaid library is re-initialized
 * on every theme change because it bakes the theme into the rendered SVG.
 */
export function Mermaid({ chart }: { chart: string; placement?: string; actions?: boolean }) {
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const renderIdRef = useRef<string | null>(null)
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  )
  if (!renderIdRef.current) {
    renderIdRef.current = `mermaid-${Math.random().toString(36).slice(2, 10)}`
  }

  // Watch <html> class changes to detect dark/light toggles
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    // sync in case SSR mismatched
    setIsDark(document.documentElement.classList.contains('dark'))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    const renderId = renderIdRef.current!

    async function renderDiagram() {
      try {
        const { default: mermaid } = await import('mermaid')
        // Re-initialize every time because theme is baked into the SVG output
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: isDark ? 'dark' : 'neutral',
        })

        const { svg } = await mermaid.render(renderId, chart)
        if (!cancelled) {
          setSvg(svg)
          setFailed(false)
        }
      } catch {
        if (!cancelled) {
          setFailed(true)
        }
      }
    }

    setSvg(null)
    setFailed(false)
    void renderDiagram()

    return () => {
      cancelled = true
    }
  }, [chart, isDark])

  if (!svg) {
    if (failed) {
      return (
        <div className='no-bleed'>
          <CodeBlock lang='diagram' lineHeight='1.5' showLineNumbers={false}>
            {chart}
          </CodeBlock>
        </div>
      )
    }

    return (
      <div className='no-bleed rounded-lg border border-border-subtle bg-card px-4 py-3 text-sm text-muted-foreground'>
        Rendering diagram...
      </div>
    )
  }

  return (
    <div className='no-bleed rounded-lg border border-border-subtle bg-card p-3'>
      <div
        data-mermaid-diagram
        className='overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full'
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}
