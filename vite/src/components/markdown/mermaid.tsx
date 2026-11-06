'use client'

import React, { useEffect, useRef, useState } from 'react'
import { CodeBlock } from './code-block.tsx'

/**
 * Mermaid diagram rendered in the browser by pele (https://pele.run).
 * pele measures labels with canvas, re-lays out on resize and draws with CSS
 * variables, so the `.mermaid-diagram` theme in editorial.css follows dark mode
 * without re-rendering. Only the diagram types a page uses are loaded.
 */

type MermaidProps = {
  chart: string
  /** Zoom controls position: top-left, top-right, bottom-left or bottom-right (default). */
  placement?: string
  actions?: boolean
}

export function Mermaid({ chart, placement, actions }: MermaidProps) {
  // Keyed so an edited chart (HMR) starts with a clean pele mount and error state.
  return <MermaidDiagram key={chart} chart={chart} placement={placement} actions={actions} />
}

function MermaidDiagram({ chart, placement, actions }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    let mounted: { destroy(): void } | undefined

    import('#pele')
      .then(({ mountAsync }) =>
        mountAsync(container, chart, {
          fontSize: 14,
          links: false,
          // The content column is ~520px; pele's 640px default would turn every
          // LR flowchart vertical on desktop. Only phones get the vertical layout.
          directionBreakpoint: 420,
          // Mintlify `actions`: true always shows zoom controls, false hides them,
          // unset shows them only when the diagram is shrunk to fit.
          zoom: actions === undefined ? 'auto' : actions && { always: true },
          onError: () => setFailed(true),
        }),
      )
      .then((result) => {
        if (cancelled) result.destroy()
        else mounted = result
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      mounted?.destroy()
    }
  }, [chart, actions])

  if (failed) {
    return (
      <div className='no-bleed'>
        <CodeBlock lang='mermaid' lineHeight='1.5' showLineNumbers={false}>
          {chart}
        </CodeBlock>
      </div>
    )
  }

  // pele owns the inner div's children, so React must never render any there.
  // data-placement positions the zoom controls (Mintlify `placement`), see editorial.css.
  return (
    <div className='no-bleed rounded-lg border border-border-subtle bg-card p-3'>
      <div ref={containerRef} data-mermaid-diagram data-placement={placement} className='mermaid-diagram' />
    </div>
  )
}
