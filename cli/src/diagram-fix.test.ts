import { describe, test, expect } from 'vitest'
import dedent from 'string-dedent'
import {
  fixDiagramLines,
  fixDiagramsInText,
  findBoxes,
  validateDiagram,
  validateDiagramsInText,
  stringDisplayWidth,
  charDisplayWidth,
} from './diagram-fix.ts'

// ─────────────────────────────────────────────────────────────
// Display width helpers
// ─────────────────────────────────────────────────────────────

describe('charDisplayWidth', () => {
  test('ASCII chars are width 1', () => {
    expect(charDisplayWidth('a')).toBe(1)
    expect(charDisplayWidth('Z')).toBe(1)
    expect(charDisplayWidth(' ')).toBe(1)
    expect(charDisplayWidth('─')).toBe(1)
    expect(charDisplayWidth('│')).toBe(1)
  })

  test('CJK chars are width 2', () => {
    expect(charDisplayWidth('中')).toBe(2)
    expect(charDisplayWidth('日')).toBe(2)
    expect(charDisplayWidth('本')).toBe(2)
  })

  test('box-drawing chars are width 1', () => {
    expect(charDisplayWidth('┌')).toBe(1)
    expect(charDisplayWidth('┐')).toBe(1)
    expect(charDisplayWidth('└')).toBe(1)
    expect(charDisplayWidth('┘')).toBe(1)
    expect(charDisplayWidth('┬')).toBe(1)
    expect(charDisplayWidth('┴')).toBe(1)
  })
})

describe('stringDisplayWidth', () => {
  test('ASCII string', () => {
    expect(stringDisplayWidth('hello')).toBe(5)
  })

  test('mixed ASCII and CJK', () => {
    expect(stringDisplayWidth('hi中文')).toBe(6) // 2 + 2 + 2
  })

  test('box border', () => {
    expect(stringDisplayWidth('┌──────┐')).toBe(8)
  })
})

// ─────────────────────────────────────────────────────────────
// Box detection
// ─────────────────────────────────────────────────────────────

describe('findBoxes', () => {
  test('finds a single box', () => {
    const lines = dedent`
      ┌───┐
      │ A │
      └───┘
    `.split('\n')

    const boxes = findBoxes(lines)
    expect(boxes).toHaveLength(1)
    expect(boxes[0]).toMatchObject({
      topRow: 0,
      bottomRow: 2,
      leftCol: 0,
      rightCol: 4,
    })
  })

  test('finds nested boxes', () => {
    const lines = dedent`
      ┌──────────┐
      │ ┌──────┐ │
      │ │ inner│ │
      │ └──────┘ │
      └──────────┘
    `.split('\n')

    const boxes = findBoxes(lines)
    expect(boxes).toHaveLength(2)
  })

  test('finds multiple side-by-side boxes', () => {
    const lines = dedent`
      ┌───┐ ┌───┐
      │ A │ │ B │
      └───┘ └───┘
    `.split('\n')

    const boxes = findBoxes(lines)
    expect(boxes).toHaveLength(2)
  })
})

// ─────────────────────────────────────────────────────────────
// Fixing: simple boxes
// ─────────────────────────────────────────────────────────────

