import { describe, expect, test } from 'vitest'
import { remarkMermaidCode } from './remark-mermaid.ts'
import { runRemarkPlugin } from './remark-test-utils.ts'

describe('remarkMermaidCode', () => {
  test('rewrites mermaid fences to Mermaid JSX with parsed meta props', () => {
    const result = runRemarkPlugin(`
\`\`\`mermaid placement="top-left" actions={false}
flowchart LR
A-->B
\`\`\`
`, remarkMermaidCode)

    expect(result.markdown).toBe('<Mermaid\n  chart="flowchart LR\nA-->B"\n  placement="top-left"\n  actions={false}\n/>\n')
  })

  test('leaves non-mermaid fences unchanged', () => {
    const result = runRemarkPlugin(`
\`\`\`ts
console.log('ts')
\`\`\`
`, remarkMermaidCode)

    expect(result.markdown).toMatchInlineSnapshot(`
      "\`\`\`ts
      console.log('ts')
      \`\`\`
      "
    `)
  })
})
