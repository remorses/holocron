'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { CodeBlock } from '../code-block.tsx'

let mermaidInitialized = false

export function Mermaid({ chart }: { chart: string; placement?: string; actions?: boolean }) {
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const renderId = useMemo(() => {
    return `mermaid-${Math.random().toString(36).slice(2, 10)}`
  }, [])

  useEffect(() => {
    let cancelled = false

    async function renderDiagram() {
      try {
        const { default: mermaid } = await import('mermaid')
        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'loose',
            theme: 'neutral',
          })
          mermaidInitialized = true
        }

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
  }, [chart, renderId])

  if (!svg) {
    if (failed) {
      return (
        <div className='no-bleed'>
          <CodeBlock lang='diagram' lineHeight='1.5' showLineNumbers={false} bleed={false}>
            {chart}
          </CodeBlock>
        </div>
      )
    }

    return (
      <div className='no-bleed rounded-(--border-radius-md) border border-(--border-subtle) bg-card px-4 py-3 text-sm text-(color:--text-secondary)'>
        Rendering diagram...
      </div>
    )
  }

  return (
    <div className='no-bleed rounded-(--border-radius-md) border border-(--border-subtle) bg-card p-3'>
      <div
        data-mermaid-diagram
        className='overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full'
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}