describe('fixDiagramLines', () => {
  test('already correct box is unchanged', () => {
    const lines = dedent`
      ┌──────┐
      │ text │
      └──────┘
    `.split('\n')

    expect(fixDiagramLines(lines).join('\n')).toMatchInlineSnapshot('\n' + `
      "┌──────┐
      │ text │
      └──────┘"
    `)
  })

  test('fixes right border misaligned too far right', () => {
    const input = dedent`
      ┌──────┐
      │ text   │
      └──────┘
    `.split('\n')

    expect(fixDiagramLines(input).join('\n')).toMatchInlineSnapshot('\n' + `
      "┌──────┐
      │ text │  
      └──────┘"
    `)
  })

  test('fixes right border misaligned too far left', () => {
    const input = dedent`
      ┌──────────┐
      │ text │
      └──────────┘
    `.split('\n')

    expect(fixDiagramLines(input).join('\n')).toMatchInlineSnapshot('\n' + `
      "┌──────────┐
      │ text     │
      └──────────┘"
    `)
  })

  test('fixes bottom border width mismatch', () => {
    const input = dedent`
      ┌──────────┐
      │ content  │
      └────────┘
    `.split('\n')

    expect(fixDiagramLines(input).join('\n')).toMatchInlineSnapshot('\n' + `
      "┌──────────┐
      │ content  │
      └──────────┘"
    `)
  })

  test('fixes multiple content lines with inconsistent right borders', () => {
    const input = dedent`
      ┌─────────────────┐
      │ line one          │
      │ line two     │
      │ line three        │
      └─────────────────┘
    `.split('\n')

    expect(fixDiagramLines(input).join('\n')).toMatchInlineSnapshot('\n' + `
      "┌─────────────────┐
      │ line one        │  
      │ line two        │
      │ line three      │  
      └─────────────────┘"
    `)
  })

  test('preserves junction chars on borders', () => {
    const input = dedent`
      ┌──────┬──────┐
      │ left │right │
      └──────┴──────┘
    `.split('\n')

    expect(fixDiagramLines(input).join('\n')).toMatchInlineSnapshot('\n' + `
      "┌──────┬──────┐
      │ left │right │
      └──────┴──────┘"
    `)
  })
})

// ─────────────────────────────────────────────────────────────
// Fixing: nested boxes
// ─────────────────────────────────────────────────────────────

describe('fixDiagramLines — nested boxes', () => {
  test('fixes inner box alignment without breaking outer', () => {
    const input = dedent`
      ┌────────────────┐
      │  ┌──────┐      │
      │  │ inner  │    │
      │  └──────┘      │
      └────────────────┘
    `.split('\n')

    expect(fixDiagramLines(input).join('\n')).toMatchInlineSnapshot('\n' + `
      "┌────────────────┐
      │  ┌──────┐      │
      │  │ inner│      │
      │  └──────┘      │
      └────────────────┘"
    `)
  })
})

// ─────────────────────────────────────────────────────────────
// Fixing: side-by-side boxes
// ─────────────────────────────────────────────────────────────

describe('fixDiagramLines — side-by-side boxes', () => {
  test('does not shift second box when first right border is too far right', () => {
    const input = [
      '┌───┐   ┌───┐',
      '│ A   │ │ B │',
      '└───┘   └───┘',
    ]

    const fixed = fixDiagramLines(input)
    expect(fixed.join('\n')).toMatchInlineSnapshot('\n' + `
      "┌───┐   ┌───┐
      │ A │   │ B │
      └───┘   └───┘"
    `)
  })

  test('does not shift second box when first right border is too far left', () => {
    const input = [
      '┌──────┐ ┌───┐',
      '│ A  │   │ B │',
      '└──────┘ └───┘',
    ]

    const fixed = fixDiagramLines(input)
    expect(fixed.join('\n')).toMatchInlineSnapshot('\n' + `
      "┌──────┐ ┌───┐
      │ A    │ │ B │
      └──────┘ └───┘"
    `)
  })

  test('does not shift second box when first bottom border is wrong width', () => {
    const input = [
      '┌───┐   ┌───┐',
      '│ A │   │ B │',
      '└─────┘ └───┘',
    ]

    const fixed = fixDiagramLines(input)
    expect(fixed.join('\n')).toMatchInlineSnapshot('\n' + `
      "┌───┐   ┌───┐
      │ A │   │ B │
      └───┘   └───┘"
    `)
  })
})

// ─────────────────────────────────────────────────────────────
// Fixing: horizontal dividers inside boxes
// ─────────────────────────────────────────────────────────────

describe('fixDiagramLines — horizontal dividers', () => {
  test('pads divider with border chars not spaces', () => {
    const input = [
      '┌──────┐',
      '│ top  │',
      '├────┤',
      '│ bot  │',
      '└──────┘',
    ]

    const fixed = fixDiagramLines(input)
    expect(fixed.join('\n')).toMatchInlineSnapshot('\n' + `
      "┌──────┐
      │ top  │
      ├──────┤
      │ bot  │
      └──────┘"
    `)
  })

  test('preserves cross junctions in dividers', () => {
    const input = [
      '┌───┬───┐',
      '│ A │ B │',
      '├───┼─┤',
      '│ C │ D │',
      '└───┴───┘',
    ]

    const fixed = fixDiagramLines(input)
    expect(fixed.join('\n')).toMatchInlineSnapshot('\n' + `
      "┌───┬───┐
      │ A │ B │
      ├───┼───┤
      │ C │ D │
      └───┴───┘"
    `)
  })
})

// ─────────────────────────────────────────────────────────────
// Fixing: user's first example (build/deploy diagram)
// ─────────────────────────────────────────────────────────────

describe('fixDiagramLines — real-world diagrams', () => {
  test('preserves already-correct multi-tenant diagram', () => {
    const input = [
      '┌─────────────────────────────────────────────────────────────────────────┐',
      '│  1. Build once                                                          │',
      '│     npx vite build                                                      │',
      '│     ► produces dist/ with stable chunks + template data                 │',
      '└────────────────────────────────────┬────────────────────────────────────┘',
      '                                     │',
      '         ┌───────────────────────────┼───────────────────────────┐',
      '         ▼                           ▼                           ▼',
      '┌─────────────────┐     ┌─────────────────┐         ┌─────────────────┐',
      '│  Tenant A       │     │  Tenant B       │         │  Tenant C       │',
      '│                 │     │                 │         │                 │',
      '│  generateData() │     │  generateData() │         │  generateData() │',
      '│  ► data.js      │     │  ► data.js      │         │  ► data.js      │',
      '│  ► page chunks  │     │  ► page chunks  │         │  ► page chunks  │',
      '└────────┬────────┘     └────────┬────────┘         └────────┬────────┘',
      '         │                       │                           │',
      '         ▼                       ▼                           ▼',
      '┌─────────────────────────────────────────────────────────────────────────┐',
      '│  Deploy (content-addressable)                                           │',
      '│  Shared stable chunk uploaded once. Only data.js + pages per tenant.    │',
      '└─────────────────────────────────────────────────────────────────────────┘',
    ]

    const fixed = fixDiagramLines(input)

    // Every box should have consistent right border alignment
    const issues = validateDiagram(fixed.join('\n'))
    expect(issues).toEqual([])

    expect(fixed.join('\n')).toMatchInlineSnapshot('\n' + `
      "┌─────────────────────────────────────────────────────────────────────────┐
      │  1. Build once                                                          │
      │     npx vite build                                                      │
      │     ► produces dist/ with stable chunks + template data                 │
      └────────────────────────────────────┬────────────────────────────────────┘
                                           │
               ┌───────────────────────────┼───────────────────────────┐
               ▼                           ▼                           ▼
      ┌─────────────────┐     ┌─────────────────┐         ┌─────────────────┐
      │  Tenant A       │     │  Tenant B       │         │  Tenant C       │
      │                 │     │                 │         │                 │
      │  generateData() │     │  generateData() │         │  generateData() │
      │  ► data.js      │     │  ► data.js      │         │  ► data.js      │
      │  ► page chunks  │     │  ► page chunks  │         │  ► page chunks  │
      └────────┬────────┘     └────────┬────────┘         └────────┬────────┘
               │                       │                           │
               ▼                       ▼                           ▼
      ┌─────────────────────────────────────────────────────────────────────────┐
      │  Deploy (content-addressable)                                           │
      │  Shared stable chunk uploaded once. Only data.js + pages per tenant.    │
      └─────────────────────────────────────────────────────────────────────────┘"
    `)
  })

  test('fixes framer project diagram', () => {
    const input = [
      '┌──────────────────────────────────────────────────────────────────────────────┐',
      '│                           Your Framer Project                                │',
      '│                                                                              │',
      '│  Page with layers (not yet components)                                       │',
      '│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │',
      '│  │  Navbar  │ │   Hero   │ │ Features │ │ Pricing  │ │  Footer  │           │',
      '│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘           │',
      '└──────────────────────────────────┬───────────────────────────────────────────┘',
      '                                   │',
      '                       Framer Agent creates components',
      '                                   │',
      '                                   ▼',
      '┌──────────────────────────────────────────────────────────────────────────────┐',
      '│  Components panel                                                            │',
      '│  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐  │',
      '│  │ Section 1 Navbar     │  │ Section 2 Hero       │  │ Section 3 Features │  │',
      '│  └──────────────────────┘  └──────────────────────┘  └────────────────────┘  │',
      '│  ┌──────────────────────┐  ┌──────────────────────┐                          │',
      '│  │ Section 4 Pricing    │  │ Section 5 Footer     │                          │',
      '│  └──────────────────────┘  └──────────────────────┘                          │',
      '└──────────────────────────────────┬───────────────────────────────────────────┘',
      '                                   │',
      '                        React Export Plugin (select Section components)',
      '                                   │',
      '                                   ▼',
      '┌──────────────────────────────────────────────────────────────────────────────┐',
      '│  npx unframer {projectId} --outDir ./src/framer                              │',
      '│                                                                              │',
      '│  src/framer/                                                                 │',
      '│  ├── section-1-navbar.jsx                                                    │',
      '│  ├── section-2-hero.jsx                                                      │',
      '│  ├── section-3-features.jsx                                                  │',
      '│  ├── section-4-pricing.jsx                                                   │',
      '│  ├── section-5-footer.jsx                                                    │',
      '│  ├── chunks/*.js            (shared bundled chunks)                          │',
      '│  └── styles.css             (fonts, color variables, base styles)            │',
      '└──────────────────────────────────┬───────────────────────────────────────────┘',
      '                                   │',
      '                          Assemble in your React app',
      '                                   │',
      '                                   ▼',
      '┌──────────────────────────────────────────────────────────────────────────────┐',
      '│                     Deployed on Vercel / Cloudflare / Netlify                 │',
      '└──────────────────────────────────────────────────────────────────────────────┘',
    ]

    const fixed = fixDiagramLines(input)
    const issues = validateDiagram(fixed.join('\n'))
    expect(issues).toEqual([])

    expect(fixed.join('\n')).toMatchInlineSnapshot('\n' + `
      "┌──────────────────────────────────────────────────────────────────────────────┐
      │                           Your Framer Project                                │
      │                                                                              │
      │  Page with layers (not yet components)                                       │
      │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
      │  │  Navbar  │ │   Hero   │ │ Features │ │ Pricing  │ │  Footer  │            │
      │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
      └──────────────────────────────────┬───────────────────────────────────────────┘
                                         │
                             Framer Agent creates components
                                         │
                                         ▼
      ┌──────────────────────────────────────────────────────────────────────────────┐
      │  Components panel                                                            │
      │  ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐  │
      │  │ Section 1 Navbar     │  │ Section 2 Hero       │  │ Section 3 Features │  │
      │  └──────────────────────┘  └──────────────────────┘  └────────────────────┘  │
      │  ┌──────────────────────┐  ┌──────────────────────┐                          │
      │  │ Section 4 Pricing    │  │ Section 5 Footer     │                          │
      │  └──────────────────────┘  └──────────────────────┘                          │
      └──────────────────────────────────┬───────────────────────────────────────────┘
                                         │
                              React Export Plugin (select Section components)
                                         │
                                         ▼
      ┌──────────────────────────────────────────────────────────────────────────────┐
      │  npx unframer {projectId} --outDir ./src/framer                              │
      │                                                                              │
      │  src/framer/                                                                 │
      │  ├── section-1-navbar.jsx                                                    │
      │  ├── section-2-hero.jsx                                                      │
      │  ├── section-3-features.jsx                                                  │
      │  ├── section-4-pricing.jsx                                                   │
      │  ├── section-5-footer.jsx                                                    │
      │  ├── chunks/*.js            (shared bundled chunks)                          │
      │  └── styles.css             (fonts, color variables, base styles)            │
      └──────────────────────────────────┬───────────────────────────────────────────┘
                                         │
                                Assemble in your React app
                                         │
                                         ▼
      ┌──────────────────────────────────────────────────────────────────────────────┐
      │                     Deployed on Vercel / Cloudflare / Netlify                │ 
      └──────────────────────────────────────────────────────────────────────────────┘"
    `)
  })
})

// ─────────────────────────────────────────────────────────────
// Markdown integration — code block extraction
// ─────────────────────────────────────────────────────────────

describe('fixDiagramsInText', () => {
  test('fixes diagrams inside fenced code blocks', () => {
    const input = dedent`
      # Architecture

      Here is the diagram:

      ${'```'}
      ┌──────────┐
      │ Server     │
      └──────────┘
      ${'```'}

      Some more text.
    `

    expect(fixDiagramsInText(input)).toMatchInlineSnapshot('\n' + `
      "# Architecture

      Here is the diagram:

      \`\`\`
      ┌──────────┐
      │ Server   │  
      └──────────┘
      \`\`\`

      Some more text."
    `)
  })

  test('leaves non-diagram code blocks untouched', () => {
    const input = dedent`
      ${'```'}js
      const x = 1
      const y = 2
      ${'```'}
    `

    expect(fixDiagramsInText(input)).toBe(input)
  })

  test('fixes plain diagram text (no code fences)', () => {
    const input = dedent`
      ┌──────────┐
      │ hello      │
      └──────────┘
    `

    expect(fixDiagramsInText(input)).toMatchInlineSnapshot('\n' + `
      "┌──────────┐
      │ hello    │  
      └──────────┘"
    `)
  })

  test('fixes multiple diagram code blocks in one file', () => {
    const input = dedent`
      # Heading

      ${'```'}
      ┌─────┐
      │ A     │
      └─────┘
      ${'```'}

      Text in between.

      ${'```'}
      ┌─────┐
      │ B     │
      └─────┘
      ${'```'}
    `

    expect(fixDiagramsInText(input)).toMatchInlineSnapshot('\n' + `
      "# Heading

      \`\`\`
      ┌─────┐
      │ A   │  
      └─────┘
      \`\`\`

      Text in between.

      \`\`\`
      ┌─────┐
      │ B   │  
      └─────┘
      \`\`\`"
    `)
  })
})

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────

describe('validateDiagram', () => {
  test('returns empty for correct diagram', () => {
    const input = dedent`
      ┌──────┐
      │ text │
      └──────┘
    `
    expect(validateDiagram(input)).toEqual([])
  })

  test('reports misaligned right border', () => {
    const input = dedent`
      ┌──────┐
      │ text   │
      └──────┘
    `
    const issues = validateDiagram(input)
    expect(issues.length).toBeGreaterThan(0)
    expect(issues[0].message).toContain('expected')
  })

  test('reports lines exceeding max width', () => {
    const input = '┌' + '─'.repeat(98) + '┐\n' + '│' + ' '.repeat(98) + '│\n' + '└' + '─'.repeat(98) + '┘'
    const issues = validateDiagram(input, { maxWidth: 94 })
    const widthIssues = issues.filter((i) => i.message.includes('exceeds max'))
    expect(widthIssues).toHaveLength(3)
    expect(widthIssues[0].message).toMatchInlineSnapshot('\n' + `"Line is 100 cols wide, exceeds max 94"`)
  })

  test('passes with custom max width', () => {
    const input = '┌' + '─'.repeat(98) + '┐\n' + '│' + ' '.repeat(98) + '│\n' + '└' + '─'.repeat(98) + '┘'
    const issues = validateDiagram(input, { maxWidth: 200 })
    expect(issues).toEqual([])
  })

  test('reports width issues for non-box lines too', () => {
    const longLabel = 'A'.repeat(100)
    const input = `┌──┐\n│  │\n└──┘\n${longLabel}`
    const issues = validateDiagram(input, { maxWidth: 94 })
    const widthIssues = issues.filter((i) => i.message.includes('exceeds max'))
    expect(widthIssues).toHaveLength(1)
    expect(widthIssues[0].line).toBe(4)
  })
})

// ─────────────────────────────────────────────────────────────
// Markdown-aware validation
// ─────────────────────────────────────────────────────────────

describe('validateDiagramsInText', () => {
  test('ignores prose lines in markdown, only checks diagram blocks', () => {
    const longProse = 'A'.repeat(120)
    const input = `${longProse}\n\n${'```'}\n┌──┐\n│  │\n└──┘\n${'```'}`
    const issues = validateDiagramsInText(input, { maxWidth: 94 })
    // Prose line is ignored; small diagram is fine
    expect(issues).toEqual([])
  })

  test('reports width issues inside diagram code blocks', () => {
    const wideLine = '│' + ' '.repeat(100) + '│'
    const input = `Some text\n\n${'```'}\n┌${'─'.repeat(100)}┐\n${wideLine}\n└${'─'.repeat(100)}┘\n${'```'}`
    const issues = validateDiagramsInText(input, { maxWidth: 94 })
    const widthIssues = issues.filter((i) => i.message.includes('exceeds max'))
    expect(widthIssues.length).toBeGreaterThan(0)
  })

  test('line numbers are file-relative not block-relative', () => {
    const input = `Line 1\nLine 2\n\n${'```'}\n┌${'─'.repeat(100)}┐\n└${'─'.repeat(100)}┘\n${'```'}`
    const issues = validateDiagramsInText(input, { maxWidth: 94 })
    // Code block starts at line 4 (0-indexed line 3), diagram at line 5 (0-indexed 4)
    expect(issues[0].line).toBeGreaterThan(3)
  })
})

// ─────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────

describe('edge cases', () => {
  test('empty input', () => {
    expect(fixDiagramLines([]).join('\n')).toBe('')
  })

  test('text with no boxes', () => {
    const lines = ['hello', 'world']
    expect(fixDiagramLines(lines).join('\n')).toBe('hello\nworld')
  })

  test('single-char wide box', () => {
    const input = dedent`
      ┌─┐
      │A│
      └─┘
    `.split('\n')

    expect(fixDiagramLines(input).join('\n')).toMatchInlineSnapshot('\n' + `
      "┌─┐
      │A│
      └─┘"
    `)
  })

  test('box with CJK content pads correctly', () => {
    const input = [
      '┌──────────┐',
      '│ 中文     │',
      '│ hello    │',
      '└──────────┘',
    ]

    const fixed = fixDiagramLines(input)
    const issues = validateDiagram(fixed.join('\n'))
    expect(issues).toEqual([])

    expect(fixed.join('\n')).toMatchInlineSnapshot('\n' + `
      "┌──────────┐
      │ 中文     │
      │ hello    │
      └──────────┘"
    `)
  })

  test('box with arrows and special chars inside', () => {
    const input = dedent`
      ┌────────────────────┐
      │ ► step one           │
      │ ► step two          │
      │ ▼ result            │
      └────────────────────┘
    `.split('\n')

    const fixed = fixDiagramLines(input)
    const issues = validateDiagram(fixed.join('\n'))
    expect(issues).toEqual([])

    expect(fixed.join('\n')).toMatchInlineSnapshot('\n' + `
      "┌────────────────────┐
      │ ► step one         │  
      │ ► step two         │ 
      │ ▼ result           │ 
      └────────────────────┘"
    `)
  })

  test('double-line box style ╔═╗', () => {
    const input = [
      '╔══════════╗',
      '║ content    ║',
      '╚══════════╝',
    ]

    const fixed = fixDiagramLines(input)
    const issues = validateDiagram(fixed.join('\n'))
    expect(issues).toEqual([])

    expect(fixed.join('\n')).toMatchInlineSnapshot('\n' + `
      "╔══════════╗
      ║ content  ║  
      ╚══════════╝"
    `)
  })

  test('rounded corner box style ╭─╮', () => {
    const input = [
      '╭──────────╮',
      '│ content    │',
      '╰──────────╯',
    ]

    const fixed = fixDiagramLines(input)
    expect(validateDiagram(fixed.join('\n'))).toEqual([])

    expect(fixed.join('\n')).toMatchInlineSnapshot('\n' + `
      "╭──────────╮
      │ content  │  
      ╰──────────╯"
    `)
  })

  test('heavy border box style ┏━┓', () => {
    const input = [
      '┏━━━━━━━━━━┓',
      '┃ content    ┃',
      '┗━━━━━━━━━━┛',
    ]

    const fixed = fixDiagramLines(input)
    expect(validateDiagram(fixed.join('\n'))).toEqual([])

    expect(fixed.join('\n')).toMatchInlineSnapshot('\n' + `
      "┏━━━━━━━━━━┓
      ┃ content  ┃  
      ┗━━━━━━━━━━┛"
    `)
  })

  test('mixed rounded corners with light borders', () => {
    const input = [
      '╭──────────╮',
      '│ mixed      │',
      '╰────────╯',
    ]

    const fixed = fixDiagramLines(input)
    expect(validateDiagram(fixed.join('\n'))).toEqual([])

    expect(fixed.join('\n')).toMatchInlineSnapshot('\n' + `
      "╭──────────╮
      │ mixed    │  
      ╰──────────╯"
    `)
  })

  test('preserves heavy cross junctions in dividers', () => {
    const input = [
      '┏━━━┳━━━┓',
      '┃ A ┃ B ┃',
      '┣━━━╋━┫',
      '┃ C ┃ D ┃',
      '┗━━━┻━━━┛',
    ]

    const fixed = fixDiagramLines(input)
    expect(validateDiagram(fixed.join('\n'))).toEqual([])

    expect(fixed.join('\n')).toMatchInlineSnapshot('\n' + `
      "┏━━━┳━━━┓
      ┃ A ┃ B ┃
      ┣━━━╋━━━┫
      ┃ C ┃ D ┃
      ┗━━━┻━━━┛"
    `)
  })

  test('preserves double cross junctions in dividers', () => {
    const input = [
      '╔═══╦═══╗',
      '║ A ║ B ║',
      '╠═══╬═╣',
      '║ C ║ D ║',
      '╚═══╩═══╝',
    ]

    const fixed = fixDiagramLines(input)
    expect(validateDiagram(fixed.join('\n'))).toEqual([])

    expect(fixed.join('\n')).toMatchInlineSnapshot('\n' + `
      "╔═══╦═══╗
      ║ A ║ B ║
      ╠═══╬═══╣
      ║ C ║ D ║
      ╚═══╩═══╝"
    `)
  })

  test('empty box (no content lines)', () => {
    const input = [
      '┌──────┐',
      '└──────┘',
    ]

    const fixed = fixDiagramLines(input)
    expect(fixed.join('\n')).toMatchInlineSnapshot('\n' + `
      "┌──────┐
      └──────┘"
    `)
  })

  test('box with tree-like content using └── and ├──', () => {
    const input = [
      '┌──────────────────┐',
      '│ src/              │',
      '│ ├── index.ts      │',
      '│ ├── utils.ts     │',
      '│ └── types.ts       │',
      '└──────────────────┘',
    ]

    const fixed = fixDiagramLines(input)
    const issues = validateDiagram(fixed.join('\n'))
    expect(issues).toEqual([])

    expect(fixed.join('\n')).toMatchInlineSnapshot('\n' + `
      "┌──────────────────┐
      │ src/             │ 
      │ ├── index.ts     │ 
      │ ├── utils.ts     │
      │ └── types.ts     │  
      └──────────────────┘"
    `)
  })
})
